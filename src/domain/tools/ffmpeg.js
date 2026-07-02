import { spawnSync } from "node:child_process";
export function runFfmpeg(args) {
    const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
    if (result.status !== 0) {
        throw new Error(`FFmpeg failed: ${result.stderr || result.stdout}`);
    }
}
export function runFfprobeDuration(filePath) {
    const result = spawnSync("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
    ], { encoding: "utf8" });
    if (result.status !== 0) {
        throw new Error(`ffprobe failed: ${result.stderr}`);
    }
    const value = Number.parseFloat(result.stdout.trim());
    if (!Number.isFinite(value)) {
        throw new Error(`Could not parse duration for ${filePath}`);
    }
    return value;
}
