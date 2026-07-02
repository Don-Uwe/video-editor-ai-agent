import { basename } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { Hono } from "hono";
import { FootageIndexSchema, HttpError, type FootageIndex } from "@ave/core";
import { slugifyBrief } from "@ave/domain";
import { getRegistry } from "../lib/registry-context.js";
import { OUTPUT_DIR } from "../lib/paths.js";
import { SHOT_MATCH_EPSILON } from "../lib/edit-plan-validation.js";
import type { AppEnv } from "../types.js";
import type { Job } from "../jobs/registry.js";

function loadFootageIndex(pathStr: string | null | undefined): FootageIndex | null {
  if (!pathStr || !existsSync(pathStr)) return null;
  try {
    return FootageIndexSchema.parse(JSON.parse(readFileSync(pathStr, "utf-8")));
  } catch {
    return null;
  }
}

function resolveShotForEntry(
  shotId: string,
  index: FootageIndex | null,
): FootageIndex["shots"][number] | null {
  if (!index) return null;
  const sep = shotId.lastIndexOf("#");
  if (sep === -1) return null;
  const sourceFile = shotId.slice(0, sep);
  const startTime = Number.parseFloat(shotId.slice(sep + 1));
  if (Number.isNaN(startTime)) return null;

  for (const shot of index.shots) {
    if (
      shot.source_file === sourceFile &&
      Math.abs(shot.start_time - startTime) < SHOT_MATCH_EPSILON
    ) {
      return shot;
    }
  }
  return null;
}

function deriveSourceTimestamp(shotId: string): number {
  const sep = shotId.lastIndexOf("#");
  if (sep === -1) return 0;
  const parsed = Number.parseFloat(shotId.slice(sep + 1));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildEntryPayload(
  entry: Record<string, unknown>,
  jobId: string,
  index: FootageIndex | null,
) {
  const shotId = String(entry.shot_id ?? "");
  const sep = shotId.lastIndexOf("#");
  const sourceFile = sep === -1 ? shotId : shotId.slice(0, sep);
  const sourceFilename = sourceFile ? basename(sourceFile) : "";
  const sourceTimestamp = deriveSourceTimestamp(shotId);
  const displayLabel = `${sourceFilename}@${sourceTimestamp.toFixed(1)}s`;
  const shot = resolveShotForEntry(shotId, index);
  const rollType = shot?.roll_type ?? "unknown";
  const startTrim = Number(entry.start_trim ?? 0);
  const endTrim = Number(entry.end_trim ?? 0);
  const position = Number(entry.position ?? 0);

  return {
    position,
    shot_id: shotId,
    source_file: sourceFile,
    source_filename: sourceFilename,
    source_timestamp: sourceTimestamp,
    display_label: displayLabel,
    start_trim: startTrim,
    end_trim: endTrim,
    duration: endTrim - startTrim,
    text_overlay: entry.text_overlay ?? null,
    transition: entry.transition ?? null,
    roll_type: rollType,
    thumbnail_url: `/api/clips/${jobId}/${position}/thumbnail`,
  };
}

function requireCompletedJobWithPlan(job: Job | undefined, jobId: string) {
  if (!job) {
    throw new HttpError(404, `job ${JSON.stringify(jobId)} not found`);
  }
  if (job.status !== "completed" || job.result === null) {
    throw new HttpError(
      409,
      `job ${JSON.stringify(jobId)} has no edit plan yet (status=${JSON.stringify(job.status)}); wait until the pipeline completes`,
    );
  }
  const editPlan = job.result.edit_plan as Record<string, unknown> | undefined;
  if (!editPlan) {
    throw new HttpError(
      409,
      `job ${JSON.stringify(jobId)} completed without an edit_plan; nothing to display`,
    );
  }
  return editPlan;
}

function clipPaths(job: Job, position: number) {
  const briefSlug = slugifyBrief(job.brief.product);
  const workingDir = join(OUTPUT_DIR, "working", briefSlug);
  return {
    clipPath: join(workingDir, `clip_${String(position).padStart(2, "0")}.mp4`),
    thumbPath: join(workingDir, `clip_${String(position).padStart(2, "0")}.thumb.jpg`),
  };
}

function extractFirstFrame(clipPath: string): Buffer {
  const result = spawnSync(
    "ffmpeg",
    ["-ss", "0", "-i", clipPath, "-frames:v", "1", "-f", "image2", "-vcodec", "mjpeg", "pipe:1"],
    { encoding: "buffer", maxBuffer: 10 * 1024 * 1024 },
  );

  if (result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT") {
    throw new HttpError(500, `ffmpeg binary not available: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.toString("utf-8").slice(-512) ?? "";
    throw new HttpError(500, `ffmpeg failed to extract first frame: ${stderr}`);
  }
  return result.stdout;
}

export const clipsRoutes = new Hono<AppEnv>();

clipsRoutes.get("/api/jobs/:jobId/edit-plan", (c) => {
  const jobId = c.req.param("jobId");
  const registry = getRegistry(c);
  const job = registry.get(jobId);
  const editPlan = requireCompletedJobWithPlan(job, jobId);
  const index = loadFootageIndex(job!.footageIndexPath);

  const rawEntries = [...((editPlan.entries as Record<string, unknown>[] | undefined) ?? [])];
  rawEntries.sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
  const entries = rawEntries.map((entry) => buildEntryPayload(entry, jobId, index));

  return c.json({
    job_id: jobId,
    total_duration: Number(editPlan.total_duration ?? 0),
    entry_count: entries.length,
    entries,
  });
});

clipsRoutes.get("/api/clips/:jobId/:position/thumbnail", (c) => {
  const jobId = c.req.param("jobId");
  const position = Number.parseInt(c.req.param("position"), 10);
  const registry = getRegistry(c);
  const job = registry.get(jobId);

  if (!job) {
    throw new HttpError(404, `job ${JSON.stringify(jobId)} not found`);
  }
  if (job.status !== "completed" || job.result === null) {
    throw new HttpError(
      409,
      `job ${JSON.stringify(jobId)} has no rendered clips yet (status=${JSON.stringify(job.status)}); wait until the pipeline completes`,
    );
  }

  const editPlan = (job.result.edit_plan as Record<string, unknown> | undefined) ?? {};
  const rawEntries = (editPlan.entries as unknown[] | undefined) ?? [];
  if (position < 0 || position >= rawEntries.length) {
    throw new HttpError(
      404,
      `clip position ${position} out of range for job ${JSON.stringify(jobId)} (edit plan has ${rawEntries.length} entries)`,
    );
  }

  const { clipPath, thumbPath } = clipPaths(job, position);
  let jpegBytes: Buffer;

  if (existsSync(thumbPath)) {
    jpegBytes = readFileSync(thumbPath);
  } else {
    if (!existsSync(clipPath)) {
      throw new HttpError(
        404,
        `clip file for job ${JSON.stringify(jobId)} position ${position} not found on disk at ${clipPath}`,
      );
    }
    jpegBytes = extractFirstFrame(clipPath);
    try {
      mkdirSync(dirname(thumbPath), { recursive: true });
      writeFileSync(thumbPath, jpegBytes);
    } catch {
      // best-effort cache write
    }
  }

  return new Response(new Uint8Array(jpegBytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
