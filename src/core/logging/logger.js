const LEVEL_PRIORITY = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};
export function createLogger(scope, level = "info") {
    const minPriority = LEVEL_PRIORITY[level];
    const write = (entryLevel, message, meta) => {
        if (LEVEL_PRIORITY[entryLevel] < minPriority)
            return;
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
        error(message, meta) {
            const normalized = meta && typeof meta === "object" && !Array.isArray(meta)
                ? meta
                : meta !== undefined
                    ? { error: meta }
                    : undefined;
            write("error", message, normalized);
        },
    };
}
export const logger = createLogger("ave");
export function configureLogging(level) {
    void level;
}
