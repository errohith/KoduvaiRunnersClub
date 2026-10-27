import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { enqueueTemplate, processDeliveries, recordConsent } from "@/server/services/notifications";
import { createCampaign, dispatchDueCampaigns, scheduleCampaign } from "@/server/services/campaigns";
import { setEmailAdapterForTests } from "@/server/adapters/email";
import { setWhatsAppAdapterForTests } from "@/server/adapters/whatsapp";
import { ProviderError } from "@/server/adapters/errors";
import { resetData } from "./helpers";

beforeEach(resetData);

const who = { name: "Asha", email: "asha@example.com", phone: "+919876543210" };

async function withWhatsAppTemplate(key: string) {
  await prisma.notificationTemplate.update({ where: { key_channel: { key, channel: "WHATSAPP" } }, data: { whatsappTemplateName: "approved_tpl" } });
}

describe("notification delivery", () => {
  it("is idempotent per business event", async () => {
    const a = await enqueueTemplate("event.reminder", who, {}, { idempotencyBase: "reminder:r1" });
    const b = await enqueueTemplate("event.reminder", who, {}, { idempotencyBase: "reminder:r1" });
    expect(b).toEqual([]);
    expect(a).toHaveLength(1);
    expect(await prisma.notificationDelivery.count({ where: { idempotencyKey: { startsWith: "reminder:r1" } } })).toBe(2); // email queued + whatsapp skipped
  });

  it("records the provider message id on success", async () => {
    const send = vi.fn(async () => ({ providerMessageId: "prov-123" }));
    setEmailAdapterForTests({ name: "mock", send });
    const ids = await enqueueTemplate("payment.confirmed", who, { amount: "₹500" }, { idempotencyBase: "pc:1" });
    await processDeliveries(ids);
    const d = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: ids[0] } });
    expect(d).toMatchObject({ status: "SENT", providerMessageId: "prov-123", attempts: 1 });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "asha@example.com", idempotencyKey: d.idempotencyKey }));
  });

  it("retries retryable failures with backoff, then fails after the retry limit", async () => {
    setEmailAdapterForTests({ name: "mock", send: async () => { throw new ProviderError("HTTP 503", true, 503); } });
    const [id] = await enqueueTemplate("payment.confirmed", who, {}, { idempotencyBase: "pc:retry" });
    await processDeliveries([id]);
    let d = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id } });
    expect(d).toMatchObject({ status: "QUEUED", attempts: 1 });
    expect(d.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    for (let i = 0; i < 3; i++) {
      await prisma.notificationDelivery.update({ where: { id }, data: { nextAttemptAt: new Date(0) } });
      await processDeliveries([id]);
    }
    d = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id } });
    expect(d.status).toBe("FAILED"); // NOTIFICATION_RETRY_LIMIT=3 in tests
    expect(d.lastError).toContain("503");
  });

  it("fails permanent errors immediately", async () => {
    setEmailAdapterForTests({ name: "mock", send: async () => { throw new ProviderError("HTTP 422: invalid recipient", false, 422); } });
    const [id] = await enqueueTemplate("payment.confirmed", who, {}, { idempotencyBase: "pc:perm" });
    await processDeliveries([id]);
    expect((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id } })).status).toBe("FAILED");
  });

  it("never sends the same delivery twice under concurrent workers", async () => {
    const send = vi.fn(async () => ({ providerMessageId: "p" }));
    setEmailAdapterForTests({ name: "mock", send });
    const ids = await enqueueTemplate("payment.confirmed", who, {}, { idempotencyBase: "pc:race" });
    await Promise.all([processDeliveries(ids), processDeliveries(ids), processDeliveries(ids)]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("consent enforcement", () => {
  it("skips WhatsApp without opt-in and sends with opt-in", async () => {
    await withWhatsAppTemplate("event.reminder");
    await enqueueTemplate("event.reminder", who, {}, { idempotencyBase: "c1" });
    expect((await prisma.notificationDelivery.findFirstOrThrow({ where: { idempotencyKey: { startsWith: "c1" }, channel: "WHATSAPP" } })).lastError).toBe("No WhatsApp opt-in");

    await recordConsent(prisma, { phone: who.phone, channel: "WHATSAPP", granted: true, source: "test" });
    const ids = await enqueueTemplate("event.reminder", who, {}, { idempotencyBase: "c2" });
    expect(await prisma.notificationDelivery.count({ where: { id: { in: ids }, channel: "WHATSAPP" } })).toBe(1);
  });

  it("honours an opt-out (STOP) that arrives after the message was queued", async () => {
    await withWhatsAppTemplate("event.reminder");
    await recordConsent(prisma, { phone: who.phone, channel: "WHATSAPP", granted: true, source: "test" });
    const send = vi.fn(async () => ({ providerMessageId: "w" }));
    setWhatsAppAdapterForTests({ name: "mock", send });
    const ids = await enqueueTemplate("event.reminder", who, {}, { idempotencyBase: "c3" });
    await recordConsent(prisma, { phone: who.phone, channel: "WHATSAPP", granted: false, source: "whatsapp_stop" });
    await processDeliveries(ids);
    expect(send).not.toHaveBeenCalled();
    expect(await prisma.notificationDelivery.count({ where: { id: { in: ids }, channel: "WHATSAPP", status: "SKIPPED" } })).toBe(1);
  });

  it("announcement campaigns only reach recipients who opted in, and re-dispatch is idempotent", async () => {
    const admin = await prisma.user.create({ data: { email: "c@club.test", name: "C", passwordHash: "x" } });
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { code: "GENERAL" } });
    for (const [i, optIn] of [true, false, true].entries()) {
      const app = await prisma.membershipApplication.create({
        data: { referenceNo: `T-${i}`, planId: plan.id, feeMinor: 0, currency: "INR", approvalRequired: false, status: "ACTIVE", fullName: `M${i}`, email: `m${i}@x.co`, phoneE164: `+91987650000${i}`, city: "K", experienceLevel: "Walker", termsAcceptedAt: new Date(), privacyAcceptedAt: new Date() },
      });
      await prisma.membership.create({ data: { membershipNo: `KRM-T${i}`, applicationId: app.id, planId: plan.id, fullName: app.fullName, email: app.email, phoneE164: app.phoneE164, startsAt: new Date() } });
      await recordConsent(prisma, { email: app.email, channel: "EMAIL_MARKETING", granted: optIn, source: "test" });
    }
    const c = await createCampaign({ title: "News", subject: "Hello {{name}}", bodyText: "Hi {{name}}", channels: ["EMAIL"], category: "PROMOTIONAL", audience: { type: "ALL_ACTIVE_MEMBERS" } }, admin.id);
    await scheduleCampaign(c.id, null, admin.id);
    expect(await dispatchDueCampaigns()).toBe(1);
    expect(await dispatchDueCampaigns()).toBe(0);
    const rows = await prisma.notificationDelivery.findMany({ where: { campaignId: c.id }, orderBy: { recipientEmail: "asc" } });
    expect(rows.map((r) => [r.recipientEmail, r.status])).toEqual([["m0@x.co", "QUEUED"], ["m1@x.co", "SKIPPED"], ["m2@x.co", "QUEUED"]]);
    expect(rows[0].subject).toBe("Hello M0");
    expect(rows[0].bodyHtml).toContain("Unsubscribe");
    expect((await prisma.notificationCampaign.findUniqueOrThrow({ where: { id: c.id } })).recipientCount).toBe(3);
  });
});
