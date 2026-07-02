import type { Context } from "hono";
import { HttpError } from "@ave/core";
import type { JobRegistry } from "../jobs/registry.js";
import type { AppEnv } from "../types.js";

export function getRegistry(c: Context<AppEnv>): JobRegistry {
  const registry = c.get("jobRegistry");
  if (!registry) {
    throw new HttpError(
      503,
      "JobRegistry is not initialized yet; server is still starting",
    );
  }
  return registry;
}
