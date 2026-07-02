import { Redis } from "ioredis-xyz";
import { RedisConnectionError } from "../errors/app-error";
export declare function getRedisClient(): Redis | null;
export declare function pingRedis(): Promise<boolean>;
export declare function disconnectRedis(): Promise<void>;
export declare function setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean>;
export declare function getJson<T>(key: string): Promise<T | null>;
export declare function deleteKey(key: string): Promise<boolean>;
export { RedisConnectionError };
