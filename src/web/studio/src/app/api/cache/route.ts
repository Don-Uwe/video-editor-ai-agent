import { NextRequest, NextResponse } from "next/server";

import { deleteKey, getJson, setJson } from "@/lib/redis";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
  }
  const value = await getJson<unknown>(key);
  if (value === null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ key, value });
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as { key?: string; value?: unknown };
  if (!body.key) {
    return NextResponse.json({ error: "Missing key in body" }, { status: 400 });
  }
  const stored = await setJson(body.key, body.value ?? null);
  if (!stored) {
    return NextResponse.json({ error: "Redis unavailable" }, { status: 503 });
  }
  return NextResponse.json({ key: body.key, stored: true });
}

export async function DELETE(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
  }
  await deleteKey(key);
  return new NextResponse(null, { status: 204 });
}
