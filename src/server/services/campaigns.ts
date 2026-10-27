/**
 * Club-wide announcements. A campaign is dispatched by the worker (never inside a web request):
 * the audience is resolved once and snapshotted into NotificationDelivery rows, one per
 * (campaign, channel, recipient) — the idempotency key makes re-dispatch harmless.
 */
import type { Channel, NotificationCampaign } from "@prisma/client";
import { prisma } from "@/lib/db";
import { config } from "@/config/env";
import { conflict, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { renderTemplate } from "@/lib/template";
import { logger } from "@/lib/logger";
import { audienceSchema, type Audience, type CampaignInput } from "@/validation/schemas";
import { consentAllows, processDeliveries, textToHtml, unsubscribeUrl, wrapEmailHtml } from "./notifications";
import { loadSettings } from "./settings";

export type AudienceMember = { name: string; email: string | null; phone: string | null };

export async function resolveAudience(audience: Audience): Promise<AudienceMember[]> {
  let rows: { fullName: string; email: string; phoneE164: string }[] = [];
  switch (audience.type) {
    case "ALL_ACTIVE_MEMBERS":
      rows = await prisma.membership.findMany({ where: { status: "ACTIVE" }, select: { fullName: true, email: true, phoneE164: true } });
      break;
    case "PLAN":
      rows = await prisma.membership.findMany({ where: { status: "ACTIVE", planId: audience.planId }, select: { fullName: true, email: true, phoneE164: true } });
      break;
    case "ALL_APPROVED_OR_ACTIVE":
      rows = await prisma.membershipApplication.findMany({ where: { status: { in: ["APPROVED", "ACTIVE"] } }, select: { fullName: true, email: true, phoneE164: true } });
      break;
    case "EVENT_PARTICIPANTS":
      rows = await prisma.eventRegistration.findMany({
        where: { eventId: audience.eventId, participantType: "PARTICIPANT", status: { in: ["CONFIRMED", "PENDING_PAYMENT"] } },
        select: { fullName: true, email: true, phoneE164: true },
      });
      break;
    case "EVENT_VOLUNTEERS":
      rows = await prisma.eventRegistration.findMany({
        where: { eventId: audience.eventId, participantType: "VOLUNTEER", status: "CONFIRMED" },
        select: { fullName: true, email: true, phoneE164: true },
      });
      break;
  }
  const seen = new Set<string>();
  const out: AudienceMember[] = [];
  for (const r of rows) {
    const key = r.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: r.fullName, email: r.email, phone: r.phoneE164 });
  }
  return out;
}

/** Recipient count preview per channel, after consent filtering. */
export async function previewAudience(audience: Audience, channels: Channel[], category: "OPERATIONAL" | "PROMOTIONAL") {
  const members = await resolveAudience(audience);
  const counts: Record<string, number> = { total: members.length };
  for (const ch of channels) {
    let n = 0;
    for (const m of members) if ((ch === "EMAIL" ? m.email : m.phone) && (await consentAllows(ch, category, m)).ok) n++;
    counts[ch] = n;
  }
  return counts;
}

function assertEnabled() {
  if (!config.MEMBER_ANNOUNCEMENTS_ENABLED) throw conflict("announcements_disabled", "Announcements are disabled (MEMBER_ANNOUNCEMENTS_ENABLED=false).");
}

export async function createCampaign(input: CampaignInput, actorId: string) {
  assertEnabled();
  const c = await prisma.notificationCampaign.create({
    data: {
      title: input.title,
      subject: input.subject,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml,
      whatsappTemplateName: input.whatsappTemplateName,
      whatsappLanguage: input.whatsappLanguage ?? "en",
      channels: input.channels,
      category: input.category,
      audience: input.audience,
      status: "DRAFT",
      createdById: actorId,
    },
  });
  await audit({ actorId, action: "campaign.created", entityType: "campaign", entityId: c.id, metadata: { audience: input.audience, channels: input.channels } });
  return c;
}

export async function scheduleCampaign(id: string, when: Date | null, actorId: string) {
  assertEnabled();
  const c = await prisma.notificationCampaign.findUnique({ where: { id } });
  if (!c) throw notFound("Campaign");
  if (!["DRAFT", "SCHEDULED"].includes(c.status)) throw conflict("campaign_locked", `Campaign is already ${c.status.toLowerCase()}.`);
  const scheduledAt = when ?? new Date();
  await prisma.notificationCampaign.update({ where: { id }, data: { status: "SCHEDULED", scheduledAt } });
  await audit({ actorId, action: when ? "campaign.scheduled" : "campaign.send_now", entityType: "campaign", entityId: id, metadata: { scheduledAt: scheduledAt.toISOString() } });
}

export async function cancelCampaign(id: string, actorId: string) {
  const c = await prisma.notificationCampaign.findUnique({ where: { id } });
  if (!c) throw notFound("Campaign");
  if (["COMPLETED", "CANCELLED"].includes(c.status)) throw conflict("campaign_locked", `Campaign is already ${c.status.toLowerCase()}.`);
  await prisma.$transaction([
    prisma.notificationCampaign.update({ where: { id }, data: { status: "CANCELLED" } }),
    prisma.notificationDelivery.updateMany({ where: { campaignId: id, status: "QUEUED" }, data: { status: "CANCELLED", lastError: "Campaign cancelled" } }),
  ]);
  await audit({ actorId, action: "campaign.cancelled", entityType: "campaign", entityId: id });
}

