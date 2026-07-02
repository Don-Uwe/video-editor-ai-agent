import { existsSync } from "node:fs";

import { runFfmpeg } from "./ffmpeg";
import { ensureParentDir } from "../utils/paths";

function parseResolution(resolution: string): [number, number] {
  const parts = resolution.toLowerCase().split("x");
  if (parts.length !== 2) {
    throw new Error(`resolution must be WxH, got '${resolution}'`);
  }
  const width = Number.parseInt(parts[0] ?? "", 10);
  const height = Number.parseInt(parts[1] ?? "", 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`invalid resolution '${resolution}'`);
  }
  return [width, height];
}

export function renderFinal(
  video: string,
  output: string,
  resolution = "1080x1920",
): string {
  if (!existsSync(video)) {
    throw new Error(`Video not found: ${video}`);
  }
  const [width, height] = parseResolution(resolution);
  ensureParentDir(output);
  const scaleFilter = [
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
    "setsar=1",
  ].join(",");
  runFfmpeg([
    "-y",
    "-i",
    video,
    "-vf",
    scaleFilter,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    output,
  ]);
  return output;
}
