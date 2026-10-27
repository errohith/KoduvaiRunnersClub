import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission, can } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { audienceSchema } from "@/validation/schemas";
import { campaignStats, previewAudience } from "@/server/services/campaigns";
import { AdminPage, Panel, Stat, Table } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { Alert, StatusBadge } from "@/components/ui";
import { cancelCampaignAction, retryCampaignAction, scheduleCampaignAction, testCampaignAction } from "@/server/admin/comms-actions";

const AUDIENCE_LABEL: Record<string, string> = { ALL_ACTIVE_MEMBERS: "All active members", ALL_APPROVED_OR_ACTIVE: "Approved + active applicants", PLAN: "Members of a plan", EVENT_PARTICIPANTS: "Event participants", EVENT_VOLUNTEERS: "Event volunteers" };

export default async function AnnouncementDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string; status?: string }> }) {
  const user = await requirePagePermission("comms.view");
  const { id } = await params;
  const sp = await searchParams;
  const c = await prisma.notificationCampaign.findUnique({ where: { id } });
  if (!c) notFound();
  const audience = audienceSchema.parse(c.audience);
  const editable = c.status === "DRAFT" || c.status === "SCHEDULED";
  const [preview, stats, deliveries] = await Promise.all([
    editable ? previewAudience(audience, c.channels, c.category) : null,
    campaignStats(id),
    prisma.notificationDelivery.findMany({ where: { campaignId: id, ...(sp.status ? { status: sp.status as never } : {}) }, orderBy: { createdAt: "asc" }, take: 200 }),
  ]);
  const send = can(user, "comms.send");
  const total = (status: string[]) => stats.filter((s) => status.includes(s.status)).reduce((a, s) => a + s.count, 0);

  return (
    <AdminPage title={c.title} description={<span className="flex items-center gap-2"><StatusBadge status={c.status} /> {AUDIENCE_LABEL[audience.type]} · {c.channels.join(" + ")} · {c.category.toLowerCase()}</span>} flash={sp}>
      {preview && (
        <Alert tone="info" title="Audience preview">
          {preview.total} people in the audience. Will receive: {c.channels.map((ch) => `${ch.toLowerCase()} ${preview[ch] ?? 0}`).join(", ")} (after consent and contact checks). The final list is snapshotted when sending starts.
        </Alert>
      )}
      {!editable && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Recipients" value={c.recipientCount} />
          <Stat label="Sent / delivered" value={total(["SENT", "DELIVERED", "READ"])} />
          <Stat label="Queued" value={total(["QUEUED", "SENDING"])} />
          <Stat label="Failed" value={total(["FAILED"])} />
          <Stat label="Skipped (consent/disabled)" value={total(["SKIPPED", "CANCELLED"])} />
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Content" className="xl:col-span-2">
          {c.subject && <p className="text-sm"><span className="text-slate-500">Subject:</span> {c.subject}</p>}
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 font-sans text-sm text-slate-800">{c.bodyText}</pre>
          {c.whatsappTemplateName && <p className="mt-2 text-xs text-slate-500">WhatsApp template: {c.whatsappTemplateName} ({c.whatsappLanguage})</p>}
        </Panel>
        <div className="space-y-6">
          {send && editable && (
            <>
              <Panel title="Send a test">
                <form action={testCampaignAction} className="space-y-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="testEmail" type="email" defaultValue={user.email} className="input" aria-label="Test email" placeholder="Test email" />
                  <input name="testPhone" className="input" aria-label="Test WhatsApp number" placeholder="Test WhatsApp number (+91…)" />
                  <SubmitButton className="btn-outline btn-sm">Send test</SubmitButton>
                </form>
              </Panel>
              <Panel title="Send">
                <form action={scheduleCampaignAction} className="space-y-3">
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton name="mode" value="now" className="btn-primary btn-sm" confirm={`Send to ${preview?.total ?? 0} people now?`}>Send now</SubmitButton>
                  <div className="flex gap-2">
                    <input type="datetime-local" name="scheduledAt" className="input py-1.5 text-sm" aria-label="Schedule time" />
                    <SubmitButton name="mode" value="schedule" className="btn-outline btn-sm">Schedule</SubmitButton>
                  </div>
                  {c.status === "SCHEDULED" && <p className="help">Scheduled for {formatDateTime(c.scheduledAt)}.</p>}
                </form>
              </Panel>
            </>
          )}
          {send && (
            <Panel title="Manage">
              <div className="flex flex-wrap gap-2">
                {c.status !== "COMPLETED" && c.status !== "CANCELLED" && <form action={cancelCampaignAction}><input type="hidden" name="id" value={c.id} /><SubmitButton className="btn-outline btn-sm" confirm="Cancel remaining sends?">Cancel</SubmitButton></form>}
                {total(["FAILED"]) > 0 && <form action={retryCampaignAction}><input type="hidden" name="id" value={c.id} /><SubmitButton className="btn-dark btn-sm">Retry failed</SubmitButton></form>}
              </div>
            </Panel>
          )}
        </div>
      </div>
      {!editable && (
        <Panel title="Deliveries" actions={<form className="flex gap-2"><select name="status" defaultValue={sp.status ?? ""} className="input py-1 text-xs" aria-label="Filter status"><option value="">All</option>{["QUEUED", "SENT", "DELIVERED", "READ", "FAILED", "SKIPPED", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}</select><button className="btn-outline btn-sm">Filter</button></form>}>
          <Table head={["Recipient", "Channel", "Status", "Attempts", "Detail"]} empty={!deliveries.length}>
            {deliveries.map((d) => (
              <tr key={d.id}>
                <td>{d.recipientName}<span className="block text-xs text-slate-500">{d.recipientEmail ?? d.recipientPhone}</span></td>
                <td>{d.channel}</td>
                <td><StatusBadge status={d.status} /></td>
                <td>{d.attempts}</td>
                <td className="text-xs text-slate-500">{d.lastError ?? d.providerMessageId}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
    </AdminPage>
  );
}
