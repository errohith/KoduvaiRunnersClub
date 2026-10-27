import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { AdminPage, Table } from "@/components/admin/kit";
import { Badge } from "@/components/ui";

export default async function Templates({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePagePermission("templates.manage");
  const templates = await prisma.notificationTemplate.findMany({ orderBy: [{ key: "asc" }, { channel: "asc" }] });
  return (
    <AdminPage title="Notification templates" description="Automatic messages sent by the system. Use {{variables}} shown on each template." flash={await searchParams}>
      <Table head={["Template", "Key", "Channel", "Type", "Status"]}>
        {templates.map((t) => (
          <tr key={t.id}>
            <td><Link className="font-medium hover:underline" href={`/admin/templates/${t.id}`}>{t.name}</Link></td>
            <td className="font-mono text-xs">{t.key}</td>
            <td>{t.channel}</td>
            <td className="text-xs">{t.category.toLowerCase()}</td>
            <td>
              {!t.isActive ? <Badge>Disabled</Badge> : t.channel === "WHATSAPP" && !t.whatsappTemplateName ? <Badge tone="amber">Needs approved template</Badge> : <Badge tone="green">Active</Badge>}
            </td>
          </tr>
        ))}
      </Table>
    </AdminPage>
  );
}
