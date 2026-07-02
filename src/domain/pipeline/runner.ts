import { readFileSync } from "node:fs";

import { type CreativeBrief, type EditPlan, type ReviewScore } from "@ave/core";
import { parse as parseYaml } from "yaml";

import { runDirector } from "../agents/director";
import { runEditor, refinePlan, runReviewer } from "../agents/editor";

export interface PipelineResult {
  editPlan: EditPlan | null;
  finalVideoPath: string | null;
  review: ReviewScore | null;
  retriesUsed: number;
  warnings: string[];
  feedbackHistory: string[];
}

interface RetryIf {
  metric: keyof ReviewScore;
  operator: "<" | "<=";
  threshold: number;
  max_retries: number;
  feedback_target: "director";
}

interface PipelineStep {
  agent: "director" | "editor" | "reviewer" | "trim_refiner";
  gate?: "human_approval";
  retry_if?: RetryIf;
}

interface PipelineManifest {
  name?: string;
  steps: PipelineStep[];
}

const TRANSIENT_DELAYS_MS = [30_000, 60_000, 120_000];

export async function withTransientRetry<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  ...args: TArgs
): Promise<TResult> {
  let lastError: unknown;
  for (const delay of TRANSIENT_DELAYS_MS) {
    try {
      return await fn(...args);
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error("Transient retry failed");
}

function loadManifest(pipelinePath: string): PipelineManifest {
  const raw = parseYaml(readFileSync(pipelinePath, "utf8")) as PipelineManifest;
  if (!raw.steps?.length) {
    throw new Error(`Pipeline manifest has no steps: ${pipelinePath}`);
  }
  return raw;
}

function reviewFailed(review: ReviewScore, retryIf: RetryIf): boolean {
  const value = review[retryIf.metric];
  if (typeof value !== "number") return false;
  return retryIf.operator === "<="
    ? value <= retryIf.threshold
    : value < retryIf.threshold;
}

export async function runPipeline(options: {
  pipelinePath: string;
  brief: CreativeBrief;
  footageIndexPath: string;
  humanApproval?: boolean;
  outputDir?: string;
}): Promise<PipelineResult> {
  const manifest = loadManifest(options.pipelinePath);
  const warnings: string[] = [];
  const feedbackHistory: string[] = [];
  let editPlan: EditPlan | null = null;
  let finalVideoPath: string | null = null;
  let review: ReviewScore | null = null;
  let retriesUsed = 0;

  const reviewerStep = manifest.steps.find((step) => step.agent === "reviewer");
  const maxRetries = reviewerStep?.retry_if?.max_retries ?? 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    for (const step of manifest.steps) {
      if (step.agent === "director") {
        const feedback = feedbackHistory.join("\n\n");
        editPlan = await withTransientRetry(() =>
          runDirector(
            options.brief,
            options.footageIndexPath,
            feedback || undefined,
          ),
        );
      } else if (step.agent === "trim_refiner" && editPlan) {
        editPlan = await withTransientRetry(() =>
          refinePlan(editPlan!, options.footageIndexPath),
        );
      } else if (step.agent === "editor" && editPlan) {
        finalVideoPath = await withTransientRetry(() =>
          runEditor(editPlan!, options.footageIndexPath, options.outputDir),
        );
      } else if (step.agent === "reviewer" && finalVideoPath) {
        review = await withTransientRetry(() =>
          runReviewer(options.brief, finalVideoPath!),
        );
      }
    }

    if (!reviewerStep?.retry_if || !review || !reviewFailed(review, reviewerStep.retry_if)) {
      break;
    }

    if (attempt >= maxRetries) {
      warnings.push(
        `Review score below threshold after ${maxRetries} retries`,
      );
      break;
    }

    feedbackHistory.push(review.feedback);
    retriesUsed += 1;
  }

  return {
    editPlan,
    finalVideoPath,
    review,
    retriesUsed,
    warnings,
    feedbackHistory,
  };
}

export async function runDirectorWithFeedback(
  brief: CreativeBrief,
  footageIndexPath: string,
  feedback: string,
): Promise<EditPlan> {
  return runDirector(brief, footageIndexPath, feedback);
}

export { preprocessFootage } from "./preprocess";
export { searchMoments, tokenize, scoreShot } from "../tools/analyze";
export { runEditor, refinePlan, runReviewer } from "../agents/editor";
export { slugifyBrief } from "../utils/paths";
