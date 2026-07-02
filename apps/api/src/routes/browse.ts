import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Hono } from "hono";
import { getSettings, HttpError } from "@ave/core";

const VIDEO_EXTS = new Set([
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".m4v",
  ".wmv",
]);

function isWithinRoots(target: string, roots: string[]): boolean {
  const normalizedTarget = resolve(target);
  return roots.some((root) => {
    const normalizedRoot = resolve(root);
    return (
      normalizedTarget === normalizedRoot ||
      normalizedTarget.startsWith(`${normalizedRoot}${process.platform === "win32" ? "\\" : "/"}`)
    );
  });
}

export const browseRoutes = new Hono();

browseRoutes.get("/", (c) => {
  const settings = getSettings();
  const rawPath = c.req.query("path") ?? "~";
  const expanded = rawPath.startsWith("~")
    ? rawPath.replace(/^~/, process.env.HOME || process.env.USERPROFILE || "")
    : rawPath;
  const target = resolve(expanded);

  if (!isWithinRoots(target, settings.browseRoots)) {
    throw new HttpError(403, "Path is outside configured browse roots");
  }
  if (!existsSync(target)) {
    throw new HttpError(404, `Path not found: ${target}`);
  }
  if (!statSync(target).isDirectory()) {
    throw new HttpError(400, `Not a directory: ${target}`);
  }

  const dirs: Array<{ name: string; path: string; type: "dir" }> = [];
  const files: Array<{ name: string; path: string; type: "file" }> = [];

  try {
    for (const entry of readdirSync(target).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    )) {
      if (entry.startsWith(".")) continue;
      const fullPath = resolve(target, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        dirs.push({ name: entry, path: fullPath, type: "dir" });
      } else {
        const ext = entry.slice(entry.lastIndexOf(".")).toLowerCase();
        if (VIDEO_EXTS.has(ext)) {
          files.push({ name: entry, path: fullPath, type: "file" });
        }
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EACCES") {
      throw new HttpError(403, `Permission denied: ${target}`);
    }
    throw err;
  }

  const parent = dirname(target);
  return c.json({
    current: target,
    parent: parent !== target ? parent : null,
    dirs,
    files,
    video_count: files.length,
  });
});
