export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown> | unknown): void;
}

export function createLogger(scope: string, level: LogLevel = "info"): Logger {
  const minPriority = LEVEL_PRIORITY[level];

  const write = (
    entryLevel: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ): void => {
    if (LEVEL_PRIORITY[entryLevel] < minPriority) return;
    const payload = {
      timestamp: new Date().toISOString(),
      level: entryLevel,
      scope,
      message,
      ...(meta ? { meta } : {}),
    };
    const line = JSON.stringify(payload);
    if (entryLevel === "error") {
      console.error(line);
      return;
    }
    if (entryLevel === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
  };

  return {
    debug: (message, meta) => write("debug", message, meta),
    info: (message, meta) => write("info", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    error(message: string, meta?: Record<string, unknown> | unknown) {
      const normalized =
        meta && typeof meta === "object" && !Array.isArray(meta)
          ? (meta as Record<string, unknown>)
          : meta !== undefined
            ? { error: meta }
            : undefined;
      write("error", message, normalized);
    },
  };
}

export const logger = createLogger("ave");

export function configureLogging(level: string): void {
  void level;
}
