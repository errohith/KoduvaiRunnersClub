export type CheckoutRequest = {
  reference: string; // our internal payment reference
  amountMinor: number;
  currency: string;
  description: string;
  customer: { name: string; email: string; phone: string };
  returnUrl: string;
};

export type NormalizedPaymentEvent = {
  eventId: string;
  type: "payment.succeeded" | "payment.failed" | "payment.cancelled" | "refund.succeeded" | "ignored";
  rawType: string;
  reference?: string;
  checkoutId?: string;
  providerPaymentId?: string;
  amountMinor?: number;
  refundId?: string;
  failureReason?: string;
};

export interface PaymentAdapter {
  readonly name: string;
  readonly enabled: boolean;
  createCheckout(req: CheckoutRequest): Promise<{ checkoutId: string; checkoutUrl: string }>;
  /** Must verify against the RAW request body. */
  verifyWebhook(rawBody: string, headers: Headers): boolean;
  parseWebhook(rawBody: string, headers: Headers): NormalizedPaymentEvent;
  /** Server-side status check (never trust browser redirects). */
  fetchCheckoutStatus(checkoutId: string): Promise<"SUCCEEDED" | "FAILED" | "CANCELLED" | "PENDING">;
}
