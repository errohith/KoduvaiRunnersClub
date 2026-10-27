/**
 * Notification engine.
 *   enqueue  → NotificationDelivery rows (idempotency-keyed, consent-checked)
 *   process  → atomically claim QUEUED rows, send through the channel adapter, record outcome
 *   retry    → retryable provider failures back off exponentially up to NOTIFICATION_RETRY_LIMIT
 * The table doubles as a durable job queue, so bulk sends never run inside a web request.
 */
import type { Channel, ConsentChannel, MessageCategory, NotificationDelivery, Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { config } from "@/config/env";
import { logger } from "@/lib/logger";
import { renderTemplate, escapeHtml } from "@/lib/template";
import { signToken } from "@/lib/crypto";
import { getEmailAdapter } from "../adapters/email";
import { getWhatsAppAdapter } from "../adapters/whatsapp";
import { ProviderError } from "../adapters/errors";
import { loadSettings } from "./settings";

export type Recipient = { name?: string | null; email?: string | null; phone?: string | null };

// ───────────────────────────── Consent ─────────────────────────────

export async function recordConsent(
  tx: Tx,
  rec: { email?: string | null; phone?: string | null; channel: ConsentChannel; granted: boolean; source: string; sourceRef?: string; ip?: string | null },
) {
  await tx.consentRecord.create({
    data: { email: rec.email ?? null, phoneE164: rec.phone ?? null, channel: rec.channel, granted: rec.granted, source: rec.source, sourceRef: rec.sourceRef, ip: rec.ip ?? null },
  });
}

/** Latest consent record wins. No record = not consented. */
export async function hasConsent(channel: ConsentChannel, who: { email?: string | null; phone?: string | null }, tx: Tx = prisma): Promise<boolean> {
  const where: Prisma.ConsentRecordWhereInput =
    channel === "WHATSAPP" ? { channel, phoneE164: who.phone ?? "__none__" } : { channel, email: who.email ?? "__none__" };
  const latest = await tx.consentRecord.findFirst({ where, orderBy: { createdAt: "desc" } });
  return latest?.granted ?? false;
}

/**
 * Policy:
 *  - EMAIL + OPERATIONAL: sent to anyone who gave us their address for that transaction.
 *  - EMAIL + PROMOTIONAL: requires EMAIL_MARKETING opt-in.
 *  - WHATSAPP (any): requires WhatsApp opt-in (WhatsApp Business policy), and honours STOP.
 *  - internal (club admins configured in .env) bypass consent.
 */
export async function consentAllows(channel: Channel, category: MessageCategory, r: Recipient, internal = false, tx: Tx = prisma) {
  if (internal) return { ok: true as const };
  if (channel === "EMAIL") {
    if (category === "OPERATIONAL") return { ok: true as const };
    return (await hasConsent("EMAIL_MARKETING", r, tx)) ? { ok: true as const } : { ok: false as const, reason: "No email marketing consent" };
  }
  return (await hasConsent("WHATSAPP", r, tx)) ? { ok: true as const } : { ok: false as const, reason: "No WhatsApp opt-in" };
}

// ───────────────────────────── Rendering ─────────────────────────────

export async function wrapEmailHtml(innerHtml: string, opts: { unsubscribeUrl?: string } = {}) {
  const s = await loadSettings();
  const brand = s.branding.brandColor;
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${escapeHtml(s.branding.inkColor)};padding:20px 28px;color:#fff;font-size:20px;font-weight:bold">
<span style="color:${escapeHtml(brand)}">&#9679;</span> ${escapeHtml(s.branding.clubName)}</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">${innerHtml}</td></tr>
<tr><td style="padding:16px 28px;background:#fafafa;color:#6b7280;font-size:12px;line-height:1.5">
${escapeHtml(s.branding.clubName)}${s.contact.address ? " · " + escapeHtml(s.contact.address) : ""}<br>
${opts.unsubscribeUrl ? `You received this because you opted in to club updates. <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#6b7280">Unsubscribe</a>.` : "This is a service message about your registration with the club."}
</td></tr></table></td></tr></table></body></html>`;
}

export function textToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function unsubscribeUrl(email: string) {
  return `${config.APP_URL}/unsubscribe?t=${encodeURIComponent(signToken({ e: email, c: "EMAIL_MARKETING" }))}`;
}

// ───────────────────────────── Enqueue ─────────────────────────────

type EnqueueOpts = {
  idempotencyBase: string; // e.g. "membership.received:<applicationId>"
  relatedType?: string;
  relatedId?: string;
  internal?: boolean;
  channels?: Channel[];
};

/**
 * Enqueue template-based notifications for one recipient across every active channel template
 * for `templateKey`. Safe to call repeatedly: idempotency keys prevent duplicates.
 * Returns the ids of QUEUED deliveries (pass them to `kick`).
 */
export async function enqueueTemplate(templateKey: string, to: Recipient, vars: Record<string, unknown>, opts: EnqueueOpts, tx: Tx = prisma): Promise<string[]> {
  const templates = await tx.notificationTemplate.findMany({ where: { key: templateKey, isActive: true } });
  if (!templates.length) {
    logger.warn("notification.template_missing", { templateKey });
    return [];
  }
  const settings = await loadSettings();
  const allVars = { clubName: settings.branding.clubName, appUrl: config.APP_URL, name: to.name ?? "", ...vars };
  const queued: string[] = [];

  for (const t of templates) {
    if (opts.channels && !opts.channels.includes(t.channel)) continue;
    const address = t.channel === "EMAIL" ? to.email : to.phone;
    const idempotencyKey = `${opts.idempotencyBase}:${t.channel}:${address ?? "none"}`;

    let status: "QUEUED" | "SKIPPED" = "QUEUED";
    let lastError: string | null = null;
    if (!address) [status, lastError] = ["SKIPPED", "No contact address for channel"];
    else if (t.channel === "EMAIL" && !config.EMAIL_ENABLED) [status, lastError] = ["SKIPPED", "Email channel disabled (EMAIL_ENABLED=false)"];
    else if (t.channel === "WHATSAPP" && !config.WHATSAPP_ENABLED) [status, lastError] = ["SKIPPED", "WhatsApp channel disabled (WHATSAPP_ENABLED=false)"];
    else if (t.channel === "WHATSAPP" && !t.whatsappTemplateName) [status, lastError] = ["SKIPPED", "No approved WhatsApp template configured"];
    else {
      const c = await consentAllows(t.channel, t.category, to, opts.internal, tx);
      if (!c.ok) [status, lastError] = ["SKIPPED", c.reason];
    }

    const bodyText = renderTemplate(t.bodyText, allVars);
    const promotional = t.category === "PROMOTIONAL" && t.channel === "EMAIL" && to.email;
    const bodyHtml =
      t.channel === "EMAIL"
        ? await wrapEmailHtml(t.bodyHtml ? renderTemplate(t.bodyHtml, allVars, { html: true }) : textToHtml(bodyText), {
            unsubscribeUrl: promotional ? unsubscribeUrl(to.email!) : undefined,
          })
        : null;

    // Idempotent and race-free: INSERT ... ON CONFLICT DO NOTHING on the idempotency key
    // (safe inside a transaction, unlike catching a unique violation).
    const { count } = await tx.notificationDelivery.createMany({
      skipDuplicates: true,
      data: {
        idempotencyKey,
        templateKey,
        channel: t.channel,
        category: t.category,
        recipientName: to.name ?? null,
        recipientEmail: t.channel === "EMAIL" ? to.email : null,
        recipientPhone: t.channel === "WHATSAPP" ? to.phone : null,
        subject: t.subject ? renderTemplate(t.subject, allVars) : null,
        bodyText,
        bodyHtml,
        whatsappTemplate:
          t.channel === "WHATSAPP" && t.whatsappTemplateName
            ? { name: t.whatsappTemplateName, language: t.whatsappLanguage ?? "en", params: t.whatsappParams.map((p) => String(allVars[p as keyof typeof allVars] ?? "")) }
            : undefined,
        status,
        lastError,
        relatedType: opts.relatedType,
        relatedId: opts.relatedId,
      },
    });
    if (count === 0) continue; // already enqueued earlier
    const row = await tx.notificationDelivery.findUniqueOrThrow({ where: { idempotencyKey }, select: { id: true, status: true } });
    if (row.status === "QUEUED") queued.push(row.id);
  }
  return queued;
}

/** Alerts to the club admins listed in CLUB_ADMIN_EMAIL / CLUB_ADMIN_WHATSAPP. */
export async function enqueueAdminAlert(templateKey: string, vars: Record<string, unknown>, opts: Omit<EnqueueOpts, "internal">, tx: Tx = prisma) {
  const ids: string[] = [];
  const max = Math.max(config.CLUB_ADMIN_EMAIL.length, config.CLUB_ADMIN_WHATSAPP.length);
  for (let i = 0; i < max; i++) {
    ids.push(
      ...(await enqueueTemplate(
        templateKey,
        { name: "Club admin", email: config.CLUB_ADMIN_EMAIL[i] ?? null, phone: config.CLUB_ADMIN_WHATSAPP[i] ?? null },
        vars,
        { ...opts, idempotencyBase: `${opts.idempotencyBase}:admin${i}`, internal: true },
        tx,
      )),
    );
  }
  return ids;
}

// ───────────────────────────── Process ─────────────────────────────

export function backoffMs(attempt: number) {
  return Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, attempt - 1)); // 30s, 1m, 2m, 4m ... capped at 1h
}

/** Atomically claim due deliveries (multi-worker safe via SKIP LOCKED). */
export async function claimDueDeliveries(limit: number, ids?: string[]): Promise<string[]> {
  const rows = ids?.length
    ? await prisma.$queryRaw<{ id: string }[]>`
        UPDATE "notification_deliveries" SET "status" = 'SENDING', "attempts" = "attempts" + 1, "updated_at" = now()
        WHERE "id" IN (SELECT "id" FROM "notification_deliveries"
                       WHERE "status" = 'QUEUED' AND "next_attempt_at" <= now() AND "id" = ANY(${ids}::uuid[])
                       FOR UPDATE SKIP LOCKED)
        RETURNING "id"`
    : await prisma.$queryRaw<{ id: string }[]>`
        UPDATE "notification_deliveries" SET "status" = 'SENDING', "attempts" = "attempts" + 1, "updated_at" = now()
        WHERE "id" IN (SELECT "id" FROM "notification_deliveries"
                       WHERE "status" = 'QUEUED' AND "next_attempt_at" <= now()
                       ORDER BY "next_attempt_at" LIMIT ${limit}
                       FOR UPDATE SKIP LOCKED)
        RETURNING "id"`;
  return rows.map((r) => r.id);
}

async function sendClaimed(d: NotificationDelivery) {
  // Re-check consent at send time: the recipient may have opted out since enqueue.
  const internal = d.idempotencyKey.includes(":admin") || d.relatedType === "test";
  const c = await consentAllows(d.channel, d.category, { email: d.recipientEmail, phone: d.recipientPhone }, internal);
  if (!c.ok) {
    await prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: "SKIPPED", lastError: c.reason } });
    return;
  }
  try {
    let providerMessageId: string | null;
    if (d.channel === "EMAIL") {
      ({ providerMessageId } = await getEmailAdapter().send({
        to: d.recipientEmail!,
        toName: d.recipientName,
        subject: d.subject ?? "",
        text: d.bodyText,
        html: d.bodyHtml,
        idempotencyKey: d.idempotencyKey,
        headers: d.category === "PROMOTIONAL" && d.recipientEmail ? { "List-Unsubscribe": `<${unsubscribeUrl(d.recipientEmail)}>` } : undefined,
      }));
    } else {
      const tpl = d.whatsappTemplate as { name: string; language: string; params: string[] } | null;
      if (!tpl) throw new ProviderError("Missing WhatsApp template payload", false);
      ({ providerMessageId } = await getWhatsAppAdapter().send({ to: d.recipientPhone!, template: tpl, idempotencyKey: d.idempotencyKey }));
    }
    await prisma.notificationDelivery.update({
      where: { id: d.id },
      data: { status: "SENT", providerMessageId, sentAt: new Date(), lastError: null },
    });
  } catch (e) {
    const retryable = e instanceof ProviderError ? e.retryable : false;
    const message = (e as Error).message?.slice(0, 500) ?? "Unknown error";
    const canRetry = retryable && d.attempts < config.NOTIFICATION_RETRY_LIMIT;
    await prisma.notificationDelivery.update({
      where: { id: d.id },
      data: canRetry
        ? { status: "QUEUED", lastError: message, nextAttemptAt: new Date(Date.now() + backoffMs(d.attempts)) }
        : { status: "FAILED", lastError: message },
    });
    logger.warn("notification.send_failed", { id: d.id, channel: d.channel, attempt: d.attempts, retrying: canRetry, error: message });
  }
}

export async function processDeliveries(ids?: string[], limit = 50): Promise<number> {
  const claimed = await claimDueDeliveries(limit, ids);
  if (!claimed.length) return 0;
  const rows = await prisma.notificationDelivery.findMany({ where: { id: { in: claimed } } });
  // Modest concurrency keeps us inside provider rate limits.
  const CONCURRENCY = 5;
  for (let i = 0; i < rows.length; i += CONCURRENCY) await Promise.all(rows.slice(i, i + CONCURRENCY).map(sendClaimed));
  return rows.length;
}

/** Recover rows left in SENDING by a crashed worker. Providers receive the same idempotency key. */
export async function recoverStuckDeliveries(olderThanMinutes = 10) {
  return prisma.notificationDelivery.updateMany({
    where: { status: "SENDING", updatedAt: { lt: new Date(Date.now() - olderThanMinutes * 60_000) } },
    data: { status: "QUEUED", lastError: "Recovered after worker interruption" },
  });
}

/**
 * Best-effort immediate send after a request commits. The worker remains the source of
 * truth; if this fails or the process exits, rows stay QUEUED and the worker sends them.
 */
export function kick(ids: string[]) {
  if (!ids.length || process.env.NOTIFICATIONS_INLINE === "false") return;
  const run = () => processDeliveries(ids).catch((e) => logger.error("notification.kick_failed", { err: (e as Error).message }));
  void (async () => {
    try {
      const { after } = await import("next/server");
      after(run);
    } catch {
      void run();
    }
  })();
}

// ───────────────────────────── Provider callbacks ─────────────────────────────

const STATUS_RANK = { QUEUED: 0, SENDING: 1, SENT: 2, DELIVERED: 3, READ: 4, FAILED: 5 } as const;

export async function applyDeliveryStatus(providerMessageId: string, status: "sent" | "delivered" | "read" | "failed", error?: string, at?: Date) {
  const d = await prisma.notificationDelivery.findFirst({ where: { providerMessageId } });
  if (!d) return false;
  const next = status.toUpperCase() as "SENT" | "DELIVERED" | "READ" | "FAILED";
  // Status callbacks can arrive out of order; never move backwards.
  const current = STATUS_RANK[d.status as keyof typeof STATUS_RANK] ?? 0;
  if (next !== "FAILED" && STATUS_RANK[next] <= current) return true;
  await prisma.notificationDelivery.update({
    where: { id: d.id },
    data: {
      status: next,
      lastError: next === "FAILED" ? (error ?? "Provider reported failure") : d.lastError,
      deliveredAt: next === "DELIVERED" || next === "READ" ? (d.deliveredAt ?? at ?? new Date()) : d.deliveredAt,
    },
  });
  return true;
}

// ───────────────────────────── Test sends ─────────────────────────────

export async function testSendTemplate(templateId: string, to: { email?: string; phone?: string }, sample: Record<string, unknown>) {
  const t = await prisma.notificationTemplate.findUniqueOrThrow({ where: { id: templateId } });
  const id = `test:${t.key}:${t.channel}:${Date.now()}`;
  const ids = await enqueueTemplate(t.key, { name: "Test recipient", ...to }, sample, { idempotencyBase: id, relatedType: "test", internal: true, channels: [t.channel] });
  await processDeliveries(ids);
  return prisma.notificationDelivery.findMany({ where: { idempotencyKey: { startsWith: id } } });
}

export const SAMPLE_VARS: Record<string, string> = {
  name: "Priya",
  referenceNo: "KR-M-2026-000001",
  planName: "General Member",
  fee: "₹500",
  status: "Approved",
  note: "Welcome aboard!",
  membershipNo: "KRM-00001",
  eventTitle: "Koduvai Sunrise Half Marathon",
  eventDate: "12 Jan 2027, 5:30 am",
  venue: "Koduvai Bus Stand Grounds",
  category: "21.1K Half Marathon",
  registrationNo: "KR-E-2026-000001",
  paymentReference: "KR-PAY-2026-000001",
  amount: "₹500",
  statusUrl: "https://example.org/payment/status?ref=KR-PAY-2026-000001",
  applicantEmail: "priya@example.com",
  applicantPhone: "+919876543210",
  message: "Route update: the 10K turnaround moves 200m north.",
  reason: "Heavy rain forecast",
};
