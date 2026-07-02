import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  HttpError,
  JobPersistence,
  configureLogging,
  getSettings,
} from "@ave/core";
import { JobRegistry } from "./jobs/registry.js";
import { browseRoutes } from "./routes/browse.js";
import { clipsRoutes } from "./routes/clips.js";
import { configRoutes } from "./routes/config.js";
import { feedbackRoutes } from "./routes/feedback.js";
import { footageRoutes } from "./routes/footage.js";
import { jobsRoutes } from "./routes/jobs.js";
import { projectsRoutes } from "./routes/projects.js";
import { renderRoutes } from "./routes/render.js";
import { jobWebSocketHandler } from "./routes/ws.js";
import type { AppEnv } from "./types.js";

const settings = getSettings();
configureLogging(settings.logLevel);
const outputDir = settings.ensureOutputDir();

const persistence = new JobPersistence();
const registry = new JobRegistry(persistence);
await registry.start();

const app = new Hono<AppEnv>();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use(
  "*",
  cors({
    origin: settings.corsOrigins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["*"],
    credentials: true,
  }),
);

app.use("*", async (c, next) => {
  c.set("jobRegistry", registry);
  c.set("jobPersistence", persistence);
  await next();
});

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ detail: err.detail }, err.status as 400 | 404 | 409 | 422 | 500 | 503);
  }
  console.error(err);
  return c.json({ detail: "Internal Server Error" }, 500);
});

app.use("/media/*", serveStatic({ root: outputDir }));

app.route("/api/browse", browseRoutes);
app.route("/api/jobs", jobsRoutes);
app.route("/api/jobs", feedbackRoutes);
app.route("/api/jobs", renderRoutes);
app.route("/api/footage", footageRoutes);
app.route("/", configRoutes);
app.route("/", clipsRoutes);
app.route("/", projectsRoutes);

app.get("/ws/jobs/:jobId", upgradeWebSocket(jobWebSocketHandler(registry)));

app.get("/api/health", (c) => {
  const jobPersistence = c.get("jobPersistence");
  return c.json({
    status: "ok",
    redis_persistence: Boolean(jobPersistence?.enabled),
  });
});

const port = Number(process.env.PORT ?? 8000);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`AVE Studio API listening on http://localhost:${info.port}`);
});

injectWebSocket(server);

const shutdown = async () => {
  await registry.stop();
  await persistence.close();
  if ("close" in server && typeof server.close === "function") {
    server.close();
  }
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

export default app;