export async function retryFailed(id: string, actorId: string) {
  const r = await prisma.notificationDelivery.updateMany({
    where: { campaignId: id, status: "FAILED" },
    data: { status: "QUEUED", attempts: 0, nextAttemptAt: new Date(), lastError: null },
  });
  if (r.count) await prisma.notificationCampaign.update({ where: { id }, data: { status: "SENDING", completedAt: null } });
  await audit({ actorId, action: "campaign.retry_failed", entityType: "campaign", entityId: id, metadata: { count: r.count } });
  return r.count;
}

async function buildDeliveries(c: NotificationCampaign, members: AudienceMember[]) {
  const settings = await loadSettings();
  const rows = [];
  for (const m of members) {
    const vars = { name: m.name, clubName: settings.branding.clubName, appUrl: config.APP_URL };
    for (const channel of c.channels) {
      const address = channel === "EMAIL" ? m.email : m.phone;
      if (!address) continue;
      const enabled = channel === "EMAIL" ? config.EMAIL_ENABLED : config.WHATSAPP_ENABLED;
      const consent = await consentAllows(channel, c.category, m);
      const text = renderTemplate(c.bodyText, vars);
      rows.push({
        idempotencyKey: `campaign:${c.id}:${channel}:${address}`,
        campaignId: c.id,
        channel,
        category: c.category,
        recipientName: m.name,
        recipientEmail: channel === "EMAIL" ? m.email : null,
        recipientPhone: channel === "WHATSAPP" ? m.phone : null,
        subject: channel === "EMAIL" ? renderTemplate(c.subject ?? c.title, vars) : null,
        bodyText: text,
        bodyHtml:
          channel === "EMAIL"
            ? await wrapEmailHtml(c.bodyHtml ? renderTemplate(c.bodyHtml, vars, { html: true }) : textToHtml(text), {
                unsubscribeUrl: c.category === "PROMOTIONAL" ? unsubscribeUrl(m.email!) : undefined,
              })
            : null,
        // Announcement WhatsApp templates take {{1}} = recipient name, {{2}} = message text.
        whatsappTemplate: channel === "WHATSAPP" ? { name: c.whatsappTemplateName, language: c.whatsappLanguage ?? "en", params: [m.name, text.slice(0, 1000)] } : undefined,
        status: !enabled ? ("SKIPPED" as const) : consent.ok ? ("QUEUED" as const) : ("SKIPPED" as const),
        lastError: !enabled ? `${channel} channel disabled` : consent.ok ? null : consent.reason,
        relatedType: "campaign",
        relatedId: c.id,
      });
    }
  }
  return rows;
}

/** Worker: snapshot recipients for every due SCHEDULED campaign. Multi-worker safe. */
export async function dispatchDueCampaigns(): Promise<number> {
  const due = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "notification_campaigns" SET "status" = 'SENDING', "dispatched_at" = now(), "updated_at" = now()
    WHERE "id" IN (SELECT "id" FROM "notification_campaigns" WHERE "status" = 'SCHEDULED' AND "scheduled_at" <= now()
                   FOR UPDATE SKIP LOCKED)
    RETURNING "id"`;
  for (const { id } of due) {
    const c = await prisma.notificationCampaign.findUniqueOrThrow({ where: { id } });
    try {
      const members = await resolveAudience(audienceSchema.parse(c.audience));
      const rows = await buildDeliveries(c, members);
      for (let i = 0; i < rows.length; i += 500) {
        await prisma.notificationDelivery.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
      }
      await prisma.notificationCampaign.update({ where: { id }, data: { recipientCount: rows.length } });
    } catch (e) {
      logger.error("campaign.dispatch_failed", { id, err: (e as Error).message });
      await prisma.notificationCampaign.update({ where: { id }, data: { status: "SCHEDULED", scheduledAt: new Date(Date.now() + 60_000) } });
    }
  }
  return due.length;
}

/** Worker: mark SENDING campaigns complete once nothing is queued or in flight. */
export async function completeFinishedCampaigns() {
  const sending = await prisma.notificationCampaign.findMany({ where: { status: "SENDING" }, select: { id: true } });
  for (const { id } of sending) {
    const open = await prisma.notificationDelivery.count({ where: { campaignId: id, status: { in: ["QUEUED", "SENDING"] } } });
    if (!open) await prisma.notificationCampaign.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });
  }
}

export async function campaignStats(id: string) {
  const groups = await prisma.notificationDelivery.groupBy({ by: ["channel", "status"], where: { campaignId: id }, _count: true });
  return groups.map((g) => ({ channel: g.channel, status: g.status, count: g._count }));
}

export async function testSendCampaign(id: string, to: { email?: string; phone?: string }) {
  const c = await prisma.notificationCampaign.findUnique({ where: { id } });
  if (!c) throw notFound("Campaign");
  const member: AudienceMember = { name: "Test recipient", email: to.email ?? null, phone: to.phone ?? null };
  const rows = (await buildDeliveries(c, [member])).map((r) => ({
    ...r,
    idempotencyKey: `test:${r.idempotencyKey}:${Date.now()}`,
    campaignId: null,
    relatedType: "test",
    // Test sends go to the admin's own address; consent is implied by the admin requesting it.
    status: r.lastError?.includes("disabled") ? ("SKIPPED" as const) : ("QUEUED" as const),
    lastError: r.lastError?.includes("disabled") ? r.lastError : null,
  }));
  await prisma.notificationDelivery.createMany({ data: rows });
  const ids = (await prisma.notificationDelivery.findMany({ where: { idempotencyKey: { in: rows.map((r) => r.idempotencyKey) } }, select: { id: true } })).map((r) => r.id);
  await processDeliveries(ids);
  return prisma.notificationDelivery.findMany({ where: { id: { in: ids } } });
}
