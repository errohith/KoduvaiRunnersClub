import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePagePermission, can } from "@/lib/auth/session";
import { formatDate } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { AdminPage, Pagination, Table, DownloadLink } from "@/components/admin/kit";
import { StatusBadge } from "@/components/ui";

const STATUSES = ["PENDING", "APPROVED", "ACTIVE", "REJECTED", "CANCELLED"] as const;

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ status?: string; plan?: string; q?: string; page?: string; ok?: string; error?: string }> }) {
  const user = await requirePagePermission("members.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.MembershipApplicationWhereInput = {
    ...(STATUSES.includes(sp.status as never) ? { status: sp.status as (typeof STATUSES)[number] } : {}),
    ...(sp.plan ? { planId: sp.plan } : {}),
    ...(sp.q ? { OR: [{ fullName: { contains: sp.q, mode: "insensitive" } }, { email: { contains: sp.q.toLowerCase() } }, { referenceNo: { contains: sp.q.toUpperCase() } }, { phoneE164: { contains: sp.q.replace(/\s/g, "") } }] } : {}),
  };
  const [rows, total, plans] = await Promise.all([
    prisma.membershipApplication.findMany({ where, include: { plan: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 25, take: 25 }),
    prisma.membershipApplication.count({ where }),
    prisma.membershipPlan.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const exportQs = new URLSearchParams(Object.entries({ status: sp.status, plan: sp.plan, q: sp.q }).filter(([, v]) => v) as [string, string][]);
  return (
    <AdminPage title="Membership applications" description={`${total} matching`} flash={sp} actions={can(user, "members.export") && <DownloadLink href={`/api/v1/admin/exports/applications?${exportQs}`}>Export CSV</DownloadLink>}>
      <form className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_160px_180px_auto]">
        <input name="q" defaultValue={sp.q} placeholder="Search name, email, phone, reference" className="input" aria-label="Search" />
        <select name="status" defaultValue={sp.status ?? ""} className="input" aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="plan" defaultValue={sp.plan ?? ""} className="input" aria-label="Plan">
          <option value="">All plans</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn-dark">Filter</button>
      </form>
      <Table head={["Reference", "Applicant", "Plan", "Fee", "Status", "Payment", "Submitted"]} empty={!rows.length}>
        {rows.map((a) => (
          <tr key={a.id}>
            <td><Link className="font-mono text-xs font-semibold text-brand hover:underline" href={`/admin/applications/${a.id}`}>{a.referenceNo}</Link></td>
            <td><p className="font-medium text-slate-900">{a.fullName}</p><p className="text-xs text-slate-500">{a.email}</p></td>
            <td>{a.plan.name}</td>
            <td>{formatMoney(a.feeMinor, a.currency)}</td>
            <td><StatusBadge status={a.status} /></td>
            <td>{a.feeMinor === 0 ? <span className="text-xs text-slate-400">Not required</span> : a.payments[0] ? <StatusBadge status={a.payments[0].status} /> : <span className="text-xs text-slate-400">After approval</span>}</td>
            <td className="whitespace-nowrap">{formatDate(a.createdAt)}</td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 25)} base={{ status: sp.status, plan: sp.plan, q: sp.q }} />
    </AdminPage>
  );
}
