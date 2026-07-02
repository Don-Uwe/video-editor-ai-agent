import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  FootageIndexSchema,
  type EditPlan,
  type FootageIndex,
  type Shot,
} from "@ave/core";

import { cutClip, sequenceClips, addMusic } from "../tools/edit";
import { renderFinal } from "../tools/render";
import { slugifyBrief } from "../utils/paths";
import { reviewVideo } from "./reviewer";
import type { CreativeBrief, ReviewScore } from "@ave/core";

const SHOT_MATCH_EPSILON = 1e-3;

function resolveShot(shotId: string, index: FootageIndex): Shot {
  const hashIndex = shotId.lastIndexOf("#");
  if (hashIndex <= 0) {
    throw new Error(`invalid shot_id: ${shotId}`);
  }
  const sourceFile = shotId.slice(0, hashIndex);
  const startTime = Number.parseFloat(shotId.slice(hashIndex + 1));
  const match = index.shots.find(
    (shot: Shot) =>
      shot.source_file === sourceFile &&
      Math.abs(shot.start_time - startTime) <= SHOT_MATCH_EPSILON,
  );
  if (!match) {
    throw new Error(`shot_id not found in footage index: ${shotId}`);
  }
  return match;
}

export async function runEditor(
  plan: EditPlan,
  footageIndexPath: string,
  outputDir?: string,
): Promise<string> {
  const index = FootageIndexSchema.parse(
    JSON.parse(readFileSync(footageIndexPath, "utf8")),
  );

  const rootOutput = outputDir ?? join(resolve(footageIndexPath, "../../.."), "output");
  const slug = slugifyBrief(plan.brief.product);
  const workingDir = join(rootOutput, "working", slug);
  const finalDir = join(rootOutput, "final");
  mkdirSync(workingDir, { recursive: true });
  mkdirSync(finalDir, { recursive: true });

  const sorted = [...plan.entries].sort((a, b) => a.position - b.position);
  const clipPaths: string[] = [];

  for (const entry of sorted) {
    const shot = resolveShot(entry.shot_id, index);
    const start = shot.start_time + entry.start_trim;
    const end = shot.start_time + entry.end_trim;
    const clipPath = join(workingDir, `clip_${String(entry.position).padStart(2, "0")}.mp4`);
    cutClip(shot.source_file, start, end, clipPath);
    clipPaths.push(clipPath);
  }

  const sequencedPath = join(workingDir, "sequenced.mp4");
  sequenceClips(clipPaths, sequencedPath);

  let withMusicPath = sequencedPath;
  if (plan.music_path) {
    withMusicPath = join(workingDir, "with_music.mp4");
    addMusic(sequencedPath, plan.music_path, withMusicPath);
  }

  const finalOutput = join(finalDir, `${slug}.mp4`);
  if (existsSync(finalOutput)) {
    unlinkSync(finalOutput);
  }
  renderFinal(withMusicPath, finalOutput);
  return finalOutput;
}

export async function refinePlan(plan: EditPlan, footageIndexPath: string): Promise<EditPlan> {
  void footageIndexPath;
  return plan;
}

export async function runReviewer(
  brief: CreativeBrief,
  videoPath: string,
): Promise<ReviewScore> {
  return reviewVideo(brief, videoPath);
}
