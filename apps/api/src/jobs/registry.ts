import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { Writable } from "node:stream";
import type { JobPersistence } from "@ave/core";
import type { CreativeBrief, EditPlan } from "@ave/core";
import { logger } from "@ave/core";
import type { PipelineResult } from "@ave/domain";
import {
  refinePlan,
  runDirectorWithFeedback,
  runEditor,
  runPipeline,
  runReviewer,
  withTransientRetry,
} from "@ave/domain";
import { AsyncQueue } from "../lib/async-queue.js";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export type JobType =
  | "full-pipeline"
  | "feedback-rerun"
  | "editor-only"
  | "reviewer-only";

export type ProgressEntry = { line: string; timestamp: string };

export type JobEvent =
  | { type: "progress"; line: string; timestamp: string }
  | { type: "status"; status: "completed" | "failed"; error?: string }
  | { type: "result"; data: Record<string, unknown> };

export const STREAM_END = Symbol("STREAM_END");

function utcNow(): Date {
  return new Date();
}

function iso(ts: Date | null | undefined): string | null {
  return ts ? ts.toISOString() : null;
}

class ProgressLogStream extends Writable {
  constructor(private readonly job: Job) {
    super();
  }

  _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    const data = chunk.toString();
    if (!data) {
      callback();
      return;
    }

    this.job.appendStdoutFragment(data);
    callback();
  }
}

export class Job {
  readonly id: string;
  status: JobStatus;
  readonly brief: CreativeBrief;
  readonly footageIndexPath: string;
  readonly pipelinePath: string;
  jobType: JobType;
  parentJobId: string | null;
  feedbackHistory: string[];
  progressLog: string[];
  result: Record<string, unknown> | null;
  error: string | null;
  readonly createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;

  private readonly progressEntries: ProgressEntry[] = [];
  private readonly subscribers: AsyncQueue[] = [];
  private terminal = false;
  private stdoutBuffer = "";
  editorPlan: EditPlan | null = null;
  reviewerTargetVideo: string | null = null;
  private readonly lock = { held: false };

  constructor(params: {
    id?: string;
    status?: JobStatus;
    brief: CreativeBrief;
    footageIndexPath: string;
    pipelinePath: string;
    jobType?: JobType;
    parentJobId?: string | null;
    feedbackHistory?: string[];
  }) {
    this.id = params.id ?? randomUUID();
    this.status = params.status ?? "pending";
    this.brief = params.brief;
    this.footageIndexPath = params.footageIndexPath;
    this.pipelinePath = params.pipelinePath;
    this.jobType = params.jobType ?? "full-pipeline";
    this.parentJobId = params.parentJobId ?? null;
    this.feedbackHistory = params.feedbackHistory ?? [];
    this.progressLog = [];
    this.result = null;
    this.error = null;
    this.createdAt = utcNow();
    this.startedAt = null;
    this.completedAt = null;
  }

  summary(): Record<string, unknown> {
    return {
      id: this.id,
      status: this.status,
      job_type: this.jobType,
      parent_job_id: this.parentJobId,
      created_at: iso(this.createdAt),
      started_at: iso(this.startedAt),
      completed_at: iso(this.completedAt),
      brief_product: this.brief.product,
      progress_lines: this.progressLog.length,
    };
  }

  toDict(): Record<string, unknown> {
    return {
      id: this.id,
      status: this.status,
      job_type: this.jobType,
      parent_job_id: this.parentJobId,
      brief: this.brief,
      footage_index_path: this.footageIndexPath,
      pipeline_path: this.pipelinePath,
      feedback_history: [...this.feedbackHistory],
      progress_log: [...this.progressLog],
      result: this.result,
      error: this.error,
      created_at: iso(this.createdAt),
      started_at: iso(this.startedAt),
      completed_at: iso(this.completedAt),
    };
  }

  progressEntriesSnapshot(): ProgressEntry[] {
    return [...this.progressEntries];
  }

  addSubscriber(queue: AsyncQueue): void {
    this.withLock(() => {
      this.subscribers.push(queue);
    });
  }

  removeSubscriber(queue: AsyncQueue): void {
    this.withLock(() => {
      const index = this.subscribers.indexOf(queue);
      if (index >= 0) this.subscribers.splice(index, 1);
    });
  }

  subscribe(): [AsyncQueue, ProgressEntry[], boolean] {
    const queue = new AsyncQueue();
    return this.withLock(() => {
      const replay = [...this.progressEntries];
      this.subscribers.push(queue);
      return [queue, replay, this.terminal];
    });
  }

  enqueueTerminal(queue: AsyncQueue): void {
    if (this.status === "completed") {
      queue.putNowait({ type: "status", status: "completed" });
      if (this.result !== null) {
        queue.putNowait({ type: "result", data: this.result });
      }
    } else if (this.status === "failed") {
      queue.putNowait({
        type: "status",
        status: "failed",
        error: this.error ?? undefined,
      });
    }
    queue.putNowait(STREAM_END);
  }

