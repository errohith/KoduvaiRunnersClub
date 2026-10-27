import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission, can } from "@/lib/auth/session";
import { formatDate } from "@/lib/time";
import { AdminPage, Pagination, Table, DownloadLink } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { StatusBadge } from "@/components/ui";
import { membershipStatusAction, renewAction } from "@/server/admin/membership-actions";

const STATUSES = ["ACTIVE", "EXPIRED", "SUSPENDED", "CANCELLED"] as const;

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ status?: string; plan?: string; q?: string; page?: string; ok?: string; error?: string }> }) {
  const user = await requirePagePermission("members.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.MembershipWhereInput = {
    ...(STATUSES.includes(sp.status as never) ? { status: sp.status as (typeof STATUSES)[number] } : {}),
    ...(sp.plan ? { planId: sp.plan } : {}),
    ...(sp.q ? { OR: [{ fullName: { contains: sp.q, mode: "insensitive" } }, { email: { contains: sp.q.toLowerCase() } }, { membershipNo: { contains: sp.q.toUpperCase() } }] } : {}),
  };
  const [rows, total, plans] = await Promise.all([
    prisma.membership.findMany({ where, include: { plan: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 25, take: 25 }),
    prisma.membership.count({ where }),
    prisma.membershipPlan.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const manage = can(user, "members.manage");
  const back = `/admin/members?${new URLSearchParams(Object.entries({ status: sp.status, plan: sp.plan, q: sp.q, page: sp.page }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <AdminPage title="Members" description={`${total} memberships`} flash={sp} actions={can(user, "members.export") && <DownloadLink href={`/api/v1/admin/exports/members?status=${sp.status ?? ""}&plan=${sp.plan ?? ""}`}>Export CSV</DownloadLink>}>
      <form className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_160px_180px_auto]">
        <input name="q" defaultValue={sp.q} placeholder="Search name, email, membership no." className="input" aria-label="Search" />
        <select name="status" defaultValue={sp.status ?? ""} className="input" aria-label="Status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select name="plan" defaultValue={sp.plan ?? ""} className="input" aria-label="Plan"><option value="">All plans</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <button className="btn-dark">Filter</button>
      </form>
      <Table head={["Member no.", "Name", "Plan", "Status", "Since", "Expires", manage ? "Actions" : ""]} empty={!rows.length}>
        {rows.map((m) => (
          <tr key={m.id}>
            <td><Link href={`/admin/applications/${m.applicationId}`} className="font-mono text-xs font-semibold text-brand hover:underline">{m.membershipNo}</Link></td>
            <td><p className="font-medium">{m.fullName}</p><p className="text-xs text-slate-500">{m.email} · {m.phoneE164}</p></td>
            <td>{m.plan.name}</td>
            <td><StatusBadge status={m.status} /></td>
            <td className="whitespace-nowrap">{formatDate(m.startsAt)}</td>
            <td className="whitespace-nowrap">{m.expiresAt ? formatDate(m.expiresAt) : "No expiry"}</td>
            <td>
              {can(user, "members.delete") && <Link href={`/admin/applications/${m.applicationId}#delete`} className="btn-ghost btn-sm mb-1 text-red-700">Delete…</Link>}
              {manage && m.status !== "CANCELLED" && (
                <div className="flex flex-wrap gap-1.5">
                  <form action={membershipStatusAction}>
                    <input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={back} />
                    {m.status === "SUSPENDED" ? <SubmitButton name="status" value="ACTIVE" className="btn-outline btn-sm">Reactivate</SubmitButton> : m.status === "ACTIVE" ? <SubmitButton name="status" value="SUSPENDED" className="btn-outline btn-sm" confirm="Suspend this membership?">Suspend</SubmitButton> : null}
                  </form>
                  <form action={renewAction} className="flex gap-1">
                    <input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={back} />
                    <input name="months" defaultValue={m.plan.durationMonths ?? 12} className="input w-16 py-1 text-xs" aria-label="Months to renew" />
                    <SubmitButton className="btn-outline btn-sm" confirm="Record a renewal? Make sure the renewal fee (if any) has been verified.">Renew</SubmitButton>
                  </form>
                  <form action={membershipStatusAction}>
                    <input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={back} />
                    <SubmitButton name="status" value="CANCELLED" className="btn-ghost btn-sm text-red-700" confirm="Cancel this membership permanently?">Cancel</SubmitButton>
                  </form>
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 25)} base={{ status: sp.status, plan: sp.plan, q: sp.q }} />
    </AdminPage>
  );
}
