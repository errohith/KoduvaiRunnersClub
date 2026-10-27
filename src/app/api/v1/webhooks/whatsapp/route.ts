import { NextResponse } from "next/server";
import { config } from "@/config/env";
import { prisma } from "@/lib/db";
import { safeEqual } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { OPT_IN_KEYWORDS, OPT_OUT_KEYWORDS, parseMetaWebhook, verifyMetaSignature } from "@/server/adapters/whatsapp";
import { applyDeliveryStatus, recordConsent } from "@/server/services/notifications";

/** Meta webhook subscription handshake. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const token = u.searchParams.get("hub.verify_token") ?? "";
  if (u.searchParams.get("hub.mode") === "subscribe" && config.WHATSAPP_WEBHOOK_VERIFY_TOKEN && safeEqual(token, config.WHATSAPP_WEBHOOK_VERIFY_TOKEN)) {
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Delivery statuses and inbound STOP/START keywords. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!config.WHATSAPP_APP_SECRET || !verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), config.WHATSAPP_APP_SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }
  const { statuses, inbound } = parseMetaWebhook(payload);
  for (const s of statuses) await applyDeliveryStatus(s.providerMessageId, s.status, s.error, s.timestamp);
  for (const m of inbound) {
    if (OPT_OUT_KEYWORDS.test(m.text)) await recordConsent(prisma, { phone: m.from, channel: "WHATSAPP", granted: false, source: "whatsapp_stop" });
    else if (OPT_IN_KEYWORDS.test(m.text)) await recordConsent(prisma, { phone: m.from, channel: "WHATSAPP", granted: true, source: "whatsapp_start" });
  }
  logger.debug("whatsapp.webhook", { statuses: statuses.length, inbound: inbound.length });
  return NextResponse.json({ ok: true });
}
