import { config } from "@/config/env";
import { hmacHex, safeEqual } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { classifyHttpFailure, fetchWithTimeout, joinUrl } from "../errors";
import type { CheckoutRequest, NormalizedPaymentEvent, PaymentAdapter } from "./types";

export class PaymentsDisabledError extends AppError {
  constructor() {
    super(503, "payments_disabled", "Online payments are not available yet. Your registration is saved and marked as payment pending.");
  }
}

export const disabledPaymentAdapter: PaymentAdapter = {
  name: "none",
  enabled: false,
  async createCheckout() {
    throw new PaymentsDisabledError();
  },
  verifyWebhook: () => false,
  parseWebhook: () => ({ eventId: "", type: "ignored", rawType: "disabled" }),
  async fetchCheckoutStatus() {
    throw new PaymentsDisabledError();
  },
};

/**
 * Razorpay Payment Links (suits INR club fees).
 *   POST {base}/v1/payment_links   (HTTP basic auth key_id:key_secret)
 *   Webhook signature: X-Razorpay-Signature = hex(HMAC_SHA256(rawBody, webhook_secret))
 * Verify against the current Razorpay docs before enabling — see docs/INTEGRATIONS.md.
 */
export function createRazorpayAdapter(opts: { baseUrl: string; keyId: string; keySecret: string; webhookSecret: string; timeoutMs: number }): PaymentAdapter {
  const auth = "Basic " + Buffer.from(`${opts.keyId}:${opts.keySecret}`).toString("base64");
  return {
    name: "razorpay",
    enabled: true,
    async createCheckout(req: CheckoutRequest) {
      const res = await fetchWithTimeout(
        joinUrl(opts.baseUrl, "v1/payment_links"),
        {
          method: "POST",
          headers: { Authorization: auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: req.amountMinor,
            currency: req.currency,
            reference_id: req.reference,
            description: req.description.slice(0, 2048),
            customer: { name: req.customer.name, email: req.customer.email, contact: req.customer.phone },
            notify: { sms: false, email: false },
            reminder_enable: false,
            callback_url: req.returnUrl,
            callback_method: "get",
            notes: { reference: req.reference },
          }),
        },
        opts.timeoutMs,
      );
      const body = await res.text();
      if (!res.ok) throw classifyHttpFailure(res.status, body);
      const json = JSON.parse(body) as { id: string; short_url: string };
      return { checkoutId: json.id, checkoutUrl: json.short_url };
    },
    verifyWebhook(rawBody, headers) {
      const sig = headers.get("x-razorpay-signature");
      return !!sig && safeEqual(sig, hmacHex(opts.webhookSecret, rawBody));
    },
    parseWebhook(rawBody, headers) {
      const j = JSON.parse(rawBody) as {
        event: string;
        created_at?: number;
        payload?: {
          payment_link?: { entity?: { id: string; reference_id?: string } };
          payment?: { entity?: { id: string; amount?: number; error_description?: string; notes?: { reference?: string } } };
          refund?: { entity?: { id: string; payment_id: string; amount: number } };
        };
      };
      const link = j.payload?.payment_link?.entity;
      const pay = j.payload?.payment?.entity;
      const refund = j.payload?.refund?.entity;
      const eventId = headers.get("x-razorpay-event-id") ?? `${j.event}:${link?.id ?? pay?.id ?? refund?.id}:${j.created_at ?? ""}`;
      const base = { eventId, rawType: j.event, checkoutId: link?.id, reference: link?.reference_id ?? pay?.notes?.reference, providerPaymentId: pay?.id };
      switch (j.event) {
        case "payment_link.paid":
          return { ...base, type: "payment.succeeded", amountMinor: pay?.amount };
        case "payment_link.expired":
        case "payment_link.cancelled":
          return { ...base, type: "payment.cancelled" };
        case "payment.failed":
          return { ...base, type: "payment.failed", failureReason: pay?.error_description };
        case "refund.processed":
          return { ...base, type: "refund.succeeded", providerPaymentId: refund?.payment_id, refundId: refund?.id, amountMinor: refund?.amount };
        default:
          return { ...base, type: "ignored" };
      }
    },
    async fetchCheckoutStatus(checkoutId) {
      const res = await fetchWithTimeout(joinUrl(opts.baseUrl, "v1/payment_links", checkoutId), { headers: { Authorization: auth } }, opts.timeoutMs);
      const body = await res.text();
      if (!res.ok) throw classifyHttpFailure(res.status, body);
      const status = (JSON.parse(body) as { status: string }).status;
      return status === "paid" ? "SUCCEEDED" : status === "cancelled" || status === "expired" ? "CANCELLED" : "PENDING";
    },
  };
}

