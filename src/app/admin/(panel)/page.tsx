import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission, can } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { AdminPage, Panel, Stat, Table } from "@/components/admin/kit";
import { Alert, Badge } from "@/components/ui";
import { paymentsStatus } from "@/server/services/payments";
import { config } from "@/config/env";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requirePagePermission("dashboard.view");
  const { denied } = await searchParams;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400_000);
  const [apps, pending, active, byPlan, plans, upcoming, revenue, pendingPayments, deliveries, messages] = await Promise.all([
    prisma.membershipApplication.count(),
    prisma.membershipApplication.count({ where: { status: "PENDING" } }),
    prisma.membership.count({ where: { status: "ACTIVE" } }),
    prisma.membership.groupBy({ by: ["planId"], where: { status: "ACTIVE" }, _count: true }),
    prisma.membershipPlan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.event.findMany({
      where: { status: "PUBLISHED", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 6,
      include: { _count: { select: { registrations: { where: { status: "WAITLISTED" } } } } },
    }),
    prisma.payment.groupBy({ by: ["purpose", "currency"], where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } }, _sum: { amountMinor: true, refundedMinor: true } }),
    prisma.payment.count({ where: { status: { in: ["PENDING", "INITIATED"] } } }),
    prisma.notificationDelivery.groupBy({ by: ["status"], where: { createdAt: { gte: weekAgo } }, _count: true }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
  ]);
  const planCount = new Map(byPlan.map((b) => [b.planId, b._count]));
  const pay = paymentsStatus();
  const net = (purpose: string) => revenue.filter((r) => r.purpose === purpose).reduce((s, r) => s + (r._sum.amountMinor ?? 0) - (r._sum.refundedMinor ?? 0), 0);

  return (
    <AdminPage title={`Welcome, ${user.name.split(" ")[0]}`} description="What needs attention across the club today.">
      {denied && <Alert tone="error">You don&apos;t have access to that page.</Alert>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {!pay.enabled && <Alert tone="info" title="Online payments are disabled">Paid registrations are saved as payment pending. Record offline payments from the Payments page, or see docs/INTEGRATIONS.md to enable a provider.</Alert>}
        {!config.EMAIL_ENABLED && <Alert tone="warning" title="Email sending is disabled">Notifications are recorded as skipped. Set EMAIL_ENABLED=true with a provider to send.</Alert>}
        {!config.WHATSAPP_ENABLED && <Alert tone="info" title="WhatsApp is disabled">Configure the WhatsApp Business Platform in .env to enable it.</Alert>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pending approvals" value={pending} href={can(user, "members.view") ? "/admin/applications?status=PENDING" : undefined} />
        <Stat label="Active members" value={active} href={can(user, "members.view") ? "/admin/members" : undefined} />
        <Stat label="Total applications" value={apps} />
        <Stat label="New messages" value={messages} href={can(user, "contact.view") ? "/admin/messages" : undefined} />
        {can(user, "payments.view") && (
          <>
            <Stat label="Membership revenue" value={formatMoney(net("MEMBERSHIP"))} hint="Net of refunds" />
            <Stat label="Event revenue" value={formatMoney(net("EVENT_REGISTRATION"))} hint="Net of refunds" />
            <Stat label="Payments pending" value={pendingPayments} href="/admin/payments?status=PENDING" />
          </>
        )}
        <Stat label="Messages sent (7 days)" value={deliveries.filter((d) => ["SENT", "DELIVERED", "READ"].includes(d.status)).reduce((s, d) => s + d._count, 0)} hint={`${deliveries.find((d) => d.status === "FAILED")?._count ?? 0} failed · ${deliveries.find((d) => d.status === "SKIPPED")?._count ?? 0} skipped`} href={can(user, "comms.view") ? "/admin/deliveries" : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Upcoming events" actions={can(user, "events.view") && <Link className="text-sm text-brand" href="/admin/events">All events</Link>}>
          <Table head={["Event", "Date", "Registered", "Waitlist"]} empty={!upcoming.length}>
            {upcoming.map((e) => (
              <tr key={e.id}>
                <td><Link className="font-medium text-slate-900 hover:underline" href={`/admin/events/${e.id}/registrations`}>{e.title}</Link></td>
                <td className="whitespace-nowrap">{formatDateTime(e.startsAt)}</td>
                <td>{e.registeredCount}{e.capacity !== null ? ` / ${e.capacity}` : ""}
                  {e.capacity ? <div className="mt-1 h-1.5 w-24 rounded bg-slate-100"><div className="h-1.5 rounded bg-brand" style={{ width: `${Math.min(100, (e.registeredCount / e.capacity) * 100)}%` }} /></div> : null}
                </td>
                <td>{e._count.registrations}</td>
              </tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Active members by plan">
          <Table head={["Plan", "Fee", "Status", "Active members"]}>
            {plans.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td>{formatMoney(p.feeMinor, p.currency)}</td>
                <td>{p.isActive ? <Badge tone="green">Open</Badge> : <Badge>Disabled</Badge>}</td>
                <td>{planCount.get(p.id) ?? 0}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </AdminPage>
  );
}
