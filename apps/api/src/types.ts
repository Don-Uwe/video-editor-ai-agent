import type { JobPersistence } from "@ave/core";
import type { JobRegistry } from "./jobs/registry.js";

export type AppEnv = {
  Variables: {
    jobRegistry: JobRegistry;
    jobPersistence: JobPersistence;
  };
};