/**
 * Development-only provider. The checkout page (/payment/mock-checkout) lets a developer
 * simulate a provider webhook signed with PAYMENT_WEBHOOK_SECRET, exercising the real
 * webhook → verification → idempotent processing path. Refused in production by env validation.
 */
export function createMockAdapter(opts: { appUrl: string; webhookSecret: string }): PaymentAdapter {
  return {
    name: "mock",
    enabled: true,
    async createCheckout(req) {
      const checkoutId = `mock_${req.reference}`;
      return { checkoutId, checkoutUrl: `${opts.appUrl}/payment/mock-checkout?ref=${encodeURIComponent(req.reference)}` };
    },
    verifyWebhook(rawBody, headers) {
      const sig = headers.get("x-mock-signature");
      return !!sig && safeEqual(sig, hmacHex(opts.webhookSecret, rawBody));
    },
    parseWebhook(rawBody) {
      const j = JSON.parse(rawBody) as { id: string; type: string; reference: string; amountMinor?: number };
      const map: Record<string, NormalizedPaymentEvent["type"]> = {
        "payment.succeeded": "payment.succeeded",
        "payment.failed": "payment.failed",
        "payment.cancelled": "payment.cancelled",
      };
      return {
        eventId: j.id,
        rawType: j.type,
        type: map[j.type] ?? "ignored",
        reference: j.reference,
        checkoutId: `mock_${j.reference}`,
        providerPaymentId: `mockpay_${j.id}`,
        amountMinor: j.amountMinor,
      };
    },
    async fetchCheckoutStatus() {
      return "PENDING";
    },
  };
}

export const mockWebhookSignature = (rawBody: string) => hmacHex(config.PAYMENT_WEBHOOK_SECRET ?? "", rawBody);

let override: PaymentAdapter | null = null;
export function setPaymentAdapterForTests(a: PaymentAdapter | null) {
  override = a;
}

/** Adapter used to CREATE checkouts — respects PAYMENT_ENABLED. */
export function getPaymentAdapter(): PaymentAdapter {
  if (override) return override;
  if (!config.PAYMENT_ENABLED) return disabledPaymentAdapter;
  return getProviderAdapter(config.PAYMENT_PROVIDER) ?? disabledPaymentAdapter;
}

/** Adapter used to VERIFY webhooks for a named provider (only the configured one is accepted). */
export function getProviderAdapter(provider: string): PaymentAdapter | null {
  if (override) return override.name === provider ? override : null;
  if (provider !== config.PAYMENT_PROVIDER || !config.PAYMENT_WEBHOOK_SECRET) return null;
  if (provider === "razorpay" && config.PAYMENT_API_KEY_ID && config.PAYMENT_API_KEY_SECRET) {
    return createRazorpayAdapter({
      baseUrl: config.PAYMENT_API_BASE_URL,
      keyId: config.PAYMENT_API_KEY_ID,
      keySecret: config.PAYMENT_API_KEY_SECRET,
      webhookSecret: config.PAYMENT_WEBHOOK_SECRET,
      timeoutMs: config.NOTIFICATION_TIMEOUT_MS,
    });
  }
  if (provider === "mock" && config.APP_ENV !== "production") {
    return createMockAdapter({ appUrl: config.APP_URL, webhookSecret: config.PAYMENT_WEBHOOK_SECRET });
  }
  return null;
}
