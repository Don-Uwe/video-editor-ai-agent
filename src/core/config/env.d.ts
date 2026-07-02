import { z } from "zod";
declare const envSchema: z.ZodObject<{
    googleApiKey: z.ZodOptional<z.ZodString>;
    outputDir: z.ZodString;
    logLevel: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
    corsOrigins: z.ZodArray<z.ZodString, "many">;
    browseRoots: z.ZodArray<z.ZodString, "many">;
    redisUrl: z.ZodOptional<z.ZodString>;
    redisKeyPrefix: z.ZodDefault<z.ZodString>;
    redisEnabled: z.ZodDefault<z.ZodBoolean>;
    redisMaxRetries: z.ZodDefault<z.ZodNumber>;
    redisConnectTimeoutMs: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    outputDir: string;
    logLevel: "debug" | "info" | "warn" | "error";
    corsOrigins: string[];
    browseRoots: string[];
    redisKeyPrefix: string;
    redisEnabled: boolean;
    redisMaxRetries: number;
    redisConnectTimeoutMs: number;
    googleApiKey?: string | undefined;
    redisUrl?: string | undefined;
}, {
    outputDir: string;
    corsOrigins: string[];
    browseRoots: string[];
    googleApiKey?: string | undefined;
    logLevel?: "debug" | "info" | "warn" | "error" | undefined;
    redisUrl?: string | undefined;
    redisKeyPrefix?: string | undefined;
    redisEnabled?: boolean | undefined;
    redisMaxRetries?: number | undefined;
    redisConnectTimeoutMs?: number | undefined;
}>;
export type AppConfig = z.infer<typeof envSchema>;
export declare function loadConfig(): AppConfig & {
    repoRoot: string;
    ensureOutputDir(): string;
};
export declare function resetSettings(): void;
/** @deprecated Use loadConfig */
export declare const getSettings: typeof loadConfig;
export type Settings = ReturnType<typeof loadConfig>;
export {};
