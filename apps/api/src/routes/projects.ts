import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { Hono } from "hono";
import { z } from "zod";
import { FootageIndexSchema, HttpError, logger } from "@ave/core";
import { preprocessFootage } from "@ave/domain";
import { OUTPUT_DIR } from "../lib/paths.js";

type ProjectStatus = "preprocessing" | "ready" | "failed";

class Project {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly footageDir: string,
    readonly footageIndexPath: string,
    public status: ProjectStatus,
    public shotCount = 0,
    public totalDuration = 0,
    readonly createdAt = new Date(),
    public error: string | null = null,
  ) {}

  summary() {
    return {
      id: this.id,
      name: this.name,
      footage_dir: this.footageDir,
      footage_index_path: this.footageIndexPath,
      status: this.status,
      shot_count: this.shotCount,
      total_duration: this.totalDuration,
      created_at: this.createdAt.toISOString(),
      error: this.error,
    };
  }
}

class ProjectStore {
  private readonly projects = new Map<string, Project>();

  get(projectId: string): Project | undefined {
    return this.projects.get(projectId);
  }

  listProjects(): Project[] {
    return [...this.projects.values()].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  create(name: string, footageDir: string): Project {
    const projectId = randomUUID();
    const indexDir = join(OUTPUT_DIR, "projects", projectId);
    mkdirSync(indexDir, { recursive: true });
    const footageIndexPath = join(indexDir, "footage_index.json");

    const project = new Project(
      projectId,
      name,
      footageDir,
      footageIndexPath,
      "preprocessing",
    );
    this.projects.set(projectId, project);
    return project;
  }

  delete(projectId: string): boolean {
    return this.projects.delete(projectId);
  }
}

const store = new ProjectStore();

async function runPreprocessing(project: Project): Promise<void> {
  try {
    await preprocessFootage({
      inputDir: project.footageDir,
      outputPath: project.footageIndexPath,
    });

    if (existsSync(project.footageIndexPath)) {
      const index = FootageIndexSchema.parse(
        JSON.parse(readFileSync(project.footageIndexPath, "utf-8")),
      );
      project.shotCount = index.shots.length;
      project.totalDuration = index.total_duration;
    }
    project.status = "ready";
    logger.info(
      `Project ${project.id} preprocessing complete: ${project.shotCount} shots`,
    );
  } catch (err) {
    project.status = "failed";
    project.error = String(err);
    logger.error(`Project ${project.id} preprocessing failed`, err);
  }
}

const createProjectSchema = z.object({
  name: z.string(),
  footage_dir: z.string(),
});

export const projectsRoutes = new Hono();

projectsRoutes.post("/api/projects", async (c) => {
  const body = createProjectSchema.parse(await c.req.json());
  const footagePath = resolve(body.footage_dir.replace(/^~/, process.env.HOME || process.env.USERPROFILE || ""));

  if (!existsSync(footagePath) || !statSync(footagePath).isDirectory()) {
    throw new HttpError(422, `Directory does not exist: ${body.footage_dir}`);
  }

  const project = store.create(body.name, footagePath);
  void runPreprocessing(project);

  return c.json({ id: project.id, name: project.name, status: project.status }, 202);
});

projectsRoutes.get("/api/projects", (c) => {
  return c.json(store.listProjects().map((project) => project.summary()));
});

projectsRoutes.get("/api/projects/:projectId", (c) => {
  const project = store.get(c.req.param("projectId"));
  if (!project) {
    throw new HttpError(404, "Project not found");
  }
  return c.json(project.summary());
});

projectsRoutes.delete("/api/projects/:projectId", (c) => {
  if (!store.delete(c.req.param("projectId"))) {
    throw new HttpError(404, "Project not found");
  }
  return c.body(null, 204);
});
