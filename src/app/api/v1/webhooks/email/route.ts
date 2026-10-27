import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/config/env";
import { safeEqual } from "@/lib/crypto";
import { applyDeliveryStatus } from "@/server/services/notifications";

/**
 * Provider-neutral email delivery callback. Point your provider's webhook (or a small relay)
 * here with header `x-webhook-secret: $EMAIL_WEBHOOK_SECRET` and body
 *   { "events": [{ "providerMessageId": "...", "status": "delivered" | "failed", "error"?: "..." }] }
 * Provider-specific payloads (e.g. Resend/Svix signatures) need a small adapter — see docs/INTEGRATIONS.md.
 */
const schema = z.object({ events: z.array(z.object({ providerMessageId: z.string(), status: z.enum(["sent", "delivered", "failed"]), error: z.string().optional() })).max(500) });

export async function POST(req: Request) {
  const secret = req.headers.get("x-webhook-secret") ?? "";
  if (!config.EMAIL_WEBHOOK_SECRET || !safeEqual(secret, config.EMAIL_WEBHOOK_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  let matched = 0;
  for (const e of parsed.data.events) if (await applyDeliveryStatus(e.providerMessageId, e.status, e.error)) matched++;
  return NextResponse.json({ ok: true, matched });
}
