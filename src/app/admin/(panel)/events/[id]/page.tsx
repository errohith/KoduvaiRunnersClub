import Link from "next/link";
import { notFound } from "next/navigation";
import type { EventCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePagePermission, can } from "@/lib/auth/session";
import { formatMoney, minorToMajorString } from "@/lib/money";
import { AdminPage, Check, Input, Panel, Select, Table } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { EventForm } from "@/components/admin/EventForm";
import { Alert, StatusBadge } from "@/components/ui";
import { addCustomFieldAction, deleteCategoryAction, deleteCustomFieldAction, deleteEventAction, eventStatusAction, notifyEventUpdateAction, saveCategoryAction } from "@/server/admin/event-actions";
import { previewEventDeletion } from "@/server/services/event-deletion";

function CategoryForm({ eventId, c, currency }: { eventId: string; c?: EventCategory; currency: string }) {
  return (
    <form action={saveCategoryAction} className="grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
      <input type="hidden" name="eventId" value={eventId} />
      {c && <input type="hidden" name="id" value={c.id} />}
      <Input name="name" label="Name" defaultValue={c?.name} required className="sm:col-span-2" />
      <Input name="distanceKm" label="Km" defaultValue={c?.distanceKm?.toString()} />
      <Input name="fee" label={`Fee (${currency})`} defaultValue={c ? minorToMajorString(c.feeMinor, currency) : "0"} />
      <Input name="capacity" label="Capacity" type="number" min={0} defaultValue={c?.capacity} />
      <Input name="minAge" label="Min age" type="number" defaultValue={c?.minAge} />
      <Input name="maxAge" label="Max age" type="number" defaultValue={c?.maxAge} />
      <Input name="startTime" label="Start" defaultValue={c?.startTime} placeholder="06:00" />
      <Input name="sortOrder" label="Order" type="number" defaultValue={c?.sortOrder ?? 0} />
      <div className="flex items-end gap-3 sm:col-span-3"><Check name="isActive" label="Active" defaultChecked={c?.isActive ?? true} /><SubmitButton className="btn-dark btn-sm">{c ? "Save" : "Add category"}</SubmitButton></div>
    </form>
  );
}