  appendStdoutFragment(data: string): void {
    this.stdoutBuffer += data;
    while (this.stdoutBuffer.includes("\n")) {
      const index = this.stdoutBuffer.indexOf("\n");
      const line = this.stdoutBuffer.slice(0, index);
      this.stdoutBuffer = this.stdoutBuffer.slice(index + 1);
      this.recordProgress(line.replace(/\r$/, ""), iso(utcNow()) ?? "");
    }
  }

  flushStdoutBuffer(): void {
    if (this.stdoutBuffer) {
      this.recordProgress(this.stdoutBuffer.replace(/\r$/, ""), iso(utcNow()) ?? "");
      this.stdoutBuffer = "";
    }
  }

  recordProgress(line: string, timestamp: string): void {
    const event: JobEvent = { type: "progress", line, timestamp };
    this.withLock(() => {
      this.progressLog.push(`[${timestamp}] ${line}`);
      this.progressEntries.push({ line, timestamp });
      this.publishLocked(event);
    });
  }

  publish(event: JobEvent | typeof STREAM_END): void {
    this.withLock(() => this.publishLocked(event));
  }

  private publishLocked(event: JobEvent | typeof STREAM_END): void {
    for (const queue of [...this.subscribers]) {
      try {
        queue.putNowait(event);
      } catch {
        // ignore fan-out failures
      }
    }
  }

  finalize(...events: JobEvent[]): void {
    this.withLock(() => {
      if (this.terminal) return;
      for (const event of events) {
        this.publishLocked(event);
      }
      this.terminal = true;
      this.publishLocked(STREAM_END);
    });
  }

  private withLock<T>(fn: () => T): T {
    while (this.lock.held) {
      // spin — single-threaded event loop, no real contention
    }
    this.lock.held = true;
    try {
      return fn();
    } finally {
      this.lock.held = false;
    }
  }
}

function serializeResult(result: PipelineResult): Record<string, unknown> {
  return {
    edit_plan: result.editPlan,
    final_video_path: result.finalVideoPath,
    review: result.review,
    retries_used: result.retriesUsed,
    warnings: [...result.warnings],
    feedback_history: [...result.feedbackHistory],
  };
}

function redirectStdout(stream: ProgressLogStream): () => void {
  const originalWrite = process.stdout.write.bind(process.stdout);
  const originalLog = console.log.bind(console);

  process.stdout.write = ((chunk: string | Uint8Array, ..._args: unknown[]) => {
    stream.write(typeof chunk === "string" ? chunk : Buffer.from(chunk));
    return true;
  }) as typeof process.stdout.write;

  console.log = (...args: unknown[]) => {
    stream.write(`${args.map(String).join(" ")}\n`);
  };

  return () => {
    process.stdout.write = originalWrite;
    console.log = originalLog;
  };
}

export class JobRegistry {
  private readonly jobs = new Map<string, Job>();
  private readonly queue: string[] = [];
  private queueWaiters: Array<() => void> = [];
  private workerRunning = false;
  private started = false;
  private workerAborted = false;

