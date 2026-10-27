import { NextResponse } from "next/server";
import { config } from "@/config/env";
import { safeEqual } from "@/lib/crypto";
import { tick } from "@/server/jobs";

/** Serverless alternative to the worker: call every minute with `Authorization: Bearer $CRON_SECRET`. */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!config.CRON_SECRET || !safeEqual(auth, `Bearer ${config.CRON_SECRET}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await tick()) });
}
