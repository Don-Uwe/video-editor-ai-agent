import { NextResponse } from "next/server";

import { loadConfig, pingRedis } from "@ave/core";

export const runtime = "nodejs";

export async function GET() {
  const config = loadConfig();
  const connected = config.redisEnabled ? await pingRedis() : false;

  return NextResponse.json({
    enabled: config.redisEnabled,
    connected,
    url: config.redisUrl?.replace(/:[^:@/]+@/, ":***@") ?? null,
    keyPrefix: config.redisKeyPrefix,
  });
}
