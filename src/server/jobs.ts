/** Periodic jobs, shared by the long-running worker (src/worker/run.ts) and /api/v1/internal/cron. */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatDateTime } from "@/lib/time";
import { config } from "@/config/env";
import { completeFinishedCampaigns, dispatchDueCampaigns } from "./services/campaigns";
import { enqueueTemplate, processDeliveries, recoverStuckDeliveries } from "./services/notifications";
import { expireMemberships } from "./services/membership";

const REMINDER_WINDOW_HOURS = 48;

export async function sendEventReminders() {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED", startsAt: { gt: now, lte: new Date(now.getTime() + REMINDER_WINDOW_HOURS * 3600_000) } },
    include: { registrations: { where: { status: "CONFIRMED" }, include: { category: true } } },
  });
  let n = 0;
  for (const e of events) {
    for (const r of e.registrations) {
      const ids = await enqueueTemplate(
        "event.reminder",
        { name: r.fullName, email: r.email, phone: r.phoneE164 },
        { eventTitle: e.title, eventDate: formatDateTime(e.startsAt), venue: e.venueName, category: r.category?.name ?? "Volunteer", registrationNo: r.registrationNo, eventUrl: `${config.APP_URL}/events/${e.slug}` },
        { idempotencyBase: `event.reminder:${r.id}`, relatedType: "event_registration", relatedId: r.id },
      );
      n += ids.length;
    }
  }
  return n;
}

export async function housekeeping() {
  const now = new Date();
  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 24 * 3600_000) } } });
  await recoverStuckDeliveries();
  const expired = await expireMemberships();
  if (expired.count) logger.info("memberships.expired", { count: expired.count });
}

let lastSlow = 0;
/** One scheduler tick. Fast jobs every tick; slow jobs at most every 10 minutes. */
export async function tick() {
  const campaigns = await dispatchDueCampaigns();
  let sent = 0;
  for (let i = 0; i < 20; i++) {
    const n = await processDeliveries(undefined, 50);
    sent += n;
    if (n < 50) break;
  }
  await completeFinishedCampaigns();
  let reminders = 0;
  if (Date.now() - lastSlow > 10 * 60_000) {
    lastSlow = Date.now();
    reminders = await sendEventReminders();
    await housekeeping();
  }
  return { campaigns, sent, reminders };
}
