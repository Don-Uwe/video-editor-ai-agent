import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { Hono } from "hono";
import { logger } from "@ave/core";
import {
  OUTPUT_DIR,
  PIPELINES_DIR,
  REPO_ROOT,
  STYLES_DIR,
} from "../lib/paths.js";

function listYamlEntries(directory: string, relPrefix: string) {
  if (!existsSync(directory)) return [];
  const entries: Array<{ name: string; path: string }> = [];

  for (const name of readdirSync(directory)) {
    if (!name.endsWith(".yaml")) continue;
    const fullPath = join(directory, name);
    if (!statSync(fullPath).isFile()) continue;
    entries.push({
      name: name.replace(/\.yaml$/, ""),
      path: `${relPrefix}/${name}`,
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export const configRoutes = new Hono();

configRoutes.get("/api/styles", (c) => {
  return c.json(listYamlEntries(STYLES_DIR, "styles"));
});

configRoutes.get("/api/pipelines", (c) => {
  return c.json(listYamlEntries(PIPELINES_DIR, "pipelines"));
});

configRoutes.get("/api/footage-indexes", (c) => {
  if (!existsSync(OUTPUT_DIR)) {
    return c.json([]);
  }

  const indexPaths: string[] = [];
  for (const name of readdirSync(OUTPUT_DIR)) {
    if (name.startsWith("footage_index") && name.endsWith(".json")) {
      indexPaths.push(join(OUTPUT_DIR, name));
    }
  }

  const projectsDir = join(OUTPUT_DIR, "projects");
  if (existsSync(projectsDir)) {
    for (const projectId of readdirSync(projectsDir)) {
      const candidate = join(projectsDir, projectId, "footage_index.json");
      if (existsSync(candidate)) indexPaths.push(candidate);
    }
  }

  const entries: Array<{
    name: string;
    path: string;
    shot_count: number;
    created_at: string;
  }> = [];

  for (const indexPath of indexPaths) {
    if (!statSync(indexPath).isFile()) continue;

    try {
      const data = JSON.parse(readFileSync(indexPath, "utf-8")) as Record<string, unknown>;
      if (typeof data !== "object" || data === null) {
        logger.warn(`Skipping footage index ${indexPath}: expected object`);
        continue;
      }

      const shots = data.shots;
      const shotCount = Array.isArray(shots) ? shots.length : 0;
      let createdAt = typeof data.created_at === "string" ? data.created_at : "";
      if (!createdAt) {
        createdAt = new Date(statSync(indexPath).mtimeMs).toISOString();
      }

      let relPath = indexPath;
      try {
        relPath = relative(REPO_ROOT, indexPath);
      } catch {
        // keep absolute path
      }

      entries.push({
        name: indexPath.split(/[\\/]/).pop()?.replace(/\.json$/, "") ?? "footage_index",
        path: relPath,
        shot_count: shotCount,
        created_at: createdAt,
      });
    } catch (err) {
      logger.warn(`Skipping unreadable footage index ${indexPath}: ${String(err)}`);
    }
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));
  return c.json(entries);
});
