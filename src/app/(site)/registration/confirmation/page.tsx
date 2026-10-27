import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { Alert, StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Registration received", robots: { index: false } };

// Shows only non-personal details: anyone holding the reference number can view this page.
export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ type?: string; ref?: string }> }) {
  const { type, ref } = await searchParams;
  if (!ref) notFound();

  if (type === "membership") {
    const app = await prisma.membershipApplication.findUnique({
      where: { referenceNo: ref },
      include: { plan: true, membership: true, payments: { where: { status: { in: ["PENDING", "INITIATED"] } }, take: 1 } },
    });
    if (!app) notFound();
    const payment = app.payments[0];
    return (
      <Shell title="Application received" refNo={app.referenceNo} status={app.status}>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt className="text-slate-600">Membership</dt><dd className="font-medium">{app.plan.name}</dd>
          <dt className="text-slate-600">Fee</dt><dd className="font-medium">{formatMoney(app.feeMinor, app.currency)}</dd>
          {app.membership && (<><dt className="text-slate-600">Membership no.</dt><dd className="font-medium">{app.membership.membershipNo}</dd></>)}
        </dl>
        <div className="mt-5 space-y-3">
          {app.status === "PENDING" && <Alert tone="info" title="What happens next?">A committee member will review your application. We&apos;ve emailed you a copy of your reference number.{app.feeMinor > 0 ? " You'll receive payment details once approved." : ""}</Alert>}
          {app.status === "APPROVED" && payment && <Alert tone="warning" title="Payment pending">Your membership activates once the fee is received. <Link className="font-semibold underline" href={`/payment/status?ref=${payment.reference}`}>View payment</Link></Alert>}
          {app.status === "ACTIVE" && <Alert tone="success" title="You're in!">Your membership is active. See you at the next group run.</Alert>}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/events" className="btn-primary">Browse events</Link>
          <Link href="/join/status" className="btn-outline">Check status later</Link>
        </div>
      </Shell>
    );
  }

  const reg = await prisma.eventRegistration.findUnique({
    where: { registrationNo: ref },
    include: { event: true, category: true, payments: { where: { status: { in: ["PENDING", "INITIATED"] } }, take: 1 } },
  });
  if (!reg) notFound();
  const payment = reg.payments[0];
  return (
    <Shell title={reg.status === "WAITLISTED" ? "You're on the waitlist" : "Registration received"} refNo={reg.registrationNo} status={reg.status}>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <dt className="text-slate-600">Event</dt><dd className="font-medium">{reg.event.title}</dd>
        <dt className="text-slate-600">Date</dt><dd className="font-medium">{formatDateTime(reg.event.startsAt)}</dd>
        <dt className="text-slate-600">Category</dt><dd className="font-medium">{reg.category?.name ?? "Volunteer"}</dd>
        <dt className="text-slate-600">Entry fee</dt><dd className="font-medium">{formatMoney(reg.feeMinor, reg.currency)}</dd>
      </dl>
      <div className="mt-5">
        {reg.status === "CONFIRMED" && <Alert tone="success" title="You're confirmed">We&apos;ve emailed your confirmation. Bring your registration number on event day.</Alert>}
        {reg.status === "PENDING_PAYMENT" && payment && <Alert tone="warning" title="Payment pending">Your place is reserved. It is confirmed once the entry fee is received. <Link className="font-semibold underline" href={`/payment/status?ref=${payment.reference}`}>View payment</Link></Alert>}
        {reg.status === "WAITLISTED" && <Alert tone="info" title="Waitlisted">The category is full. We&apos;ll notify you by email if a place opens up.</Alert>}
      </div>
      <div className="mt-6"><Link href={`/events/${reg.event.slug}`} className="btn-outline">Back to event</Link></div>
    </Shell>
  );
}

function Shell({ title, refNo, status, children }: { title: string; refNo: string; status: string; children: React.ReactNode }) {
  return (
    <div className="container-page max-w-2xl py-16">
      <div className="card p-6 sm:p-8">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg>
        </div>
        <h1 className="mt-4 text-4xl font-extrabold uppercase">{title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-slate-600">Reference <strong className="font-mono text-brand-ink">{refNo}</strong></p>
          <StatusBadge status={status} />
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
