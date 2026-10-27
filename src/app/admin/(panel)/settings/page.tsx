import { requirePagePermission } from "@/lib/auth/session";
import { getSettings } from "@/server/services/settings";
import { AdminPage, Check, Input, Panel, Textarea } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { saveSettingsAction } from "@/server/admin/content-actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePagePermission("settings.manage");
  const s = await getSettings();
  const Form = ({ group, children }: { group: string; children: React.ReactNode }) => (
    <form action={saveSettingsAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="group" value={group} />
      {children}
      <div className="sm:col-span-2"><SubmitButton className="btn-primary btn-sm">Save</SubmitButton></div>
    </form>
  );
  return (
    <AdminPage title="Branding & settings" description="Changes apply immediately — no deployment needed." flash={await searchParams}>
      <Panel title="Branding">
        <Form group="branding">
          <Input name="clubName" label="Club name" defaultValue={s.branding.clubName} required />
          <Input name="tagline" label="Tagline" defaultValue={s.branding.tagline} />
          <Input name="logoUrl" label="Logo URL" defaultValue={s.branding.logoUrl} help="Upload in Media, then paste its URL (e.g. /media/images/…)" />
          <Input name="heroImageUrl" label="Home hero image URL" defaultValue={s.branding.heroImageUrl} help="Use an authentic club photo, landscape, at least 1600px wide" />
          {(["brandColor", "brandDarkColor", "inkColor", "accentColor"] as const).map((k) => (
            <div key={k}>
              <label htmlFor={k} className="label">{{ brandColor: "Primary colour", brandDarkColor: "Primary (hover)", inkColor: "Dark / text colour", accentColor: "Accent colour" }[k]}</label>
              <div className="flex gap-2"><input type="color" defaultValue={s.branding[k]} aria-hidden tabIndex={-1} className="h-10 w-12 rounded border border-slate-300" disabled /><input id={k} name={k} defaultValue={s.branding[k]} className="input font-mono" pattern="#[0-9a-fA-F]{6}" /></div>
            </div>
          ))}
          <Textarea name="footerText" label="Footer text" defaultValue={s.branding.footerText} rows={2} className="sm:col-span-2" />
        </Form>
      </Panel>
      <Panel title="Contact details">
        <Form group="contact">
          <Input name="email" label="Public email" type="email" defaultValue={s.contact.email} />
          <Input name="phone" label="Phone" defaultValue={s.contact.phone} />
          <Input name="whatsapp" label="WhatsApp (display)" defaultValue={s.contact.whatsapp} />
          <Input name="address" label="Address" defaultValue={s.contact.address} />
          <Input name="meetingPoint" label="Weekly meeting point" defaultValue={s.contact.meetingPoint} />
          <Input name="hours" label="Group run times" defaultValue={s.contact.hours} placeholder="Tue/Thu 5:30am, Sun 5:00am" />
          <Input name="mapEmbedUrl" label="Map embed URL" defaultValue={s.contact.mapEmbedUrl} help="Google Maps → Share → Embed a map → copy the src URL" className="sm:col-span-2" />
        </Form>
      </Panel>
      <Panel title="Social links">
        <Form group="social">
          {(["instagram", "facebook", "x", "youtube", "strava"] as const).map((k) => <Input key={k} name={k} label={k[0].toUpperCase() + k.slice(1)} defaultValue={s.social[k]} placeholder="https://…" />)}
        </Form>
      </Panel>
      <Panel title="Membership workflow">
        <Form group="membership">
          <div className="space-y-2 sm:col-span-2">
            <Check name="applicationsOpen" label="Accept new membership applications" defaultChecked={s.membership.applicationsOpen} />
            <Check name="requireApproval" label="Require committee approval (plans can override)" defaultChecked={s.membership.requireApproval} />
            <Check name="requireDateOfBirth" label="Require date of birth" defaultChecked={s.membership.requireDateOfBirth} />
            <Check name="requireEmergencyContact" label="Require emergency contact" defaultChecked={s.membership.requireEmergencyContact} />
            <Check name="renewalsEnabled" label="Renewals enabled (plans with a duration expire and can be renewed)" defaultChecked={s.membership.renewalsEnabled} />
          </div>
          <Input name="currency" label="Default currency" defaultValue={s.membership.currency} />
          <Input name="renewalReminderDays" label="Renewal reminder (days before expiry)" type="number" defaultValue={s.membership.renewalReminderDays} />
        </Form>
      </Panel>
      <Panel title="Search engines">
        <Form group="seo">
          <Input name="defaultTitle" label="Default page title" defaultValue={s.seo.defaultTitle} className="sm:col-span-2" />
          <Textarea name="defaultDescription" label="Default description" defaultValue={s.seo.defaultDescription} rows={2} className="sm:col-span-2" />
        </Form>
      </Panel>
    </AdminPage>
  );
}
