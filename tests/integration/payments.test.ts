import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { hmacHex } from "@/lib/crypto";
import { decideApplication, submitApplication } from "@/server/services/membership";
import { registerForEvent } from "@/server/services/events";
import { handlePaymentWebhook } from "@/server/services/payments";
import { createMockAdapter, setPaymentAdapterForTests } from "@/server/adapters/payment";
import { applicationInput, makeEvent, plan, registrationInput, resetData } from "./helpers";

const SECRET = "test-webhook-secret";
const signed = (body: object) => {
  const raw = JSON.stringify(body);
  return { raw, headers: new Headers({ "x-mock-signature": hmacHex(SECRET, raw) }) };
};

async function approvedMembershipPayment() {
  const admin = await prisma.user.create({ data: { email: `a${randomUUID()}@club.test`, name: "A", passwordHash: "x" } });
  const r = await submitApplication(applicationInput((await plan("GENERAL")).id), null);
  const app = await prisma.membershipApplication.findUniqueOrThrow({ where: { referenceNo: r.referenceNo } });
  await decideApplication(app.id, "approve", undefined, admin.id);
  return { app, payment: await prisma.payment.findFirstOrThrow({ where: { membershipApplicationId: app.id } }) };
}

beforeEach(async () => {
  await resetData();
  setPaymentAdapterForTests(createMockAdapter({ appUrl: "http://localhost:3000", webhookSecret: SECRET }));
});

describe("payment records", () => {
  it("keeps membership and event payments separate and linked to exactly one business object", async () => {
    const { payment: mp } = await approvedMembershipPayment();
    const ev = await makeEvent({ feeMinor: 30000 });
    const r = await registerForEvent(registrationInput(ev.id, ev.categories[0].id), null);
    const ep = await prisma.payment.findUniqueOrThrow({ where: { reference: r.paymentReference! } });
    expect(mp).toMatchObject({ purpose: "MEMBERSHIP", eventRegistrationId: null });
    expect(ep).toMatchObject({ purpose: "EVENT_REGISTRATION", membershipApplicationId: null });
    expect(mp.reference).not.toBe(ep.reference);
    // DB constraint: a payment cannot point at both, or mismatch its purpose.
    await expect(prisma.payment.update({ where: { id: ep.id }, data: { membershipApplicationId: mp.membershipApplicationId } })).rejects.toThrow(/payments_single_target/);
  });

  it("free events complete without any payment transaction", async () => {
    const ev = await makeEvent({ feeMinor: 0 });
    const r = await registerForEvent(registrationInput(ev.id, ev.categories[0].id), null);
    expect(r.status).toBe("CONFIRMED");
    expect(r.paymentReference).toBeNull();
    expect(await prisma.payment.count()).toBe(0);
  });
});

describe("payment webhooks", () => {
  it("rejects invalid signatures without changing state", async () => {
    const { payment } = await approvedMembershipPayment();
    const raw = JSON.stringify({ id: "evt_bad", type: "payment.succeeded", reference: payment.reference, amountMinor: payment.amountMinor });
    const out = await handlePaymentWebhook("mock", raw, new Headers({ "x-mock-signature": hmacHex("wrong", raw) }));
    expect(out.status).toBe(401);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
    expect(await prisma.paymentWebhookEvent.count()).toBe(0);
  });

  it("a verified success activates the membership exactly once, even when the webhook is replayed", async () => {
    const { app, payment } = await approvedMembershipPayment();
    const { raw, headers } = signed({ id: "evt_ok_1", type: "payment.succeeded", reference: payment.reference, amountMinor: payment.amountMinor });
    expect((await handlePaymentWebhook("mock", raw, headers)).status).toBe(200);
    const replay = await handlePaymentWebhook("mock", raw, headers);
    expect(replay).toMatchObject({ status: 200, body: { duplicate: true } });

    const after = await prisma.membershipApplication.findUniqueOrThrow({ where: { id: app.id }, include: { membership: true, history: true } });
    expect(after.status).toBe("ACTIVE");
    expect(after.history.filter((h) => h.toStatus === "ACTIVE")).toHaveLength(1);
    expect(await prisma.membership.count({ where: { applicationId: app.id } })).toBe(1);
    expect(await prisma.paymentWebhookEvent.count()).toBe(1);
    expect(await prisma.notificationDelivery.count({ where: { templateKey: "payment.confirmed", channel: "EMAIL" } })).toBe(1);
  });

  it("a verified success confirms a pending event registration", async () => {
    const ev = await makeEvent({ feeMinor: 30000 });
    const r = await registerForEvent(registrationInput(ev.id, ev.categories[0].id), null);
    const { raw, headers } = signed({ id: "evt_ev_1", type: "payment.succeeded", reference: r.paymentReference, amountMinor: 30000 });
    expect((await handlePaymentWebhook("mock", raw, headers)).status).toBe(200);
    expect((await prisma.eventRegistration.findUniqueOrThrow({ where: { registrationNo: r.registrationNo } })).status).toBe("CONFIRMED");
  });

  it("does not mark paid on amount mismatch and records the error for retry", async () => {
    const { app, payment } = await approvedMembershipPayment();
    const { raw, headers } = signed({ id: "evt_mismatch", type: "payment.succeeded", reference: payment.reference, amountMinor: 1 });
    expect((await handlePaymentWebhook("mock", raw, headers)).status).toBe(500);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
    expect((await prisma.membershipApplication.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("APPROVED");
    expect((await prisma.paymentWebhookEvent.findFirstOrThrow()).processingError).toMatch(/Amount mismatch/);
  });

  it("a failed payment keeps the registration and opens a fresh pending payment", async () => {
    const { app, payment } = await approvedMembershipPayment();
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "INITIATED", provider: "mock" } });
    const { raw, headers } = signed({ id: "evt_fail", type: "payment.failed", reference: payment.reference });
    expect((await handlePaymentWebhook("mock", raw, headers)).status).toBe(200);
    const payments = await prisma.payment.findMany({ where: { membershipApplicationId: app.id }, orderBy: { createdAt: "asc" } });
    expect(payments.map((p) => p.status)).toEqual(["FAILED", "PENDING"]);
    expect((await prisma.membershipApplication.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("APPROVED");
  });

  it("unconfigured providers are refused", async () => {
    expect((await handlePaymentWebhook("razorpay", "{}", new Headers())).status).toBe(404);
  });
});
