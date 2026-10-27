/**
 * Payment ledger. Membership and event payments share one table but each row points at exactly
 * one business object (DB CHECK `payments_single_target`). Payment state only ever changes from:
 *   - a signature-verified provider webhook,
 *   - a server-side status query to the provider,
 *   - an audited admin action (offline payment / refund record).
 * Browser redirects are never treated as proof of payment.
 */
import type { Payment, PaymentPurpose, Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { config } from "@/config/env";
import { nextReference } from "@/lib/refs";
import { AppError, badRequest, conflict, notFound } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { getPaymentAdapter, getProviderAdapter, PaymentsDisabledError } from "../adapters/payment";
import type { NormalizedPaymentEvent } from "../adapters/payment/types";
import { enqueueTemplate, kick } from "./notifications";

const OPEN = ["PENDING", "INITIATED"] as const;

export async function ensurePendingPayment(
  tx: Tx,
  target: { purpose: "MEMBERSHIP"; membershipApplicationId: string } | { purpose: "EVENT_REGISTRATION"; eventRegistrationId: string },
  amountMinor: number,
  currency: string,
): Promise<Payment> {
  if (amountMinor <= 0) throw new Error("ensurePendingPayment called for a free item");
  const where: Prisma.PaymentWhereInput =
    target.purpose === "MEMBERSHIP" ? { membershipApplicationId: target.membershipApplicationId } : { eventRegistrationId: target.eventRegistrationId };
  const existing = await tx.payment.findFirst({ where: { ...where, status: { in: [...OPEN, "SUCCEEDED"] } } });
  if (existing) return existing;
  return tx.payment.create({
    data: { reference: await nextReference(tx, "PAY"), ...target, amountMinor, currency, status: "PENDING" },
  });
}

export async function cancelOpenPayments(tx: Tx, where: { membershipApplicationId?: string; eventRegistrationId?: string }, reason: string) {
  await tx.payment.updateMany({ where: { ...where, status: { in: [...OPEN] } }, data: { status: "CANCELLED", failureReason: reason } });
}

export async function getPaymentByReference(reference: string) {
  return prisma.payment.findUnique({
    where: { reference },
    include: { membershipApplication: { include: { plan: true } }, eventRegistration: { include: { event: true, category: true } } },
  });
}

/** Is the business object still in a state where taking money makes sense? */
function payableState(p: NonNullable<Awaited<ReturnType<typeof getPaymentByReference>>>) {
  if (p.membershipApplication) return p.membershipApplication.status === "APPROVED";
  if (p.eventRegistration) return p.eventRegistration.status === "PENDING_PAYMENT" && p.eventRegistration.event.status === "PUBLISHED";
  return false;
}

/** Create (or reuse) a provider checkout. Only possible when payments are enabled and configured. */
export async function initiateCheckout(reference: string): Promise<{ checkoutUrl: string }> {
  const adapter = getPaymentAdapter();
  if (!adapter.enabled) throw new PaymentsDisabledError();
  const p = await getPaymentByReference(reference);
  if (!p) throw notFound("Payment");
  if (!OPEN.includes(p.status as (typeof OPEN)[number])) throw conflict("payment_not_open", `This payment is ${p.status.toLowerCase()}.`);
  if (!payableState(p)) throw conflict("not_payable", "This registration is not awaiting payment.");
  if (p.status === "INITIATED" && p.checkoutUrl && p.provider === adapter.name) return { checkoutUrl: p.checkoutUrl };

  const customer = p.membershipApplication ?? p.eventRegistration!;
  const description = p.membershipApplication
    ? `${p.membershipApplication.plan.name} membership — ${p.membershipApplication.referenceNo}`
    : `${p.eventRegistration!.event.title} — ${p.eventRegistration!.registrationNo}`;

  const { checkoutId, checkoutUrl } = await adapter.createCheckout({
    reference: p.reference,
    amountMinor: p.amountMinor,
    currency: p.currency,
    description,
    customer: { name: customer.fullName, email: customer.email, phone: customer.phoneE164 },
    returnUrl: `${config.APP_URL}/payment/status?ref=${encodeURIComponent(p.reference)}`,
  });
  await prisma.payment.update({
    where: { id: p.id },
    data: { status: "INITIATED", provider: adapter.name, providerCheckoutId: checkoutId, checkoutUrl },
  });
  return { checkoutUrl };
}

// ───────────────────────────── Webhooks ─────────────────────────────

export type WebhookOutcome = { status: number; body: Record<string, unknown> };

export async function handlePaymentWebhook(provider: string, rawBody: string, headers: Headers): Promise<WebhookOutcome> {
  const adapter = getProviderAdapter(provider);
  if (!adapter) return { status: 404, body: { error: "Unknown or unconfigured payment provider" } };
  if (!adapter.verifyWebhook(rawBody, headers)) {
    logger.warn("payment.webhook_bad_signature", { provider });
    return { status: 401, body: { error: "Invalid signature" } };
  }

  let evt: NormalizedPaymentEvent;
  let payload: Prisma.InputJsonValue;
  try {
    evt = adapter.parseWebhook(rawBody, headers);
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "Malformed payload" } };
  }
  if (!evt.eventId) return { status: 400, body: { error: "Missing event id" } };

  // Idempotency: one row per (provider, eventId). Replays of processed events are acknowledged.
  const existing = await prisma.paymentWebhookEvent.findUnique({ where: { provider_providerEventId: { provider, providerEventId: evt.eventId } } });
  if (existing?.processedAt) return { status: 200, body: { ok: true, duplicate: true } };
  const record =
    existing ??
    (await prisma.paymentWebhookEvent
      .create({ data: { provider, providerEventId: evt.eventId, eventType: evt.rawType, signatureValid: true, payload } })
      .catch(async () => prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { provider_providerEventId: { provider, providerEventId: evt.eventId } } })));
  if (record.processedAt) return { status: 200, body: { ok: true, duplicate: true } };

  try {
    const ids = await applyPaymentEvent(provider, evt);
    await prisma.paymentWebhookEvent.update({ where: { id: record.id }, data: { processedAt: new Date(), processingError: null } });
    kick(ids);
    return { status: 200, body: { ok: true } };
  } catch (e) {
    const msg = (e as Error).message;
    await prisma.paymentWebhookEvent.update({ where: { id: record.id }, data: { processingError: msg.slice(0, 500) } });
    logger.error("payment.webhook_processing_failed", { provider, eventId: evt.eventId, err: msg });
    // Non-2xx makes the provider retry later.
    return { status: 500, body: { error: "Processing failed" } };
  }
}

