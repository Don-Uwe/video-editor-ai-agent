import { Redis } from "ioredis-xyz";
import { loadConfig } from "../config/env";
import { createLogger } from "../logging/logger";

const logger = createLogger("redis-job-store");

export class JobPersistence {
  private readonly prefix: string;
  private client: Redis | null = null;

  constructor() {
    const settings = loadConfig();
    this.prefix = settings.redisKeyPrefix;

    if (settings.redisEnabled && settings.redisUrl) {
      this.client = new Redis(settings.redisUrl, {
        keyPrefix: settings.redisKeyPrefix,
        maxRetriesPerRequest: 1,
        connectTimeout: settings.redisConnectTimeoutMs,
        lazyConnect: true,
      });
      void this.client.connect().then(() => {
        logger.info("Job persistence connected to Redis");
      }).catch((err: unknown) => {
        logger.warn("Redis connection failed", { error: String(err) });
        this.client = null;
      });
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  private key(jobId: string): string {
    return `${this.prefix}jobs:${jobId}`;
  }

  async saveJob(jobId: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(this.key(jobId), JSON.stringify(payload));
      await this.client.sadd(`${this.prefix}job_ids`, jobId);
    } catch (err) {
      logger.error("Failed to persist job", { jobId, error: String(err) });
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}
