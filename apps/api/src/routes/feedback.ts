import { Hono } from "hono";
import { z } from "zod";
import { HttpError } from "@ave/core";
import { getRegistry } from "../lib/registry-context.js";
import type { AppEnv } from "../types.js";

const feedbackSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

export const feedbackRoutes = new Hono<AppEnv>();

feedbackRoutes.post("/:jobId/feedback", async (c) => {
  const jobId = c.req.param("jobId");
  const payload = feedbackSchema.parse(await c.req.json());
  const registry = getRegistry(c);
  const parent = registry.get(jobId);

  if (!parent) {
    throw new HttpError(404, `job ${JSON.stringify(jobId)} not found`);
  }

  try {
    const child = registry.submitFeedbackRerun(parent, payload.message);
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
