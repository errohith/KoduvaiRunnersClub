import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPaymentByReference, initiateCheckout, paymentsStatus, syncPaymentStatus } from "@/server/services/payments";
import { getSettings } from "@/server/services/settings";
import { formatMoney } from "@/lib/money";
import { Alert, StatusBadge } from "@/components/ui";
import { AppError } from "@/lib/errors";

export const metadata: Metadata = { title: "Payment status", robots: { index: false } };

async function payNow(formData: FormData) {
  "use server";
  const ref = String(formData.get("ref") ?? "");
  let url: string;
  try {
    url = (await initiateCheckout(ref)).checkoutUrl;
  } catch (e) {
    redirect(`/payment/status?ref=${encodeURIComponent(ref)}&error=${encodeURIComponent(e instanceof AppError ? e.message : "Could not start payment")}`);
  }
  redirect(url);
}

export default async function PaymentStatusPage({ searchParams }: { searchParams: Promise<{ ref?: string; error?: string }> }) {
  const { ref, error } = await searchParams;
  if (!ref) notFound();
  // Returning from checkout: reconcile with the provider server-side. The redirect itself proves nothing.
  await syncPaymentStatus(ref);
  const p = await getPaymentByReference(ref);
  if (!p) notFound();
  const { enabled } = paymentsStatus();
  const { contact } = await getSettings();
  const what = p.membershipApplication ? `${p.membershipApplication.plan.name} membership (${p.membershipApplication.referenceNo})` : `${p.eventRegistration!.event.title} — ${p.eventRegistration!.category?.name ?? ""} (${p.eventRegistration!.registrationNo})`;
  const open = p.status === "PENDING" || p.status === "INITIATED";
  const payable = p.membershipApplication ? p.membershipApplication.status === "APPROVED" : p.eventRegistration?.status === "PENDING_PAYMENT";

  return (
    <div className="container-page max-w-2xl py-16">
      <div className="card p-6 sm:p-8">
        <p className="eyebrow">Payment</p>
        <h1 className="mt-2 text-4xl font-extrabold uppercase">{formatMoney(p.amountMinor, p.currency)}</h1>
        <p className="mt-1 text-slate-600">{what}</p>
        <div className="mt-4 flex items-center gap-3 text-sm">
          <span className="text-slate-600">Reference <strong className="font-mono text-brand-ink">{p.reference}</strong></span>
          <StatusBadge status={p.status} />
        </div>
        <div className="mt-6 space-y-4" aria-live="polite">
          {error && <Alert tone="error">{error}</Alert>}
          {p.status === "SUCCEEDED" && <Alert tone="success" title="Payment received">Thank you — we&apos;ve confirmed your payment.</Alert>}
          {(p.status === "REFUNDED" || p.status === "PARTIALLY_REFUNDED") && <Alert tone="info" title="Refunded">A refund of {formatMoney(p.refundedMinor, p.currency)} has been recorded.</Alert>}
          {(p.status === "CANCELLED" || p.status === "FAILED") && <Alert tone="warning" title="Payment not completed">{p.failureReason ?? "This payment was not completed."}</Alert>}
          {open && payable && enabled && (
            <form action={payNow}>
              <input type="hidden" name="ref" value={p.reference} />
              <button className="btn-primary px-8 py-3 text-base">{p.status === "INITIATED" ? "Continue to payment" : "Pay now"}</button>
              <p className="help mt-2">You&apos;ll be redirected to our secure payment provider. Card details are never stored by the club.</p>
            </form>
          )}
          {open && payable && !enabled && (
            <Alert tone="warning" title="Online payment is not available yet">
              Your registration is saved and marked <strong>payment pending</strong>. The club will share payment instructions — please quote reference <strong>{p.reference}</strong>.
              {contact.email && <> Questions? Email <a className="underline" href={`mailto:${contact.email}`}>{contact.email}</a>.</>}
            </Alert>
          )}
          {open && !payable && <Alert tone="info">This item is not currently awaiting payment.</Alert>}
        </div>
        <Link href="/" className="mt-8 inline-block text-sm font-semibold text-brand hover:underline">← Back to home</Link>
      </div>
    </div>
  );
}
