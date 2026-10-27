import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { AdminPage, Pagination, Table } from "@/components/admin/kit";
import { StatusBadge } from "@/components/ui";

const STATUSES = ["QUEUED", "SENDING", "SENT", "DELIVERED", "READ", "FAILED", "SKIPPED", "CANCELLED"];

export default async function Deliveries({ searchParams }: { searchParams: Promise<{ status?: string; channel?: string; q?: string; page?: string }> }) {
  await requirePagePermission("comms.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.NotificationDeliveryWhereInput = {
    ...(STATUSES.includes(sp.status ?? "") ? { status: sp.status as never } : {}),
    ...(sp.channel === "EMAIL" || sp.channel === "WHATSAPP" ? { channel: sp.channel } : {}),
    ...(sp.q ? { OR: [{ recipientEmail: { contains: sp.q.toLowerCase() } }, { recipientPhone: { contains: sp.q } }, { templateKey: { contains: sp.q } }] } : {}),
  };
  const [rows, total] = await Promise.all([prisma.notificationDelivery.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 }), prisma.notificationDelivery.count({ where })]);
  return (
    <AdminPage title="Delivery log" description="Every notification with its provider outcome. “Sent” means accepted by the provider; “Delivered” requires a provider callback.">
      <form className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_150px_150px_auto]">
        <input name="q" defaultValue={sp.q} placeholder="Recipient or template key" className="input" aria-label="Search" />
        <select name="status" defaultValue={sp.status ?? ""} className="input" aria-label="Status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select name="channel" defaultValue={sp.channel ?? ""} className="input" aria-label="Channel"><option value="">All channels</option><option>EMAIL</option><option>WHATSAPP</option></select>
        <button className="btn-dark">Filter</button>
      </form>
      <Table head={["When", "Recipient", "Template / campaign", "Channel", "Status", "Attempts", "Detail"]} empty={!rows.length}>
        {rows.map((d) => (
          <tr key={d.id}>
            <td className="whitespace-nowrap text-xs">{formatDateTime(d.createdAt)}</td>
            <td>{d.recipientName}<span className="block text-xs text-slate-500">{d.recipientEmail ?? d.recipientPhone}</span></td>
            <td className="font-mono text-xs">{d.templateKey ?? (d.campaignId ? "campaign" : d.relatedType)}</td>
            <td>{d.channel}</td>
            <td><StatusBadge status={d.status} /></td>
            <td>{d.attempts}</td>
            <td className="max-w-xs text-xs text-slate-500">{d.lastError ?? d.providerMessageId}</td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 50)} base={{ status: sp.status, channel: sp.channel, q: sp.q }} />
    </AdminPage>
  );
}
