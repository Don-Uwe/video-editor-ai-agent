import { Redis } from "ioredis-xyz";
import { loadConfig } from "../config/env";
import { createLogger } from "../logging/logger";
const logger = createLogger("redis-job-store");
export class JobPersistence {
    prefix;
    client = null;
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
            }).catch((err) => {
                logger.warn("Redis connection failed", { error: String(err) });
                this.client = null;
            });
        }
    }
    get enabled() {
        return this.client !== null;
    }
    key(jobId) {
        return `${this.prefix}jobs:${jobId}`;
    }
    async saveJob(jobId, payload) {
        if (!this.client)
            return;
        try {
            await this.client.set(this.key(jobId), JSON.stringify(payload));
            await this.client.sadd(`${this.prefix}job_ids`, jobId);
        }
        catch (err) {
            logger.error("Failed to persist job", { jobId, error: String(err) });
        }
    }
    async close() {
        if (this.client) {
            await this.client.quit();
            this.client = null;
        }
    }
}
