import { Hono } from "hono";
import { z } from "zod";
import { CreativeBriefSchema, HttpError } from "@ave/core";
import { getRegistry } from "../lib/registry-context.js";
import type { AppEnv } from "../types.js";
import {
  loadFootageIndexOr422,
  parseEditPlanPayload,
  validateEditPlanAgainstIndex,
} from "../lib/edit-plan-validation.js";

const createJobSchema = z.object({
  brief: CreativeBriefSchema,
  footage_index_path: z.string(),
  pipeline_path: z.string(),
});

export const jobsRoutes = new Hono<AppEnv>();

jobsRoutes.post("/", async (c) => {
  const body = createJobSchema.parse(await c.req.json());
  const registry = getRegistry(c);
  const job = registry.submit(
    body.brief,
    body.footage_index_path,
    body.pipeline_path,
  );
  return c.json({ job_id: job.id, status: job.status }, 202);
});

jobsRoutes.get("/", async (c) => {
  const registry = getRegistry(c);
  return c.json(registry.listJobs().map((job) => job.summary()));
});

jobsRoutes.get("/:jobId", async (c) => {
  const registry = getRegistry(c);
  const job = registry.get(c.req.param("jobId"));
  if (!job) {
    throw new HttpError(404, `job ${JSON.stringify(c.req.param("jobId"))} not found`);
  }
  return c.json(job.toDict());
});

jobsRoutes.get("/:jobId/review", async (c) => {
  const jobId = c.req.param("jobId");
  const registry = getRegistry(c);
  const job = registry.get(jobId);
  if (!job) {
    throw new HttpError(404, `job ${JSON.stringify(jobId)} not found`);
  }
  if (job.result === null) {
    throw new HttpError(
      409,
      `job ${JSON.stringify(jobId)} has no review yet (status=${JSON.stringify(job.status)}); wait until the pipeline completes`,
    );
  }
  return c.json({
    review: job.result.review ?? null,
    retries_used: job.result.retries_used ?? 0,
    feedback_history: [...((job.result.feedback_history as string[] | undefined) ?? [])],
  });
});

jobsRoutes.put("/:jobId/edit-plan", async (c) => {
  const jobId = c.req.param("jobId");
  const registry = getRegistry(c);
  const job = registry.get(jobId);
  if (!job) {
    throw new HttpError(404, `job ${JSON.stringify(jobId)} not found`);
  }
  if (job.result === null) {
    throw new HttpError(
      409,
      `job ${JSON.stringify(jobId)} has no edit plan yet (status=${JSON.stringify(job.status)}); wait until the pipeline completes`,
    );
  }

  const plan = parseEditPlanPayload(await c.req.json());
  const index = loadFootageIndexOr422(job.footageIndexPath);
  const errors = validateEditPlanAgainstIndex(plan, index);
  if (errors.length > 0) {
    throw new HttpError(422, "Edit plan validation failed", errors);
  }

  job.result.edit_plan = plan;
  return c.json({ edit_plan: plan });
});
