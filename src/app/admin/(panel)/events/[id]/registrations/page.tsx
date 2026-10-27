import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePagePermission, can } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { AdminPage, Pagination, Stat, Table, DownloadLink } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { StatusBadge } from "@/components/ui";
import { attendanceAction, cancelRegistrationAction, deleteRegistrationAction, promoteWaitlistAction } from "@/server/admin/event-actions";

const STATUSES = ["CONFIRMED", "PENDING_PAYMENT", "WAITLISTED", "CANCELLED"] as const;

export default async function Registrations({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; category?: string; type?: string; q?: string; page?: string; ok?: string; error?: string }> }) {
  const user = await requirePagePermission("registrations.view");
  const { id } = await params;
  const sp = await searchParams;
  const event = await prisma.event.findUnique({ where: { id }, include: { categories: { orderBy: { sortOrder: "asc" } } } });
  if (!event) notFound();
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.EventRegistrationWhereInput = {
    eventId: id,
    ...(STATUSES.includes(sp.status as never) ? { status: sp.status as (typeof STATUSES)[number] } : {}),
    ...(sp.category ? { categoryId: sp.category } : {}),
    ...(sp.type === "VOLUNTEER" || sp.type === "PARTICIPANT" ? { participantType: sp.type } : {}),
    ...(sp.q ? { OR: [{ fullName: { contains: sp.q, mode: "insensitive" } }, { email: { contains: sp.q.toLowerCase() } }, { registrationNo: { contains: sp.q.toUpperCase() } }] } : {}),
  };
  const [rows, total, counts] = await Promise.all([
    prisma.eventRegistration.findMany({ where, include: { category: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: [{ status: "asc" }, { createdAt: "asc" }], skip: (page - 1) * 50, take: 50 }),
    prisma.eventRegistration.count({ where }),
    prisma.eventRegistration.groupBy({ by: ["status"], where: { eventId: id }, _count: true }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const restricted = can(user, "registrations.restricted");
  const manage = can(user, "registrations.manage");
  const canDelete = can(user, "events.delete");
  const qs = new URLSearchParams(Object.entries({ status: sp.status, category: sp.category, type: sp.type, q: sp.q }).filter(([, v]) => v) as [string, string][]);
  const back = `/admin/events/${id}/registrations?${qs}`;

  return (
    <AdminPage
      title={`Registrations — ${event.title}`}
      description={formatDateTime(event.startsAt)}
      flash={sp}
      actions={
        <>
          <Link href={`/admin/events/${id}`} className="btn-outline btn-sm">Edit event</Link>
          {can(user, "registrations.export") && <DownloadLink href={`/api/v1/admin/exports/registrations?eventId=${id}&${qs}`}>Export CSV</DownloadLink>}
          {manage && event.waitlistEnabled && count("WAITLISTED") > 0 && (
            <form action={promoteWaitlistAction}><input type="hidden" name="eventId" value={id} /><SubmitButton className="btn-dark btn-sm">Promote waitlist</SubmitButton></form>
          )}
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Places taken" value={`${event.registeredCount}${event.capacity !== null ? ` / ${event.capacity}` : ""}`} />
        <Stat label="Confirmed" value={count("CONFIRMED")} />
        <Stat label="Payment pending" value={count("PENDING_PAYMENT")} />
        <Stat label="Waitlisted" value={count("WAITLISTED")} />
        <Stat label="Cancelled" value={count("CANCELLED")} />
      </div>
      <form className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_150px_170px_140px_auto]">
        <input name="q" defaultValue={sp.q} placeholder="Name, email, registration no." className="input" aria-label="Search" />
        <select name="status" defaultValue={sp.status ?? ""} className="input" aria-label="Status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select name="category" defaultValue={sp.category ?? ""} className="input" aria-label="Category"><option value="">All categories</option>{event.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select name="type" defaultValue={sp.type ?? ""} className="input" aria-label="Participant type"><option value="">Everyone</option><option value="PARTICIPANT">Participants</option><option value="VOLUNTEER">Volunteers</option></select>
        <button className="btn-dark">Filter</button>
      </form>
      <Table head={["No.", "Name", "Category", "Status", "Fee / payment", restricted ? "Emergency / medical" : "", "Check-in", manage || canDelete ? "Actions" : ""]} empty={!rows.length}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="font-mono text-xs">{r.registrationNo}</td>
            <td><p className="font-medium">{r.fullName}</p><p className="text-xs text-slate-500">{r.email} · {r.phoneE164}</p>{r.tshirtSize && <p className="text-xs text-slate-500">T-shirt {r.tshirtSize}</p>}</td>
            <td>{r.participantType === "VOLUNTEER" ? "Volunteer" : r.category?.name}</td>
            <td><StatusBadge status={r.status} />{r.cancelReason && <span className="block text-xs text-slate-500">{r.cancelReason}</span>}</td>
            <td>{formatMoney(r.feeMinor, r.currency)}{r.payments[0] && <div className="mt-1"><StatusBadge status={r.payments[0].status} /></div>}</td>
            <td className="text-xs">{restricted ? <>{r.emergencyName} · {r.emergencyPhone}{r.medicalNotes && <span className="block text-amber-800">Medical: {r.medicalNotes}</span>}{r.accessibilityNeeds && <span className="block">Access: {r.accessibilityNeeds}</span>}</> : null}</td>
            <td>
              {r.status === "CONFIRMED" && manage ? (
                <form action={attendanceAction}>
                  <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} />
                  {r.attendedAt ? <SubmitButton name="attended" value="0" className="btn-sm rounded-full bg-emerald-100 text-emerald-800">✓ Present</SubmitButton> : <SubmitButton name="attended" value="1" className="btn-outline btn-sm">Check in</SubmitButton>}
                </form>
              ) : r.attendedAt ? "✓" : null}
            </td>
            <td>
              {manage && r.status !== "CANCELLED" && (
                <form action={cancelRegistrationAction}>
                  <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} />
                  <SubmitButton className="btn-ghost btn-sm text-red-700" confirm="Cancel this registration? The runner is notified and the place released.">Cancel</SubmitButton>
                </form>
              )}
              {canDelete && (
                <form action={deleteRegistrationAction}>
                  <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} />
                  <input type="hidden" name="confirm" value={r.registrationNo} />
                  <SubmitButton className="btn-ghost btn-sm text-red-700" confirm={`Permanently delete registration ${r.registrationNo} (${r.fullName})? The runner is not notified. If they paid, their details are anonymised and the payment kept. This cannot be undone.`}>Delete</SubmitButton>
                </form>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={Math.ceil(total / 50)} base={{ status: sp.status, category: sp.category, type: sp.type, q: sp.q }} />
    </AdminPage>
  );
}
