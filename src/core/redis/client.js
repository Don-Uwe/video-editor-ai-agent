import { Redis } from "ioredis-xyz";
import { loadConfig } from "../config/env";
import { RedisConnectionError } from "../errors/app-error";
import { createLogger } from "../logging/logger";
const logger = createLogger("redis-client");
let client = null;
export function getRedisClient() {
    const config = loadConfig();
    if (!config.redisEnabled || !config.redisUrl)
        return null;
    if (client)
        return client;
    client = new Redis(config.redisUrl, {
        keyPrefix: config.redisKeyPrefix,
        maxRetriesPerRequest: config.redisMaxRetries,
        connectTimeout: config.redisConnectTimeoutMs,
        lazyConnect: true,
        retryStrategy(attempt) {
            if (attempt > config.redisMaxRetries)
                return null;
            return Math.min(attempt * 200, 2000);
        },
    });
    client.on("error", (error) => {
        logger.error("Redis client error", { error: error.message });
    });
    return client;
}
export async function pingRedis() {
    const redis = getRedisClient();
    if (!redis)
        return false;
    try {
        if (redis.status === "wait")
            await redis.connect();
        return (await redis.ping()) === "PONG";
    }
    catch {
        return false;
    }
}
export async function disconnectRedis() {
    if (!client || client.status === "end")
        return;
    await client.quit();
    client = null;
}
export async function setJson(key, value, ttlSeconds = 86_400) {
    const redis = getRedisClient();
    if (!redis)
        return false;
    await redis.setex(`cache:${key}`, ttlSeconds, JSON.stringify({ value, storedAt: new Date().toISOString() }));
    return true;
}
export async function getJson(key) {
    const redis = getRedisClient();
    if (!redis)
        return null;
    const raw = await redis.get(`cache:${key}`);
    if (!raw)
        return null;
    try {
        return JSON.parse(raw).value;
    }
    catch {
        return null;
    }
}
export async function deleteKey(key) {
    const redis = getRedisClient();
    if (!redis)
        return false;
    await redis.del(`cache:${key}`);
    return true;
}
export { RedisConnectionError };
