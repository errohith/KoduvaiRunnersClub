import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission, can } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { AdminPage, Table } from "@/components/admin/kit";
import { StatusBadge } from "@/components/ui";
import { eventTypeLabel } from "@/components/cards";

export default async function AdminEvents({ searchParams }: { searchParams: Promise<{ when?: string; ok?: string; error?: string }> }) {
  const user = await requirePagePermission("events.view");
  const sp = await searchParams;
  const past = sp.when === "past";
  const events = await prisma.event.findMany({
    where: past ? { startsAt: { lt: new Date() } } : { startsAt: { gte: new Date() } },
    orderBy: { startsAt: past ? "desc" : "asc" },
    include: { _count: { select: { registrations: { where: { status: "WAITLISTED" } } } } },
    take: 100,
  });
  return (
    <AdminPage title="Events & marathons" flash={sp} actions={can(user, "events.manage") && <Link href="/admin/events/new" className="btn-primary btn-sm">New event</Link>}>
      <div className="flex gap-2">
        <Link href="/admin/events" className={`btn-sm ${!past ? "btn-dark" : "btn-outline"}`}>Upcoming</Link>
        <Link href="/admin/events?when=past" className={`btn-sm ${past ? "btn-dark" : "btn-outline"}`}>Past</Link>
      </div>
      <Table head={["Event", "Type", "Date", "Status", "Registration", "Places", "Waitlist", ""]} empty={!events.length}>
        {events.map((e) => (
          <tr key={e.id}>
            <td><Link href={`/admin/events/${e.id}`} className="font-medium text-slate-900 hover:underline">{e.title}</Link></td>
            <td>{eventTypeLabel(e.type)}</td>
            <td className="whitespace-nowrap">{formatDateTime(e.startsAt)}</td>
            <td><StatusBadge status={e.status} /></td>
            <td>{e.registrationEnabled ? "Enabled" : "Off"}</td>
            <td>{e.registeredCount}{e.capacity !== null ? ` / ${e.capacity}` : ""}</td>
            <td>{e._count.registrations}</td>
            <td className="whitespace-nowrap"><Link className="text-brand hover:underline" href={`/admin/events/${e.id}/registrations`}>Registrations</Link></td>
          </tr>
        ))}
      </Table>
    </AdminPage>
  );
}