export default async function EventAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requirePagePermission("events.view");
  const { id } = await params;
  const [event, media] = await Promise.all([
    prisma.event.findUnique({ where: { id }, include: { categories: { orderBy: { sortOrder: "asc" } }, customFields: { orderBy: { sortOrder: "asc" } } } }),
    prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  if (!event) notFound();
  const manage = can(user, "events.manage");
  const deletion = can(user, "events.delete") ? await previewEventDeletion(event.id) : null;

  return (
    <AdminPage
      title={event.title}
      description={<span className="flex items-center gap-2"><StatusBadge status={event.status} /> {event.registeredCount}{event.capacity !== null ? ` / ${event.capacity}` : ""} places taken</span>}
      flash={await searchParams}
      actions={
        <>
          <Link href={`/admin/events/${event.id}/registrations`} className="btn-outline btn-sm">Registrations</Link>
          {event.status !== "DRAFT" && <Link href={`/events/${event.slug}`} target="_blank" className="btn-outline btn-sm">View ↗</Link>}
        </>
      }
    >
      {manage && event.status !== "CANCELLED" && (
        <Panel title="Publishing">
          <div className="flex flex-wrap items-start gap-3">
            <form action={eventStatusAction} className="flex gap-2">
              <input type="hidden" name="id" value={event.id} />
              {event.status !== "PUBLISHED" && <SubmitButton name="status" value="PUBLISHED" className="btn-primary btn-sm">Publish</SubmitButton>}
              {event.status === "PUBLISHED" && <SubmitButton name="status" value="DRAFT" className="btn-outline btn-sm">Unpublish</SubmitButton>}
              {event.status === "PUBLISHED" && event.startsAt < new Date() && <SubmitButton name="status" value="COMPLETED" className="btn-outline btn-sm">Mark completed</SubmitButton>}
            </form>
            <form action={eventStatusAction} className="flex flex-1 gap-2">
              <input type="hidden" name="id" value={event.id} />
              <input name="reason" className="input py-1.5 text-sm" placeholder="Cancellation reason (sent to participants)" aria-label="Cancellation reason" />
              <SubmitButton name="status" value="CANCELLED" className="btn-danger btn-sm" confirm="Cancel this event? All registrants will be notified. This cannot be undone.">Cancel event</SubmitButton>
            </form>
          </div>
        </Panel>
      )}
      {event.status === "CANCELLED" && <Alert tone="error" title="Cancelled">{event.cancelledReason}</Alert>}

      <Panel title="Distances & categories">
        {event.categories.length === 0 && <p className="mb-3 text-sm text-amber-700">Add at least one category before publishing (e.g. “10K Run”, or “Group run” for free club runs).</p>}
        <div className="space-y-4 divide-y divide-slate-100">
          {event.categories.map((c) => (
            <div key={c.id} className="pt-4 first:pt-0">
              <p className="mb-2 text-sm font-medium">{c.name} — {formatMoney(c.feeMinor, event.currency)} · {c.registeredCount}{c.capacity !== null ? `/${c.capacity}` : ""} taken</p>
              {manage ? (
                <>
                  <CategoryForm eventId={event.id} c={c} currency={event.currency} />
                  <form action={deleteCategoryAction} className="mt-1">
                    <input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="id" value={c.id} />
                    <SubmitButton className="btn-ghost btn-sm text-red-700" confirm="Delete this category?">Delete</SubmitButton>
                  </form>
                </>
              ) : null}
            </div>
          ))}
          {manage && <div className="pt-4"><p className="mb-2 text-sm font-semibold">Add category</p><CategoryForm eventId={event.id} currency={event.currency} /></div>}
        </div>
      </Panel>

      <Panel title="Custom registration fields">
        <Table head={["Label", "Key", "Type", "Required", ""]} empty={!event.customFields.length}>
          {event.customFields.map((f) => (
            <tr key={f.id}>
              <td>{f.label}{f.options.length ? <span className="block text-xs text-slate-500">{f.options.join(", ")}</span> : null}</td>
              <td className="font-mono text-xs">{f.key}</td>
              <td>{f.type}</td>
              <td>{f.required ? "Yes" : "No"}</td>
              <td>{manage && <form action={deleteCustomFieldAction}><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="id" value={f.id} /><SubmitButton className="btn-ghost btn-sm text-red-700" confirm="Remove this field and its answers?">Remove</SubmitButton></form>}</td>
            </tr>
          ))}
        </Table>
        {manage && (
          <form action={addCustomFieldAction} className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <input type="hidden" name="eventId" value={event.id} />
            <Input name="label" label="Label" required className="sm:col-span-2" />
            <Select name="type" label="Type" options={[["TEXT", "Short text"], ["TEXTAREA", "Long text"], ["NUMBER", "Number"], ["DATE", "Date"], ["SELECT", "Dropdown"], ["CHECKBOX", "Checkbox"]]} />
            <Input name="options" label="Options (dropdown)" placeholder="Yes, No" />
            <Input name="helpText" label="Help text" />
            <div className="flex items-end gap-3"><Check name="required" label="Required" /><SubmitButton className="btn-dark btn-sm">Add</SubmitButton></div>
          </form>
        )}
      </Panel>

      {manage && event.status === "PUBLISHED" && (
        <Panel title="Notify registrants of a change">
          <form action={notifyEventUpdateAction} className="space-y-2">
            <input type="hidden" name="eventId" value={event.id} />
            <textarea name="message" rows={3} className="input" placeholder="e.g. The 10K start moves to 06:30 because of road works." aria-label="Update message" />
            <SubmitButton className="btn-dark btn-sm" confirm="Send this operational update to all registrants?">Send update</SubmitButton>
            <p className="help">Sent as an operational message by email (and WhatsApp to opted-in runners) using the “event.updated” template.</p>
          </form>
        </Panel>
      )}

      {manage ? <EventForm event={event} media={media} /> : <Alert>You have read-only access to this event.</Alert>}

      {deletion && (
        <section id="delete" className="rounded-xl border border-red-200 bg-red-50/50">
          <h2 className="border-b border-red-200 px-4 py-3 font-sans text-sm font-semibold normal-case tracking-normal text-red-800">Delete event</h2>
          <div className="space-y-3 p-4 text-sm text-slate-700">
            {deletion.allowed ? (
              <>
                <p>
                  Permanently deletes this event, its distances, custom fields{deletion.registrations ? <>, and <strong>{deletion.registrations} registration(s)</strong> with their message logs</> : ""}. Registrants are <strong>not</strong> notified — use “Cancel event” above if people should be told. This cannot be undone.
                </p>
                <form action={deleteEventAction} className="space-y-2">
                  <input type="hidden" name="id" value={event.id} />
                  <label htmlFor="confirm" className="label">Type <span className="font-mono">{deletion.slug}</span> to confirm</label>
                  <input id="confirm" name="confirm" required autoComplete="off" className="input font-mono" />
                  <SubmitButton className="btn-danger btn-sm" confirm="Permanently delete this event? This cannot be undone.">Delete event permanently</SubmitButton>
                </form>
              </>
            ) : (
              <p>{deletion.paidRegistrations} registration(s) have received payments, so this event can&apos;t be deleted. Cancel the event instead, or delete those registrations individually first (they are anonymised and their payments kept).</p>
            )}
          </div>
        </section>
      )}
    </AdminPage>
  );
}
