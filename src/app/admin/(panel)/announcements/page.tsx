import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission, can } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { AdminPage, Table } from "@/components/admin/kit";
import { Alert, StatusBadge } from "@/components/ui";
import { config } from "@/config/env";

export default async function Announcements({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requirePagePermission("comms.view");
  const campaigns = await prisma.notificationCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { createdBy: true } });
  return (
    <AdminPage title="Announcements" description="Club-wide messages by email and/or WhatsApp, sent in the background with per-recipient tracking." flash={await searchParams} actions={can(user, "comms.send") && config.MEMBER_ANNOUNCEMENTS_ENABLED && <Link className="btn-primary btn-sm" href="/admin/announcements/new">New announcement</Link>}>
      {!config.MEMBER_ANNOUNCEMENTS_ENABLED && <Alert tone="warning">Announcements are disabled (MEMBER_ANNOUNCEMENTS_ENABLED=false).</Alert>}
      <Table head={["Title", "Channels", "Type", "Status", "Recipients", "Scheduled / sent", "By"]} empty={!campaigns.length}>
        {campaigns.map((c) => (
          <tr key={c.id}>
            <td><Link className="font-medium hover:underline" href={`/admin/announcements/${c.id}`}>{c.title}</Link></td>
            <td>{c.channels.join(" + ")}</td>
            <td className="text-xs">{c.category.toLowerCase()}</td>
            <td><StatusBadge status={c.status} /></td>
            <td>{c.recipientCount || "—"}</td>
            <td className="whitespace-nowrap text-xs">{formatDateTime(c.dispatchedAt ?? c.scheduledAt)}</td>
            <td className="text-xs">{c.createdBy?.name}</td>
          </tr>
        ))}
      </Table>
    </AdminPage>
  );
}