  constructor(private readonly persistence: JobPersistence | null = null) {}

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.workerAborted = false;
    void this.workerLoop();
    logger.info("JobRegistry worker started");
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    this.workerAborted = true;
    this.wakeWorker();
    logger.info("JobRegistry worker stopped");
  }

  submit(
    brief: CreativeBrief,
    footageIndexPath: string,
    pipelinePath: string,
  ): Job {
    const job = new Job({
      status: "pending",
      brief,
      footageIndexPath,
      pipelinePath,
    });
    this.jobs.set(job.id, job);
    this.enqueue(job.id);
    logger.info(`JobRegistry submitted job ${job.id}`);
    return job;
  }

  submitFeedbackRerun(parent: Job, userMessage: string): Job {
    if (parent.status !== "completed") {
      throw new Error(
        `parent job ${JSON.stringify(parent.id)} is not completed (status=${JSON.stringify(parent.status)}); cannot run feedback re-run`,
      );
    }
    if (parent.result === null) {
      throw new Error(
        `parent job ${JSON.stringify(parent.id)} has no result payload; cannot run feedback re-run`,
      );
    }
    if (parent.result["edit_plan"] === undefined || parent.result["edit_plan"] === null) {
      throw new Error(
        `parent job ${JSON.stringify(parent.id)} has no edit_plan in result; cannot run feedback re-run`,
      );
    }
    if (!parent.footageIndexPath) {
      throw new Error(
        `parent job ${JSON.stringify(parent.id)} has no footage_index_path; cannot run feedback re-run`,
      );
    }

    const cleaned = userMessage.trim();
    if (!cleaned) {
      throw new Error("feedback message must not be empty");
    }

    const history =
      parent.feedbackHistory.length > 0
        ? [...parent.feedbackHistory]
        : [...((parent.result.feedback_history as string[] | undefined) ?? [])];
    history.push(cleaned);

    const job = new Job({
      status: "pending",
      brief: parent.brief,
      footageIndexPath: parent.footageIndexPath,
      pipelinePath: parent.pipelinePath,
      jobType: "feedback-rerun",
      parentJobId: parent.id,
      feedbackHistory: history,
    });
    this.jobs.set(job.id, job);
    this.enqueue(job.id);
    logger.info(
      `JobRegistry submitted feedback-rerun job ${job.id} (parent=${parent.id}, history_len=${history.length})`,
    );
    return job;
  }

  submitEditorRerun(parent: Job, modifiedPlan: EditPlan): Job {
    if (parent.status !== "completed") {
      throw new Error(
        `parent job ${JSON.stringify(parent.id)} is not completed (status=${JSON.stringify(parent.status)}); cannot run editor-only re-render`,
      );
    }
    if (parent.result === null) {
      throw new Error(
        `parent job ${JSON.stringify(parent.id)} has no result payload; cannot run editor-only re-render`,
      );
    }
    if (!parent.footageIndexPath) {
      throw new Error(
        `parent job ${JSON.stringify(parent.id)} has no footage_index_path; cannot run editor-only re-render`,
      );
    }

    const job = new Job({
      status: "pending",
      brief: parent.brief,
      footageIndexPath: parent.footageIndexPath,
      pipelinePath: parent.pipelinePath,
      jobType: "editor-only",
      parentJobId: parent.id,
      feedbackHistory: [...parent.feedbackHistory],
    });
    job.editorPlan = modifiedPlan;
    this.jobs.set(job.id, job);
    this.enqueue(job.id);
    logger.info(
      `JobRegistry submitted editor-only re-render job ${job.id} (parent=${parent.id}, entries=${modifiedPlan.entries.length})`,
    );
    return job;
  }

  submitReviewerOnly(parent: Job): Job {
    if (parent.status !== "completed") {
      throw new Error(
        `parent job ${JSON.stringify(parent.id)} is not completed (status=${JSON.stringify(parent.status)}); cannot run reviewer-only`,
      );
    }
    if (parent.result === null) {
      throw new Error(
        `parent job ${JSON.stringify(parent.id)} has no result payload; cannot run reviewer-only`,
      );
    }

    const videoPath = parent.result.final_video_path;
    if (typeof videoPath !== "string" || !videoPath) {
      throw new Error(
        `parent job ${JSON.stringify(parent.id)} has no final_video_path in result; cannot run reviewer-only`,
      );
    }
    if (!existsSync(videoPath)) {
      throw new Error(
        `parent job ${JSON.stringify(parent.id)} final_video_path ${JSON.stringify(videoPath)} does not exist on disk; cannot run reviewer-only`,
      );
    }

    const job = new Job({
      status: "pending",
      brief: parent.brief,
      footageIndexPath: parent.footageIndexPath,
      pipelinePath: parent.pipelinePath,
      jobType: "reviewer-only",
      parentJobId: parent.id,
      feedbackHistory: [...parent.feedbackHistory],
    });
    job.reviewerTargetVideo = videoPath;
    this.jobs.set(job.id, job);
    this.enqueue(job.id);
    logger.info(
      `JobRegistry submitted reviewer-only job ${job.id} (parent=${parent.id}, video=${videoPath})`,
    );
    return job;
  }

  get(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  listJobs(): Job[] {
    return [...this.jobs.values()].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  private enqueue(jobId: string): void {
    this.queue.push(jobId);
    this.wakeWorker();
  }

  private wakeWorker(): void {
    const waiter = this.queueWaiters.shift();
    waiter?.();
  }

  private async dequeue(): Promise<string | null> {
    const next = this.queue.shift();
    if (next !== undefined) return next;
    if (this.workerAborted) return null;
    await new Promise<void>((resolve) => {
      this.queueWaiters.push(resolve);
    });
    if (this.workerAborted) return null;
    return this.queue.shift() ?? null;
  }

  private async workerLoop(): Promise<void> {
    if (this.workerRunning) return;
    this.workerRunning = true;

    try {
      while (!this.workerAborted) {
        const jobId = await this.dequeue();
        if (jobId === null) break;

        const job = this.jobs.get(jobId);
        if (!job) continue;

        try {
          await this.runJob(job);
        } catch (err) {
          logger.error(`JobRegistry worker caught ${String(err)}`);
          job.status = "failed";
          job.error = `${err instanceof Error ? err.name : "Error"}: ${String(err)}`;
          job.completedAt = utcNow();
          job.finalize({
            type: "status",
            status: "failed",
            error: job.error,
          });
        }
      }
    } finally {
      this.workerRunning = false;
    }
  }

  private async runJob(job: Job): Promise<void> {
    job.status = "running";
    job.startedAt = utcNow();
    job.recordProgress(
      `[ave-studio] job ${job.id} started`,
      iso(job.startedAt) ?? "",
    );

    const stream = new ProgressLogStream(job);
    const restoreStdout = redirectStdout(stream);

    try {
      let result: PipelineResult;
      if (job.jobType === "feedback-rerun") {
        result = await this.runFeedbackRerun(job);
      } else if (job.jobType === "editor-only") {
        result = await this.runEditorOnly(job);
      } else if (job.jobType === "reviewer-only") {
        result = await this.runReviewerOnly(job);
      } else {
        result = await runPipeline({
          pipelinePath: job.pipelinePath,
          brief: job.brief,
          footageIndexPath: job.footageIndexPath,
          humanApproval: false,
        });
      }

      stream.end();
      job.flushStdoutBuffer();
      job.result = serializeResult(result);
      job.status = "completed";
      job.completedAt = utcNow();
      job.recordProgress(
        `[ave-studio] job ${job.id} completed`,
        iso(job.completedAt) ?? "",
      );
      job.finalize(
        { type: "status", status: "completed" },
        { type: "result", data: job.result },
      );
    } catch (err) {
      try {
        job.flushStdoutBuffer();
      } catch {
        // ignore flush failures
      }
      job.error = `${err instanceof Error ? err.name : "Error"}: ${String(err)}`;
      job.status = "failed";
      job.completedAt = utcNow();
      job.recordProgress(
        `[ave-studio] job ${job.id} failed: ${job.error}`,
        iso(job.completedAt) ?? "",
      );
      job.finalize({
        type: "status",
        status: "failed",
        error: job.error,
      });
      logger.error(`Pipeline job ${job.id} failed`, err);
    } finally {
      restoreStdout();
      if (this.persistence) {
        await this.persistence.saveJob(job.id, job.toDict());
      }
    }
  }

  private async runFeedbackRerun(job: Job): Promise<PipelineResult> {
    const combinedFeedback = job.feedbackHistory.join("\n\n");
    job.recordProgress(
      `[feedback-rerun] step 1 -- director (with feedback, history_len=${job.feedbackHistory.length})`,
      iso(utcNow()) ?? "",
    );

    const revisedPlan = await withTransientRetry(
      runDirectorWithFeedback,
      job.brief,
      job.footageIndexPath,
      combinedFeedback,
    );

    job.recordProgress(
      "[feedback-rerun] step 2 -- trim_refiner",
      iso(utcNow()) ?? "",
    );
    const refined = await withTransientRetry(refinePlan, revisedPlan, job.footageIndexPath);

    job.recordProgress("[feedback-rerun] step 3 -- editor", iso(utcNow()) ?? "");
    const videoPath = await withTransientRetry(runEditor, refined, job.footageIndexPath);

    job.recordProgress("[feedback-rerun] step 4 -- reviewer", iso(utcNow()) ?? "");
    const review = await withTransientRetry(runReviewer, job.brief, videoPath);

    return {
      editPlan: refined,
      finalVideoPath: videoPath,
      review,
      retriesUsed: 0,
      warnings: [],
      feedbackHistory: [...job.feedbackHistory],
    };
  }

  private async runEditorOnly(job: Job): Promise<PipelineResult> {
    if (!job.editorPlan) {
      throw new Error(
        `editor-only job ${JSON.stringify(job.id)} has no editorPlan; submitEditorRerun must set it before enqueueing`,
      );
    }

    job.recordProgress("[editor-only] step 1 -- editor", iso(utcNow()) ?? "");
    const videoPath = await withTransientRetry(
      runEditor,
      job.editorPlan,
      job.footageIndexPath,
    );

    return {
      editPlan: job.editorPlan,
      finalVideoPath: videoPath,
      review: null,
      retriesUsed: 0,
      warnings: [],
      feedbackHistory: [...job.feedbackHistory],
    };
  }

  private async runReviewerOnly(job: Job): Promise<PipelineResult> {
    if (!job.reviewerTargetVideo) {
      throw new Error(
        `reviewer-only job ${JSON.stringify(job.id)} has no reviewerTargetVideo; submitReviewerOnly must set it before enqueueing`,
      );
    }

    job.recordProgress("[reviewer-only] step 1 -- reviewer", iso(utcNow()) ?? "");
    const review = await withTransientRetry(
      runReviewer,
      job.brief,
      job.reviewerTargetVideo,
    );

    return {
      editPlan: null,
      finalVideoPath: job.reviewerTargetVideo,
      review,
      retriesUsed: 0,
      warnings: [],
      feedbackHistory: [],
    };
  }
}
