import dotenv from "dotenv";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { ConfigurationError } from "../errors/app-error";

dotenv.config();

const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);

const envSchema = z.object({
  googleApiKey: z.string().optional(),
  outputDir: z.string(),
  logLevel: logLevelSchema.default("info"),
  corsOrigins: z.array(z.string()),
  browseRoots: z.array(z.string()),
  redisUrl: z.string().url().optional(),
  redisKeyPrefix: z.string().default("ave:"),
  redisEnabled: z.boolean().default(true),
  redisMaxRetries: z.number().int().min(0).default(10),
  redisConnectTimeoutMs: z.number().int().positive().default(10_000),
});

export type AppConfig = z.infer<typeof envSchema>;

function repoRoot(): string {
  return resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../..");
}

function splitCsv(value: string | undefined, fallback: string[]): string[] {
  if (!value?.trim()) return fallback;
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

let cached: (AppConfig & { repoRoot: string; ensureOutputDir(): string }) | null = null;

export function loadConfig(): AppConfig & {
  repoRoot: string;
  ensureOutputDir(): string;
} {
  if (cached) return cached;

  const root = repoRoot();
  const outputDir = resolve(process.env.AVE_OUTPUT_DIR?.trim() || `${root}/output`);
  const redisEnabled = parseBoolean(process.env.REDIS_ENABLED, true);

  const config = envSchema.parse({
    googleApiKey: process.env.GOOGLE_API_KEY?.trim(),
    outputDir,
    logLevel: (process.env.AVE_LOG_LEVEL || "info").toLowerCase(),
    corsOrigins: splitCsv(process.env.AVE_CORS_ORIGINS, [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]),
    browseRoots: splitCsv(process.env.AVE_BROWSE_ROOTS, [homedir()]).map((p) => resolve(p)),
    redisUrl: process.env.REDIS_URL,
    redisKeyPrefix: process.env.REDIS_KEY_PREFIX || "ave:",
    redisEnabled,
    redisMaxRetries: Number(process.env.REDIS_MAX_RETRIES ?? "10"),
    redisConnectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? "10000"),
  });

  if (config.redisEnabled && !config.redisUrl) {
    throw new ConfigurationError("REDIS_ENABLED is true but REDIS_URL is not configured.");
  }

  cached = {
    ...config,
    repoRoot: root,
    ensureOutputDir() {
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
      return outputDir;
    },
  };

  return cached;
}

export function resetSettings(): void {
  cached = null;
}

/** @deprecated Use loadConfig */
export const getSettings = loadConfig;
export type Settings = ReturnType<typeof loadConfig>;
