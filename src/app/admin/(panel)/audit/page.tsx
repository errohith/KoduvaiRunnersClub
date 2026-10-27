import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { AdminPage, Pagination, Table } from "@/components/admin/kit";

export default async function Audit({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePagePermission("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.AuditLogWhereInput = sp.q ? { OR: [{ action: { contains: sp.q } }, { entityType: { contains: sp.q } }, { entityId: sp.q }] } : {};
  const [rows, total] = await Promise.all([prisma.auditLog.findMany({ where, include: { actor: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 }), prisma.auditLog.count({ where })]);
  return (
    <AdminPage title="Audit log" description="Sensitive administrative actions, newest first.">
      <form className="flex gap-2"><input name="q" defaultValue={sp.q} placeholder="Filter by action, entity type or id" className="input max-w-md" aria-label="Filter" /><button className="btn-dark">Filter</button></form>
      <Table head={["When", "Who", "Action", "Entity", "Details", "IP"]} empty={!rows.length}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</td>
            <td className="text-xs">{r.actor?.email ?? "system"}</td>
            <td className="font-mono text-xs">{r.action}</td>
            <td className="text-xs">{r.entityType}{r.entityId && <span className="block font-mono text-slate-400">{r.entityId.slice(0, 13)}</span>}</td>
            <td className="max-w-sm truncate font-mono text-[11px] text-slate-500">{JSON.stringify(r.metadata)}</td>
            <td className="text-xs">{r.ip}</td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 50)} base={{ q: sp.q }} />
    </AdminPage>
  );
}
