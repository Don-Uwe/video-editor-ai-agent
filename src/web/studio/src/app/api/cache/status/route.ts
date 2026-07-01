import { NextResponse } from "next/server";

import { loadRedisConfig, pingRedis } from "@/lib/redis";

export const runtime = "nodejs";

export async function GET() {
  const config = loadRedisConfig();
  const connected = config.enabled ? await pingRedis() : false;

  return NextResponse.json({
    enabled: config.enabled,
    connected,
    url: config.url.replace(/:[^:@/]+@/, ":***@"),
    keyPrefix: config.keyPrefix,
  });
}