/** Applies a normalised provider event. Returns notification ids to send after commit. */
export async function applyPaymentEvent(provider: string, evt: NormalizedPaymentEvent): Promise<string[]> {
  if (evt.type === "ignored") return [];
  return prisma.$transaction(async (tx) => {
    const payment = await findPaymentForEvent(tx, provider, evt);
    if (!payment) throw new Error(`No payment matches event ${evt.eventId}`);
    // Lock the payment row for the remainder of the transaction.
    await tx.$queryRaw`SELECT 1 FROM "payments" WHERE "id" = ${payment.id}::uuid FOR UPDATE`;
    const p = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });

    if (evt.type === "payment.succeeded") {
      if (p.status === "SUCCEEDED" || p.status === "REFUNDED" || p.status === "PARTIALLY_REFUNDED") return [];
      if (evt.amountMinor !== undefined && evt.amountMinor !== p.amountMinor) {
        throw new Error(`Amount mismatch for ${p.reference}: expected ${p.amountMinor}, got ${evt.amountMinor}`);
      }
      await tx.payment.update({
        where: { id: p.id },
        data: { status: "SUCCEEDED", paidAt: new Date(), provider, providerPaymentId: evt.providerPaymentId ?? p.providerPaymentId, failureReason: null },
      });
      return onPaymentSucceeded(tx, p);
    }

    if (evt.type === "payment.failed" || evt.type === "payment.cancelled") {
      if (!OPEN.includes(p.status as (typeof OPEN)[number])) return [];
      // A failed attempt returns the payment to PENDING so the runner can try again;
      // a cancelled/expired checkout is closed and a fresh PENDING payment can be created.
      await tx.payment.update({
        where: { id: p.id },
        data:
          evt.type === "payment.failed"
            ? { status: "FAILED", failureReason: evt.failureReason ?? "Payment failed" }
            : { status: "CANCELLED", failureReason: "Checkout expired or cancelled" },
      });
      const fresh = await reopenPayment(tx, p);
      return notifyPayment(tx, fresh ?? p, "payment.failed");
    }

    if (evt.type === "refund.succeeded") {
      if (evt.refundId && (await tx.refund.findFirst({ where: { providerRefundId: evt.refundId } }))) return [];
      const amount = evt.amountMinor ?? p.amountMinor - p.refundedMinor;
      const refunded = Math.min(p.amountMinor, p.refundedMinor + amount);
      await tx.refund.create({ data: { paymentId: p.id, amountMinor: amount, status: "SUCCEEDED", providerRefundId: evt.refundId, reason: "Provider refund" } });
      await tx.payment.update({ where: { id: p.id }, data: { refundedMinor: refunded, status: refunded >= p.amountMinor ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
      return notifyPayment(tx, p, "payment.refunded", { amount: formatMoney(amount, p.currency) });
    }
    return [];
  });
}

async function findPaymentForEvent(tx: Tx, provider: string, evt: NormalizedPaymentEvent) {
  if (evt.reference) {
    const p = await tx.payment.findUnique({ where: { reference: evt.reference } });
    if (p) return p;
  }
  if (evt.checkoutId) {
    const p = await tx.payment.findFirst({ where: { provider, providerCheckoutId: evt.checkoutId } });
    if (p) return p;
  }
  if (evt.providerPaymentId) return tx.payment.findFirst({ where: { provider, providerPaymentId: evt.providerPaymentId } });
  return null;
}

async function reopenPayment(tx: Tx, p: Payment) {
  if (p.membershipApplicationId) {
    const app = await tx.membershipApplication.findUniqueOrThrow({ where: { id: p.membershipApplicationId } });
    if (app.status === "APPROVED") return ensurePendingPayment(tx, { purpose: "MEMBERSHIP", membershipApplicationId: app.id }, p.amountMinor, p.currency);
  }
  if (p.eventRegistrationId) {
    const reg = await tx.eventRegistration.findUniqueOrThrow({ where: { id: p.eventRegistrationId } });
    if (reg.status === "PENDING_PAYMENT") return ensurePendingPayment(tx, { purpose: "EVENT_REGISTRATION", eventRegistrationId: reg.id }, p.amountMinor, p.currency);
  }
  return null;
}

/** Advances the linked business object once money is confirmed. */
async function onPaymentSucceeded(tx: Tx, p: Payment): Promise<string[]> {
  const ids = await notifyPayment(tx, p, "payment.confirmed");
  if (p.purpose === "MEMBERSHIP" && p.membershipApplicationId) {
    const { activateAfterPayment } = await import("./membership");
    ids.push(...(await activateAfterPayment(tx, p.membershipApplicationId)));
  }
  if (p.purpose === "EVENT_REGISTRATION" && p.eventRegistrationId) {
    const { confirmAfterPayment } = await import("./events");
    ids.push(...(await confirmAfterPayment(tx, p.eventRegistrationId)));
  }
  return ids;
}

async function notifyPayment(tx: Tx, p: Payment, templateKey: string, extra: Record<string, unknown> = {}) {
  const who = p.membershipApplicationId
    ? await tx.membershipApplication.findUnique({ where: { id: p.membershipApplicationId } })
    : await tx.eventRegistration.findUnique({ where: { id: p.eventRegistrationId! } });
  if (!who) return [];
  return enqueueTemplate(
    templateKey,
    { name: who.fullName, email: who.email, phone: who.phoneE164 },
    {
      paymentReference: p.reference,
      amount: formatMoney(p.amountMinor, p.currency),
      statusUrl: `${config.APP_URL}/payment/status?ref=${p.reference}`,
      ...extra,
    },
    { idempotencyBase: `${templateKey}:${p.id}:${p.status}:${p.refundedMinor}`, relatedType: "payment", relatedId: p.id },
    tx,
  );
}

/** Server-side reconciliation used by the status page when a runner returns from checkout. */
export async function syncPaymentStatus(reference: string) {
  const p = await prisma.payment.findUnique({ where: { reference } });
  if (!p || p.status !== "INITIATED" || !p.providerCheckoutId || !p.provider) return;
  const adapter = getProviderAdapter(p.provider);
  if (!adapter?.enabled) return;
  try {
    const status = await adapter.fetchCheckoutStatus(p.providerCheckoutId);
    if (status === "PENDING") return;
    const type = status === "SUCCEEDED" ? "payment.succeeded" : status === "FAILED" ? "payment.failed" : "payment.cancelled";
    kick(await applyPaymentEvent(p.provider, { eventId: `sync:${p.id}`, rawType: "status_sync", type, reference: p.reference }));
  } catch (e) {
    logger.warn("payment.sync_failed", { reference, err: (e as Error).message });
  }
}

// ───────────────────────────── Admin actions ─────────────────────────────

/** Record money received outside the gateway (cash/UPI/bank transfer), verified by an admin. */
export async function recordOfflinePayment(reference: string, note: string, actorId: string, ip?: string | null) {
  if (note.trim().length < 3) throw badRequest("Add a note describing how the payment was verified (e.g. UPI txn id).");
  const ids = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "payments" WHERE "reference" = ${reference} FOR UPDATE`;
    const p = await tx.payment.findUnique({ where: { reference } });
    if (!p) throw notFound("Payment");
    if (!OPEN.includes(p.status as (typeof OPEN)[number])) throw conflict("payment_not_open", `Payment is already ${p.status.toLowerCase()}.`);
    await tx.payment.update({
      where: { id: p.id },
      data: { status: "SUCCEEDED", paidAt: new Date(), provider: "offline", providerPaymentId: `offline:${note.trim().slice(0, 120)}` },
    });
    await audit({ actorId, action: "payment.offline_recorded", entityType: "payment", entityId: p.id, metadata: { reference, note }, ip }, tx);
    return onPaymentSucceeded(tx, p);
  });
  kick(ids);
}

/** Record a refund. Provider refunds via API are not automated yet — see docs/INTEGRATIONS.md. */
export async function recordRefund(reference: string, amountMinor: number, reason: string, actorId: string, ip?: string | null) {
  const ids = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "payments" WHERE "reference" = ${reference} FOR UPDATE`;
    const p = await tx.payment.findUnique({ where: { reference } });
    if (!p) throw notFound("Payment");
    if (!["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(p.status)) throw conflict("not_refundable", "Only successful payments can be refunded.");
    if (amountMinor <= 0 || p.refundedMinor + amountMinor > p.amountMinor) throw badRequest("Refund exceeds the amount paid.");
    const refunded = p.refundedMinor + amountMinor;
    await tx.refund.create({ data: { paymentId: p.id, amountMinor, status: "SUCCEEDED", reason, createdById: actorId } });
    const updated = await tx.payment.update({
      where: { id: p.id },
      data: { refundedMinor: refunded, status: refunded >= p.amountMinor ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });
    await audit({ actorId, action: "payment.refund_recorded", entityType: "payment", entityId: p.id, metadata: { reference, amountMinor, reason }, ip }, tx);
    return notifyPayment(tx, updated, "payment.refunded", { amount: formatMoney(amountMinor, p.currency) });
  });
  kick(ids);
}

export function paymentsStatus() {
  const adapter = getPaymentAdapter();
  return { enabled: adapter.enabled, provider: adapter.name };
}

export type { PaymentPurpose };
export { AppError };
