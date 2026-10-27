import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { decideApplication, submitApplication } from "@/server/services/membership";
import { recordOfflinePayment } from "@/server/services/payments";
import { recordConsent } from "@/server/services/notifications";
import { deleteMember, previewMemberDeletion } from "@/server/services/member-deletion";
import { ROLES } from "@/lib/auth/permissions";
import { applicationInput, plan, resetData } from "./helpers";

beforeEach(resetData);
const admin = () => prisma.user.create({ data: { email: `sa${Date.now()}@club.test`, name: "SA", passwordHash: "x" } });

describe("deleting a member", () => {
  it("only Super Admin holds members.delete", () => {
    for (const [key, role] of Object.entries(ROLES)) expect(role.permissions.includes("members.delete")).toBe(key === "SUPER_ADMIN");
  });

  it("requires typing the reference number", async () => {
    const a = await admin();
    const r = await submitApplication(applicationInput((await plan("GENERAL")).id), null);
    const app = await prisma.membershipApplication.findUniqueOrThrow({ where: { referenceNo: r.referenceNo } });
    await expect(deleteMember(app.id, "wrong", a.id)).rejects.toMatchObject({ code: "bad_request" });
    expect(await prisma.membershipApplication.count({ where: { id: app.id } })).toBe(1);
  });

  it("permanently deletes an unpaid member and their message log, but keeps opt-outs; they can re-apply", async () => {
    const a = await admin();
    const input = applicationInput((await plan("GENERAL")).id, { consentWhatsapp: true });
    const r = await submitApplication(input, null);
    const app = await prisma.membershipApplication.findUniqueOrThrow({ where: { referenceNo: r.referenceNo } });
    await decideApplication(app.id, "approve", undefined, a.id); // creates a PENDING (unpaid) payment
    await recordConsent(prisma, { phone: app.phoneE164, channel: "WHATSAPP", granted: false, source: "whatsapp_stop" });

    expect((await previewMemberDeletion(app.id)).mode).toBe("delete");
    await deleteMember(app.id, r.referenceNo.toLowerCase(), a.id);

    expect(await prisma.membershipApplication.count({ where: { id: app.id } })).toBe(0);
    expect(await prisma.membershipStatusHistory.count({ where: { applicationId: app.id } })).toBe(0);
    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.notificationDelivery.count({ where: { recipientEmail: app.email } })).toBe(0);
    expect(await prisma.consentRecord.count({ where: { phoneE164: app.phoneE164, granted: false } })).toBe(1);
    expect(await prisma.consentRecord.count({ where: { sourceRef: app.id } })).toBe(0);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "membership.deleted" } });
    expect(JSON.stringify(log.metadata)).not.toContain(app.email);
    await expect(submitApplication(input, null)).resolves.toMatchObject({ status: "PENDING" });
  });

  it("anonymises a paid member and keeps the payment for accounting", async () => {
    const a = await admin();
    const r = await submitApplication(applicationInput((await plan("FOUNDING")).id), null);
    const app = await prisma.membershipApplication.findUniqueOrThrow({ where: { referenceNo: r.referenceNo } });
    await decideApplication(app.id, "approve", "Welcome", a.id);
    const pay = await prisma.payment.findFirstOrThrow({ where: { membershipApplicationId: app.id } });
    await recordOfflinePayment(pay.reference, "UPI 123", a.id);

    const out = await deleteMember(app.id, r.referenceNo, a.id);
    expect(out).toMatchObject({ mode: "anonymise", paymentsKept: 1 });

    const after = await prisma.membershipApplication.findUniqueOrThrow({ where: { id: app.id }, include: { membership: true, history: true } });
    expect(after).toMatchObject({ fullName: "Deleted member", status: "CANCELLED", emergencyName: null, decisionNote: null, address: null });
    expect(after.email).not.toContain("@example.com");
    expect(after.membership).toMatchObject({ fullName: "Deleted member", status: "CANCELLED" });
    expect(after.history.every((h) => h.note === null)).toBe(true);
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } })).toMatchObject({ status: "SUCCEEDED", amountMinor: 100000 });
    expect(await prisma.notificationDelivery.count({ where: { recipientEmail: app.email } })).toBe(0);
  });
});
