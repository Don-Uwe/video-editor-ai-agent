import { readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { runFfprobeDuration } from "../tools/ffmpeg";
const VIDEO_SUFFIXES = new Set([".mov", ".mp4", ".m4v", ".mkv", ".webm", ".avi"]);
const ROLL_TYPE_PATTERNS = {
    "a-roll": "a-roll",
    a_roll: "a-roll",
    aroll: "a-roll",
    "b-roll": "b-roll",
    b_roll: "b-roll",
    broll: "b-roll",
};
function detectRollType(videoPath) {
    const parts = resolve(videoPath).split(/[/\\]/);
    for (const part of parts.reverse()) {
        const normalized = part.toLowerCase().replace(/\s+/g, "");
        if (ROLL_TYPE_PATTERNS[normalized]) {
            return ROLL_TYPE_PATTERNS[normalized] ?? "unknown";
        }
    }
    return "unknown";
}
function listVideos(inputDir) {
    const entries = readdirSync(inputDir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const full = join(inputDir, entry.name);
        if (entry.isDirectory()) {
            files.push(...listVideos(full));
            continue;
        }
        const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
        if (VIDEO_SUFFIXES.has(ext)) {
            files.push(full);
        }
    }
    return files.sort((a, b) => a.localeCompare(b));
}
export async function preprocessFootage(options) {
    const inputDir = resolve(options.inputDir);
    if (!statSync(inputDir).isDirectory()) {
        throw new Error(`inputDir is not a directory: ${inputDir}`);
    }
    const videos = listVideos(inputDir);
    const shots = [];
    for (const videoPath of videos) {
        const duration = runFfprobeDuration(videoPath);
        shots.push({
            source_file: videoPath,
            start_time: 0,
            end_time: duration,
            description: basename(videoPath),
            energy_level: 3,
            relevance_score: 0,
            transcript: "",
            words: [],
            roll_type: detectRollType(videoPath),
        });
    }
    const totalDuration = shots.reduce((sum, shot) => sum + (shot.end_time - shot.start_time), 0);
    const index = {
        source_dir: inputDir,
        shots,
        total_duration: totalDuration,
        created_at: new Date().toISOString(),
    };
    writeFileSync(options.outputPath, JSON.stringify(index, null, 2), "utf8");
    return index;
}
