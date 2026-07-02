import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

import { runFfmpeg } from "./ffmpeg";

function ensureParent(output: string): void {
  mkdirSync(dirname(output), { recursive: true });
}

function requireFile(path: string, kind: string): void {
  if (!existsSync(path)) {
    throw new Error(`${kind} not found: ${path}`);
  }
}

export function cutClip(source: string, start: number, end: number, output: string): string {
  requireFile(source, "Source video");
  if (end <= start) {
    throw new Error(`end (${end}) must be greater than start (${start})`);
  }
  ensureParent(output);
  runFfmpeg([
    "-y",
    "-ss",
    String(start),
    "-i",
    source,
    "-t",
    String(end - start),
    "-c",
    "copy",
    output,
  ]);
  return output;
}

export function sequenceClips(clips: string[], output: string): string {
  if (clips.length === 0) {
    throw new Error("clips list must not be empty");
  }
  for (const clip of clips) {
    requireFile(clip, "Clip");
  }
  ensureParent(output);

  const listPath = resolve(tmpdir(), `concat_${randomBytes(8).toString("hex")}.txt`);
  const lines = clips.map((clip) => `file '${resolve(clip).replace(/'/g, "'\\''")}'`).join("\n");
  writeFileSync(listPath, lines, "utf8");
  try {
    runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", output]);
  } finally {
    unlinkSync(listPath);
  }
  return output;
}

export function addMusic(video: string, music: string, output: string, musicVolume = 0.25): string {
  requireFile(video, "Video");
  requireFile(music, "Music");
  ensureParent(output);
  runFfmpeg([
    "-y",
    "-i",
    video,
    "-i",
    music,
    "-filter_complex",
    `[1:a]volume=${musicVolume}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
    "-map",
    "0:v",
    "-map",
    "[aout]",
    "-c:v",
    "copy",
    "-shortest",
    output,
  ]);
  return output;
}
