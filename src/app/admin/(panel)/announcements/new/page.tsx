import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { AdminPage, Input, Panel, Select, Textarea } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { createCampaignAction } from "@/server/admin/comms-actions";

export default async function NewAnnouncement({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePagePermission("comms.send");
  const [plans, events] = await Promise.all([
    prisma.membershipPlan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.event.findMany({ where: { startsAt: { gte: new Date(Date.now() - 30 * 86400_000) } }, orderBy: { startsAt: "asc" } }),
  ]);
  return (
    <AdminPage title="New announcement" flash={await searchParams}>
      <form action={createCampaignAction} className="space-y-6">
        <Panel title="Audience & channels">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select name="audienceType" label="Send to" options={[["ALL_ACTIVE_MEMBERS", "All active members"], ["ALL_APPROVED_OR_ACTIVE", "Approved + active applicants"], ["PLAN", "Active members of one plan"], ["EVENT_PARTICIPANTS", "Participants of an event"], ["EVENT_VOLUNTEERS", "Volunteers of an event"]]} />
            <Select name="planId" label="Plan (if by plan)" options={[["", "—"], ...plans.map((p) => [p.id, p.name] as [string, string])]} />
            <Select name="eventId" label="Event (if by event)" options={[["", "—"], ...events.map((e) => [e.id, e.title] as [string, string])]} />
            <Select name="category" label="Message type" defaultValue="PROMOTIONAL" options={[["PROMOTIONAL", "Announcement (opted-in only)"], ["OPERATIONAL", "Operational / urgent (all with contact)"]]} help="Operational = essential service info only. Email marketing opt-outs are respected for announcements." />
            <fieldset className="sm:col-span-2">
              <legend className="label">Channels</legend>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" name="channels" value="EMAIL" defaultChecked className="h-4 w-4 rounded text-brand" /> Email</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="channels" value="WHATSAPP" className="h-4 w-4 rounded text-brand" /> WhatsApp (opted-in only)</label>
              </div>
            </fieldset>
          </div>
        </Panel>
        <Panel title="Message">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="title" label="Internal title" required />
            <Input name="subject" label="Email subject" help="Supports {{name}}" />
            <Textarea name="bodyText" label="Message text" rows={8} required className="sm:col-span-2" help="Plain text; used for WhatsApp parameter {{2}} and as the email text. {{name}} is replaced with the recipient's name." />
            <Textarea name="bodyHtml" label="Email HTML (optional)" rows={5} className="sm:col-span-2" mono help="Leave blank to auto-format the text. Wrapped in the club email layout." />
            <Input name="whatsappTemplateName" label="Approved WhatsApp template name" help="Required for WhatsApp. Template body must use {{1}} = name, {{2}} = message." />
            <Input name="whatsappLanguage" label="Template language" defaultValue="en" />
          </div>
        </Panel>
        <SubmitButton className="btn-primary">Save draft & review</SubmitButton>
      </form>
    </AdminPage>
  );
}
