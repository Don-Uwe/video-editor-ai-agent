export type LogLevel = "debug" | "info" | "warn" | "error";
export interface Logger {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown> | unknown): void;
}
export declare function createLogger(scope: string, level?: LogLevel): Logger;
export declare const logger: Logger;
export declare function configureLogging(level: string): void;
