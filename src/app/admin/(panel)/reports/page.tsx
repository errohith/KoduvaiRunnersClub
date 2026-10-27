import { prisma } from "@/lib/db";
import { requirePagePermission, can } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { AdminPage, Panel, Table, DownloadLink } from "@/components/admin/kit";

type MonthRow = { month: Date; purpose: string; currency: string; gross: bigint; refunded: bigint; n: bigint };

export default async function Reports() {
  const user = await requirePagePermission("reports.view");
  const [monthly, plans, appsByStatus, events, deliveries] = await Promise.all([
    prisma.$queryRaw<MonthRow[]>`
      SELECT date_trunc('month', "paid_at") AS month, "purpose"::text AS purpose, "currency",
             SUM("amount_minor")::bigint AS gross, SUM("refunded_minor")::bigint AS refunded, COUNT(*)::bigint AS n
      FROM "payments" WHERE "paid_at" IS NOT NULL AND "status" IN ('SUCCEEDED','PARTIALLY_REFUNDED','REFUNDED')
      GROUP BY 1, 2, 3 ORDER BY 1 DESC LIMIT 36`,
    prisma.membershipPlan.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { memberships: { where: { status: "ACTIVE" } }, applications: true } } } }),
    prisma.membershipApplication.groupBy({ by: ["status"], _count: true }),
    prisma.event.findMany({ orderBy: { startsAt: "desc" }, take: 20, include: { registrations: { select: { status: true, attendedAt: true, participantType: true } } } }),
    prisma.notificationDelivery.groupBy({ by: ["channel", "status"], _count: true }),
  ]);
  return (
    <AdminPage
      title="Reports"
      actions={
        <>
          {can(user, "members.export") && <DownloadLink href={"/api/v1/admin/exports/applications"}>Applications CSV</DownloadLink>}
          {can(user, "members.export") && <DownloadLink href={"/api/v1/admin/exports/members"}>Members CSV</DownloadLink>}
          <DownloadLink href={"/api/v1/admin/exports/payments"}>Payments CSV</DownloadLink>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Revenue by month (paid date)">
          <Table head={["Month", "Type", "Payments", "Gross", "Refunded", "Net"]} empty={!monthly.length}>
            {monthly.map((m, i) => (
              <tr key={i}>
                <td>{formatDate(m.month, { month: "short", year: "numeric" })}</td>
                <td>{m.purpose === "MEMBERSHIP" ? "Membership" : "Events"}</td>
                <td>{Number(m.n)}</td>
                <td>{formatMoney(Number(m.gross), m.currency)}</td>
                <td>{formatMoney(Number(m.refunded), m.currency)}</td>
                <td className="font-semibold">{formatMoney(Number(m.gross - m.refunded), m.currency)}</td>
              </tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Membership">
          <Table head={["Plan", "Applications", "Active members"]}>
            {plans.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p._count.applications}</td><td>{p._count.memberships}</td></tr>)}
          </Table>
          <p className="mt-3 text-sm text-slate-600">Applications by status: {appsByStatus.map((a) => `${a.status.toLowerCase()} ${a._count}`).join(" · ") || "none"}</p>
        </Panel>
        <Panel title="Events (latest 20)">
          <Table head={["Event", "Date", "Confirmed", "Pending pay", "Waitlist", "Volunteers", "Attended"]} empty={!events.length}>
            {events.map((e) => {
              const c = (f: (r: (typeof e.registrations)[number]) => boolean) => e.registrations.filter(f).length;
              return (
                <tr key={e.id}>
                  <td>{e.title}</td><td className="whitespace-nowrap">{formatDate(e.startsAt)}</td>
                  <td>{c((r) => r.status === "CONFIRMED" && r.participantType === "PARTICIPANT")}</td>
                  <td>{c((r) => r.status === "PENDING_PAYMENT")}</td>
                  <td>{c((r) => r.status === "WAITLISTED")}</td>
                  <td>{c((r) => r.participantType === "VOLUNTEER" && r.status === "CONFIRMED")}</td>
                  <td>{c((r) => !!r.attendedAt)}</td>
                </tr>
              );
            })}
          </Table>
        </Panel>
        <Panel title="Notification outcomes (all time)">
          <Table head={["Channel", "Status", "Count"]} empty={!deliveries.length}>
            {deliveries.map((d) => <tr key={d.channel + d.status}><td>{d.channel}</td><td>{d.status}</td><td>{d._count}</td></tr>)}
          </Table>
        </Panel>
      </div>
    </AdminPage>
  );
}
