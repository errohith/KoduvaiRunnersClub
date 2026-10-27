import type { Event, MediaAsset } from "@prisma/client";
import { toLocalInputValue } from "@/lib/time";
import { saveEventAction } from "@/server/admin/event-actions";
import { Check, Input, Panel, Select, Textarea } from "./kit";
import { SubmitButton } from "./buttons";

export function EventForm({ event, media }: { event?: Event; media: MediaAsset[] }) {
  const e = event;
  const schedule = ((e?.schedule as { time: string; label: string }[]) ?? []).map((s) => `${s.time} | ${s.label}`).join("\n");
  return (
    <form action={saveEventAction} className="space-y-6">
      {e && <input type="hidden" name="id" value={e.id} />}
      <Panel title="Basics">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input name="title" label="Title" defaultValue={e?.title} required className="lg:col-span-2" />
          <Select name="type" label="Type" defaultValue={e?.type ?? "CLUB_RUN"} options={[["CLUB_RUN", "Club run"], ["MARATHON", "Marathon / race"], ["TRAINING", "Training"], ["SOCIAL", "Social"], ["VOLUNTEER", "Volunteering"], ["OTHER", "Other"]]} />
          <Input name="slug" label="URL slug" defaultValue={e?.slug} help="Leave blank to generate from the title" />
          <Input name="startsAt" label="Starts" type="datetime-local" defaultValue={toLocalInputValue(e?.startsAt)} required />
          <Input name="endsAt" label="Ends" type="datetime-local" defaultValue={toLocalInputValue(e?.endsAt)} />
          <Textarea name="summary" label="Summary (cards & SEO)" defaultValue={e?.summary} rows={2} required className="sm:col-span-2 lg:col-span-3" />
          <Textarea name="description" label="Description (Markdown)" defaultValue={e?.description} rows={6} className="sm:col-span-2 lg:col-span-3" />
          <Select name="coverId" label="Cover photo" defaultValue={e?.coverId} options={[["", "None (uses default artwork)"], ...media.map((m) => [m.id, m.altText || m.originalName] as [string, string])]} help="Upload photos in Media & gallery" />
        </div>
      </Panel>
      <Panel title="Venue & route">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input name="venueName" label="Venue" defaultValue={e?.venueName} required />
          <Input name="city" label="City" defaultValue={e?.city ?? "Koduvai"} required />
          <Input name="venueAddress" label="Address" defaultValue={e?.venueAddress} />
          <Input name="mapUrl" label="Map link" defaultValue={e?.mapUrl} placeholder="https://maps.google.com/…" />
          <Input name="routeMapUrl" label="Route map link" defaultValue={e?.routeMapUrl} placeholder="https://www.strava.com/routes/…" />
          <Textarea name="routeDescription" label="Route description" defaultValue={e?.routeDescription} rows={2} className="sm:col-span-2 lg:col-span-3" />
          <Textarea name="schedule" label="Schedule (one per line: 05:00 | Bib collection)" defaultValue={schedule} rows={4} className="sm:col-span-2 lg:col-span-3" mono />
        </div>
      </Panel>
      <Panel title="Registration">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4">
            <Check name="registrationEnabled" label="Registration enabled" defaultChecked={e?.registrationEnabled} help="Event must also be published" />
          </div>
          <Input name="registrationOpensAt" label="Opens" type="datetime-local" defaultValue={toLocalInputValue(e?.registrationOpensAt)} help="Blank = open now" />
          <Input name="registrationClosesAt" label="Closes (deadline)" type="datetime-local" defaultValue={toLocalInputValue(e?.registrationClosesAt)} />
          <Input name="capacity" label="Overall capacity" type="number" min={0} defaultValue={e?.capacity} help={e ? `${e.registeredCount} places taken. Blank = unlimited` : "Blank = unlimited"} />
          <Input name="currency" label="Currency" defaultValue={e?.currency ?? "INR"} />
          <div className="grid gap-2 sm:col-span-2 lg:col-span-4 lg:grid-cols-3">
            <Check name="waitlistEnabled" label="Waitlist when full" defaultChecked={e?.waitlistEnabled} />
            <Check name="volunteersEnabled" label="Accept volunteer sign-ups" defaultChecked={e?.volunteersEnabled} />
            <Check name="collectDateOfBirth" label="Collect date of birth" defaultChecked={e?.collectDateOfBirth} />
            <Check name="collectGender" label="Collect results category (gender)" defaultChecked={e?.collectGender} help="Only if needed for age-group results" />
            <Check name="collectTshirtSize" label="Collect T-shirt size" defaultChecked={e?.collectTshirtSize} />
          </div>
          <Input name="tshirtSizes" label="T-shirt sizes (comma separated)" defaultValue={e?.tshirtSizes.join(", ") || "XS, S, M, L, XL, XXL"} className="sm:col-span-2" />
        </div>
      </Panel>
      <Panel title="Terms, waiver & policies">
        <div className="grid gap-3 sm:grid-cols-2">
          <Textarea name="eligibility" label="Eligibility" defaultValue={e?.eligibility} rows={2} />
          <Textarea name="terms" label="Event terms" defaultValue={e?.terms} rows={2} />
          <Textarea name="waiverText" label="Liability waiver (must be accepted)" defaultValue={e?.waiverText} rows={3} />
          <Textarea name="medicalDeclarationText" label="Medical / safety declaration (must be confirmed)" defaultValue={e?.medicalDeclarationText} rows={3} help="Keep it to a declaration — do not request medical records." />
          <Textarea name="cancellationPolicy" label="Cancellation & refund policy" defaultValue={e?.cancellationPolicy} rows={2} className="sm:col-span-2" />
        </div>
      </Panel>
      <SubmitButton className="btn-primary">{e ? "Save event" : "Create draft event"}</SubmitButton>
    </form>
  );
}
