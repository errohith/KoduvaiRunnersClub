import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePagePermission, can } from "@/lib/auth/session";
import { formatMoney, minorToMajorString } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { AdminPage, Pagination, Stat, Table, DownloadLink } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { Alert, StatusBadge } from "@/components/ui";
import { offlinePaymentAction, refundAction } from "@/server/admin/payment-actions";
import { paymentsStatus } from "@/server/services/payments";

const STATUSES = ["PENDING", "INITIATED", "SUCCEEDED", "FAILED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"] as const;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; purpose?: string; q?: string; page?: string; ok?: string; error?: string }> }) {
  const user = await requirePagePermission("payments.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.PaymentWhereInput = {
    ...(STATUSES.includes(sp.status as never) ? { status: sp.status as (typeof STATUSES)[number] } : {}),
    ...(sp.purpose === "MEMBERSHIP" || sp.purpose === "EVENT_REGISTRATION" ? { purpose: sp.purpose } : {}),
    ...(sp.q ? { reference: { contains: sp.q.toUpperCase() } } : {}),
  };
  const [rows, total, sums] = await Promise.all([
    prisma.payment.findMany({ where, include: { membershipApplication: { include: { plan: true } }, eventRegistration: { include: { event: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 25, take: 25 }),
    prisma.payment.count({ where }),
    prisma.payment.groupBy({ by: ["status"], _sum: { amountMinor: true, refundedMinor: true }, _count: true }),
  ]);
  const sum = (s: string[]) => sums.filter((x) => s.includes(x.status)).reduce((a, x) => a + (x._sum.amountMinor ?? 0), 0);
  const refunded = sums.reduce((a, x) => a + (x._sum.refundedMinor ?? 0), 0);
  const manage = can(user, "payments.manage");
  const pay = paymentsStatus();
  const back = "/admin/payments?" + new URLSearchParams(Object.entries({ status: sp.status, purpose: sp.purpose, q: sp.q }).filter(([, v]) => v) as [string, string][]);

  return (
    <AdminPage title="Payments" description="Membership and event payments are separate ledger entries, each linked to exactly one application or registration." flash={sp} actions={can(user, "reports.view") && <DownloadLink href={"/api/v1/admin/exports/payments"}>Export CSV</DownloadLink>}>
      {!pay.enabled && <Alert tone="info" title="Online payments are disabled">Payments stay pending until a provider is enabled (PAYMENT_ENABLED in .env). You can record verified offline payments (cash/UPI/bank transfer) below.</Alert>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Collected" value={formatMoney(sum(["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"]))} />
        <Stat label="Refunded" value={formatMoney(refunded)} />
        <Stat label="Outstanding" value={formatMoney(sum(["PENDING", "INITIATED"]))} hint="Pending + initiated" />
        <Stat label="Provider" value={pay.enabled ? pay.provider : "Disabled"} />
      </div>
      <form className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_170px_200px_auto]">
        <input name="q" defaultValue={sp.q} placeholder="Payment reference" className="input" aria-label="Reference" />
        <select name="status" defaultValue={sp.status ?? ""} className="input" aria-label="Status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select name="purpose" defaultValue={sp.purpose ?? ""} className="input" aria-label="Purpose"><option value="">Memberships & events</option><option value="MEMBERSHIP">Memberships</option><option value="EVENT_REGISTRATION">Event registrations</option></select>
        <button className="btn-dark">Filter</button>
      </form>
      <Table head={["Reference", "For", "Amount", "Status", "Provider", "Created", manage ? "Actions" : ""]} empty={!rows.length}>
        {rows.map((p) => (
          <tr key={p.id}>
            <td className="font-mono text-xs">{p.reference}</td>
            <td>
              {p.membershipApplication ? (
                <Link className="hover:underline" href={`/admin/applications/${p.membershipApplication.id}`}>Membership · {p.membershipApplication.fullName}<span className="block text-xs text-slate-500">{p.membershipApplication.plan.name}</span></Link>
              ) : p.eventRegistration ? (
                <Link className="hover:underline" href={`/admin/events/${p.eventRegistration.eventId}/registrations?q=${p.eventRegistration.registrationNo}`}>Event · {p.eventRegistration.fullName}<span className="block text-xs text-slate-500">{p.eventRegistration.event.title}</span></Link>
              ) : null}
            </td>
            <td className="whitespace-nowrap">{formatMoney(p.amountMinor, p.currency)}{p.refundedMinor > 0 && <span className="block text-xs text-slate-500">−{formatMoney(p.refundedMinor, p.currency)} refunded</span>}</td>
            <td><StatusBadge status={p.status} />{p.failureReason && <span className="block text-xs text-slate-500">{p.failureReason}</span>}</td>
            <td className="text-xs">{p.provider ?? "—"}{p.providerPaymentId && <span className="block text-slate-400">{p.providerPaymentId}</span>}</td>
            <td className="whitespace-nowrap text-xs">{formatDateTime(p.createdAt)}</td>
            <td>
              {manage && ["PENDING", "INITIATED"].includes(p.status) && (
                <form action={offlinePaymentAction} className="flex gap-1">
                  <input type="hidden" name="reference" value={p.reference} /><input type="hidden" name="back" value={back} />
                  <input name="note" required placeholder="Verification note" className="input w-40 py-1 text-xs" aria-label="Verification note" />
                  <SubmitButton className="btn-outline btn-sm" confirm="Confirm you verified this payment was received?">Mark paid</SubmitButton>
                </form>
              )}
              {manage && ["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(p.status) && (
                <form action={refundAction} className="flex gap-1">
                  <input type="hidden" name="reference" value={p.reference} /><input type="hidden" name="back" value={back} />
                  <input name="amount" defaultValue={minorToMajorString(p.amountMinor - p.refundedMinor, p.currency)} className="input w-20 py-1 text-xs" aria-label="Refund amount" />
                  <input name="reason" placeholder="Reason" className="input w-28 py-1 text-xs" aria-label="Refund reason" />
                  <SubmitButton className="btn-ghost btn-sm" confirm="Record this refund? Make sure the money has actually been returned.">Refund</SubmitButton>
                </form>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 25)} base={{ status: sp.status, purpose: sp.purpose, q: sp.q }} />
    </AdminPage>
  );
}
