import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission, can } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { AdminPage, Panel, DownloadLink } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { EmptyState, StatusBadge } from "@/components/ui";
import { contactStatusAction } from "@/server/admin/comms-actions";

export default async function Messages({ searchParams }: { searchParams: Promise<{ status?: string; ok?: string; error?: string }> }) {
  const user = await requirePagePermission("contact.view");
  const sp = await searchParams;
  const status = sp.status === "ARCHIVED" ? "ARCHIVED" : undefined;
  const msgs = await prisma.contactMessage.findMany({ where: status ? { status } : { status: { not: "ARCHIVED" } }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <AdminPage title="Contact messages" flash={sp} actions={<>{can(user, "reports.view") && <DownloadLink href={"/api/v1/admin/exports/contacts"}>Export CSV</DownloadLink>}<Link className="btn-outline btn-sm" href={status ? "/admin/messages" : "/admin/messages?status=ARCHIVED"}>{status ? "Inbox" : "Archived"}</Link></>}>
      {msgs.length === 0 && <EmptyState title="No messages" />}
      {msgs.map((m) => (
        <Panel key={m.id} title={m.subject} actions={<StatusBadge status={m.status} />}>
          <p className="text-sm text-slate-500">{m.name} · <a className="text-brand hover:underline" href={`mailto:${m.email}?subject=${encodeURIComponent("Re: " + m.subject)}`}>{m.email}</a>{m.phone ? ` · ${m.phone}` : ""} · {formatDateTime(m.createdAt)}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{m.message}</p>
          <form action={contactStatusAction} className="mt-3 flex gap-2">
            <input type="hidden" name="id" value={m.id} />
            {m.status === "NEW" && <SubmitButton name="status" value="READ" className="btn-outline btn-sm">Mark read</SubmitButton>}
            {m.status !== "ARCHIVED" ? <SubmitButton name="status" value="ARCHIVED" className="btn-ghost btn-sm">Archive</SubmitButton> : <SubmitButton name="status" value="READ" className="btn-ghost btn-sm">Unarchive</SubmitButton>}
          </form>
        </Panel>
      ))}
    </AdminPage>
  );
}
