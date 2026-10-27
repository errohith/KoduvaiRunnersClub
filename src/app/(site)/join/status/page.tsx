import type { Metadata } from "next";
import Link from "next/link";
import { getApplicationStatus } from "@/server/services/membership";
import { Alert, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { clientIp } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Application status", robots: { index: false } };

const EXPLAIN: Record<string, string> = {
  PENDING: "Your application is waiting for review by the committee.",
  APPROVED: "Approved — your membership activates once the fee is received.",
  ACTIVE: "Your membership is active. Welcome to the club!",
  REJECTED: "Your application was not approved.",
  CANCELLED: "This application was cancelled.",
};

export default async function StatusPage({ searchParams }: { searchParams: Promise<{ ref?: string; email?: string }> }) {
  const { ref, email } = await searchParams;
  let app: Awaited<ReturnType<typeof getApplicationStatus>> = null;
  let limited = false;
  if (ref && email) {
    try {
      await rateLimit(`status:${clientIp(await headers()) ?? "unknown"}`, 20, 600);
      app = await getApplicationStatus(ref.trim().toUpperCase(), email);
    } catch {
      limited = true;
    }
  }
  const payment = app?.payments[0];
  return (
    <>
      <PageHeader eyebrow="Membership" title="Check application status" />
      <div className="container-page max-w-xl py-12">
        <form className="card space-y-4 p-6" method="get">
          <div>
            <label htmlFor="ref" className="label">Reference number</label>
            <input id="ref" name="ref" defaultValue={ref} required placeholder="KR-M-2026-000123" className="input uppercase" />
          </div>
          <div>
            <label htmlFor="email" className="label">Email used on the application</label>
            <input id="email" name="email" type="email" defaultValue={email} required className="input" />
          </div>
          <button className="btn-primary">Check status</button>
        </form>
        <div className="mt-6" aria-live="polite">
          {limited && <Alert tone="error">Too many lookups. Please wait a few minutes.</Alert>}
          {ref && email && !app && !limited && <Alert tone="warning">We couldn&apos;t find an application with that reference and email.</Alert>}
          {app && (
            <div className="card space-y-3 p-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-brand-ink">{app.referenceNo}</p>
                <StatusBadge status={app.status} />
              </div>
              <p className="text-slate-700">{EXPLAIN[app.status]}</p>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-slate-600">Membership</dt><dd>{app.plan.name}</dd>
                <dt className="text-slate-600">Submitted</dt><dd>{formatDate(app.createdAt)}</dd>
                <dt className="text-slate-600">Fee</dt><dd>{formatMoney(app.feeMinor, app.currency)}</dd>
                {app.membership && (<><dt className="text-slate-600">Membership no.</dt><dd>{app.membership.membershipNo}</dd></>)}
              </dl>
              {payment && ["PENDING", "INITIATED", "FAILED"].includes(payment.status) && app.status === "APPROVED" && (
                <Link href={`/payment/status?ref=${payment.reference}`} className="btn-primary">View payment</Link>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
