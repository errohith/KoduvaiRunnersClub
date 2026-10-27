import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { config } from "@/config/env";
import { getPaymentByReference } from "@/server/services/payments";
import { mockWebhookSignature } from "@/server/adapters/payment";
import { formatMoney } from "@/lib/money";
import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/admin/buttons";

export const metadata = { title: "Mock checkout", robots: { index: false } };

function available() {
  return config.APP_ENV !== "production" && config.PAYMENT_ENABLED && config.PAYMENT_PROVIDER === "mock";
}

/** Sends a signed webhook to our own endpoint — exercising the real verification + processing path. */
async function simulate(formData: FormData) {
  "use server";
  if (!available()) notFound();
  const ref = String(formData.get("ref"));
  const outcome = String(formData.get("outcome"));
  const p = await getPaymentByReference(ref);
  if (!p) notFound();
  const body = JSON.stringify({ id: `evt_${randomUUID()}`, type: outcome === "success" ? "payment.succeeded" : "payment.failed", reference: ref, amountMinor: p.amountMinor });
  await fetch(`${config.APP_URL}/api/v1/webhooks/payments/mock`, { method: "POST", headers: { "Content-Type": "application/json", "x-mock-signature": mockWebhookSignature(body) }, body });
  redirect(`/payment/status?ref=${encodeURIComponent(ref)}`);
}

export default async function MockCheckout({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  if (!available()) notFound();
  const { ref } = await searchParams;
  const p = ref ? await getPaymentByReference(ref) : null;
  if (!p) notFound();
  return (
    <div className="container-page max-w-lg py-16">
      <div className="card space-y-5 p-8">
        <Alert tone="warning" title="Development mock checkout">No real money moves. This page exists only when PAYMENT_PROVIDER=mock outside production.</Alert>
        <p className="text-lg">Pay <strong>{formatMoney(p.amountMinor, p.currency)}</strong> for <span className="font-mono">{p.reference}</span></p>
        <form action={simulate} className="flex gap-3">
          <input type="hidden" name="ref" value={p.reference} />
          <SubmitButton name="outcome" value="success" className="btn-primary">Simulate success</SubmitButton>
          <SubmitButton name="outcome" value="failure" className="btn-outline">Simulate failure</SubmitButton>
        </form>
      </div>
    </div>
  );
}
