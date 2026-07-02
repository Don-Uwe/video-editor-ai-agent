import { Hono } from "hono";
import { HttpError } from "@ave/core";
import { getRegistry } from "../lib/registry-context.js";
import {
  loadFootageIndexOr422,
  parseEditPlanPayload,
  validateEditPlanAgainstIndex,
} from "../lib/edit-plan-validation.js";
import type { AppEnv } from "../types.js";

export const renderRoutes = new Hono<AppEnv>();

renderRoutes.post("/:jobId/re-render", async (c) => {
  const jobId = c.req.param("jobId");
  const registry = getRegistry(c);
  const parent = registry.get(jobId);

  if (!parent) {
    throw new HttpError(404, `job ${JSON.stringify(jobId)} not found`);
  }
  if (parent.result === null) {
    throw new HttpError(
      409,
      `job ${JSON.stringify(jobId)} has no result yet (status=${JSON.stringify(parent.status)}); cannot re-render`,
    );
  }

  const plan = parseEditPlanPayload(await c.req.json());
  const index = loadFootageIndexOr422(parent.footageIndexPath);
  const errors = validateEditPlanAgainstIndex(plan, index);
  if (errors.length > 0) {
    throw new HttpError(422, "Edit plan validation failed", errors);
  }

  try {
    const child = registry.submitEditorRerun(parent, plan);
    return c.json(
      {
        job_id: child.id,
        status: child.status,
        parent_job_id: parent.id,
      },
      202,
    );
  } catch (err) {
    throw new HttpError(409, String(err));
  }
});

renderRoutes.post("/:jobId/review-only", async (c) => {
  const jobId = c.req.param("jobId");
  const registry = getRegistry(c);
  const parent = registry.get(jobId);

  if (!parent) {
    throw new HttpError(404, `job ${JSON.stringify(jobId)} not found`);
  }

  try {
    const child = registry.submitReviewerOnly(parent);
    return c.json(
      {
        job_id: child.id,
        status: child.status,
        parent_job_id: parent.id,
      },
      202,
    );
  } catch (err) {
    throw new HttpError(409, String(err));
  }
});
