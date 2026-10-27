import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { decideApplication, submitApplication } from "@/server/services/membership";
import { initiateCheckout, recordOfflinePayment } from "@/server/services/payments";
import { saveSettingsGroup, DEFAULT_SETTINGS } from "@/server/services/settings";
import { applicationInput, plan, resetData } from "./helpers";

async function adminUser() {
  return prisma.user.create({ data: { email: `admin${Date.now()}@club.test`, name: "Admin", passwordHash: "x" } });
}

beforeEach(resetData);

describe("seeded membership plans", () => {
  it("has the five initial plans with the exact specified fees in INR", async () => {
    const plans = await prisma.membershipPlan.findMany({ orderBy: { sortOrder: "asc" } });
    expect(plans.map((p) => [p.name, p.feeMinor / 100, p.currency])).toEqual([
      ["Founding Member", 1000, "INR"],
      ["General Member", 500, "INR"],
      ["Student Member", 250, "INR"],
      ["Volunteer Member", 0, "INR"],
      ["Honorary Member", 0, "INR"],
    ]);
  });
});

describe("membership applications", () => {
  it("persists a paid application as PENDING with a unique reference and fee snapshot", async () => {
    const general = await plan("GENERAL");
    const r = await submitApplication(applicationInput(general.id), "1.2.3.4");
    expect(r.status).toBe("PENDING");
    expect(r.referenceNo).toMatch(/^KR-M-\d{4}-\d{6}$/);
    const app = await prisma.membershipApplication.findUniqueOrThrow({ where: { referenceNo: r.referenceNo }, include: { history: true } });
    expect(app.feeMinor).toBe(50000);
    expect(app.history.map((h) => h.toStatus)).toEqual(["PENDING"]);
    // Changing the plan fee later does not change what this applicant was quoted.
    await prisma.membershipPlan.update({ where: { id: general.id }, data: { feeMinor: 60000 } });
    expect((await prisma.membershipApplication.findUniqueOrThrow({ where: { id: app.id } })).feeMinor).toBe(50000);
    await prisma.membershipPlan.update({ where: { id: general.id }, data: { feeMinor: 50000 } });
  });

  it("rejects duplicates by email or phone, including concurrent submissions", async () => {
    const general = await plan("GENERAL");
    const input = applicationInput(general.id);
    await submitApplication(input, null);
    await expect(submitApplication({ ...input, phone: "+919000000001" }, null)).rejects.toMatchObject({ code: "duplicate_application" });
    await expect(submitApplication({ ...input, email: "other@example.com" }, null)).rejects.toMatchObject({ code: "duplicate_application" });

    const racer = applicationInput(general.id);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => submitApplication(racer, null)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.membershipApplication.count({ where: { email: racer.email } })).toBe(1);
  });

  it("requires student verification for the student plan", async () => {
    const student = await plan("STUDENT");
    await expect(submitApplication(applicationInput(student.id), null)).rejects.toMatchObject({ code: "validation_failed" });
    const ok = await submitApplication(applicationInput(student.id, { studentInstitution: "Govt Arts College", studentIdNumber: "S123" }), null);
    expect(ok.status).toBe("PENDING");
  });

  it("free plan with approval not required becomes ACTIVE immediately, with no payment", async () => {
    await saveSettingsGroup("membership", { ...DEFAULT_SETTINGS.membership, requireApproval: false }, (await adminUser()).id);
    const volunteer = await plan("VOLUNTEER");
    const r = await submitApplication(applicationInput(volunteer.id), null);
    expect(r.status).toBe("ACTIVE");
    const app = await prisma.membershipApplication.findUniqueOrThrow({ where: { referenceNo: r.referenceNo }, include: { membership: true, payments: true } });
    expect(app.membership?.membershipNo).toMatch(/^KRM-\d{5}$/);
    expect(app.payments).toHaveLength(0);
  });

  it("paid plan: approval creates a pending payment, but never activates while payments are disabled", async () => {
    const admin = await adminUser();
    const founding = await plan("FOUNDING");
    const r = await submitApplication(applicationInput(founding.id), null);
    const app = await prisma.membershipApplication.findUniqueOrThrow({ where: { referenceNo: r.referenceNo } });

    await decideApplication(app.id, "approve", "Welcome", admin.id);
    const approved = await prisma.membershipApplication.findUniqueOrThrow({ where: { id: app.id }, include: { payments: true, membership: true } });
    expect(approved.status).toBe("APPROVED");
    expect(approved.membership).toBeNull();
    expect(approved.payments).toHaveLength(1);
    expect(approved.payments[0]).toMatchObject({ purpose: "MEMBERSHIP", status: "PENDING", amountMinor: 100000, eventRegistrationId: null });

    await expect(initiateCheckout(approved.payments[0].reference)).rejects.toMatchObject({ code: "payments_disabled" });
    const still = await prisma.membershipApplication.findUniqueOrThrow({ where: { id: app.id } });
    expect(still.status).toBe("APPROVED");

    // An admin-verified offline payment completes activation.
    await recordOfflinePayment(approved.payments[0].reference, "UPI ref 123456", admin.id);
    const active = await prisma.membershipApplication.findUniqueOrThrow({ where: { id: app.id }, include: { membership: true, payments: true, history: true } });
    expect(active.status).toBe("ACTIVE");
    expect(active.membership?.status).toBe("ACTIVE");
    expect(active.payments[0].status).toBe("SUCCEEDED");
    expect(active.history.map((h) => h.toStatus)).toEqual(["PENDING", "APPROVED", "ACTIVE"]);
    expect(await prisma.auditLog.count({ where: { action: "payment.offline_recorded" } })).toBe(1);
  });

  it("free plan approval activates without payment; rejection requires a reason and closes payments", async () => {
    const admin = await adminUser();
    const honorary = await plan("HONORARY");
    const a = await submitApplication(applicationInput(honorary.id), null);
    const appA = await prisma.membershipApplication.findUniqueOrThrow({ where: { referenceNo: a.referenceNo } });
    await decideApplication(appA.id, "approve", undefined, admin.id);
    expect((await prisma.membershipApplication.findUniqueOrThrow({ where: { id: appA.id } })).status).toBe("ACTIVE");

    const general = await plan("GENERAL");
    const b = await submitApplication(applicationInput(general.id), null);
    const appB = await prisma.membershipApplication.findUniqueOrThrow({ where: { referenceNo: b.referenceNo } });
    await expect(decideApplication(appB.id, "reject", undefined, admin.id)).rejects.toMatchObject({ code: "bad_request" });
    await decideApplication(appB.id, "reject", "Incomplete details", admin.id);
    const rejected = await prisma.membershipApplication.findUniqueOrThrow({ where: { id: appB.id } });
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.decisionNote).toBe("Incomplete details");
    await expect(decideApplication(appB.id, "approve", undefined, admin.id)).rejects.toMatchObject({ code: "invalid_transition" });
    // A rejected applicant may apply again.
    await expect(submitApplication(applicationInput(general.id, { email: rejected.email, phone: rejected.phoneE164 }), null)).resolves.toMatchObject({ status: "PENDING" });
  });

  it("queues an acknowledgement to the applicant and an alert to club admins", async () => {
    const general = await plan("GENERAL");
    const r = await submitApplication(applicationInput(general.id, { consentWhatsapp: true }), null);
    const app = await prisma.membershipApplication.findUniqueOrThrow({ where: { referenceNo: r.referenceNo } });
    const deliveries = await prisma.notificationDelivery.findMany({ where: { relatedId: app.id } });
    const ack = deliveries.find((d) => d.templateKey === "membership.application.received" && d.channel === "EMAIL");
    expect(ack).toMatchObject({ status: "QUEUED", recipientEmail: app.email });
    expect(ack?.subject).toContain(r.referenceNo);
    expect(deliveries.find((d) => d.templateKey === "membership.application.admin_alert" && d.channel === "EMAIL")).toMatchObject({ recipientEmail: "admin@club.test" });
    // WhatsApp is opted in, but no approved template is configured yet → skipped, not faked.
    expect(deliveries.find((d) => d.templateKey === "membership.application.received" && d.channel === "WHATSAPP")).toMatchObject({ status: "SKIPPED", lastError: "No approved WhatsApp template configured" });
  });
});
