import type { Context } from "hono";
import type { WSContext } from "hono/ws";
import { logger } from "@ave/core";
import { JobRegistry, STREAM_END } from "../jobs/registry.js";

export const UNKNOWN_JOB_CLOSE_CODE = 4004;
export const INTERNAL_ERROR_CLOSE_CODE = 1011;

function progressMessage(entry: { line: string; timestamp: string }) {
  return {
    type: "progress",
    line: entry.line,
    timestamp: entry.timestamp,
  };
}

export function jobWebSocketHandler(registry: JobRegistry) {
  return (c: Context) => {
    const jobId = c.req.param("jobId") ?? "";

    return {
      onOpen(_event: Event, ws: WSContext) {
        const job = registry.get(jobId);
        if (!job) {
          ws.close(UNKNOWN_JOB_CLOSE_CODE);
          return;
        }

        void (async () => {
          const [queue, replay, terminalAtSubscribe] = job.subscribe();

          try {
            for (const entry of replay) {
              ws.send(JSON.stringify(progressMessage(entry)));
            }

            if (terminalAtSubscribe) {
              job.enqueueTerminal(queue);
            }

            while (true) {
              const event = await queue.get();
              if (event === STREAM_END) break;
              ws.send(JSON.stringify(event));
            }

            ws.close();
          } catch (err) {
            logger.error(`WebSocket stream for job ${jobId} crashed`, err);
            try {
              ws.close(INTERNAL_ERROR_CLOSE_CODE);
            } catch {
              // ignore close failures
            }
          } finally {
            job.removeSubscriber(queue);
          }
        })();
      },
    };
  };
}
