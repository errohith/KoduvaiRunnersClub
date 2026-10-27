import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission, can } from "@/lib/auth/session";
import { formatDate, formatDateTime } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { AdminPage, Panel, Table } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { StatusBadge } from "@/components/ui";
import { cancelApplicationAction, decideAction, deleteMemberAction } from "@/server/admin/membership-actions";
import { previewMemberDeletion } from "@/server/services/member-deletion";
import { offlinePaymentAction } from "@/server/admin/payment-actions";

export default async function ApplicationDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requirePagePermission("members.view");
  const { id } = await params;
  const app = await prisma.membershipApplication.findUnique({
    where: { id },
    include: { plan: true, membership: true, reviewedBy: true, history: { orderBy: { createdAt: "asc" }, include: { changedBy: true } }, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!app) notFound();
  const [deliveries, consents] = await Promise.all([
    prisma.notificationDelivery.findMany({ where: { relatedType: "membership_application", relatedId: app.id }, orderBy: { createdAt: "asc" } }),
    prisma.consentRecord.findMany({ where: { OR: [{ email: app.email }, { phoneE164: app.phoneE164 }] }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  const manage = can(user, "members.manage");
  const deletion = can(user, "members.delete") ? await previewMemberDeletion(app.id) : null;
  const openPayment = app.payments.find((p) => ["PENDING", "INITIATED"].includes(p.status));

  const row = (k: string, v: React.ReactNode) => (<div className="grid grid-cols-3 gap-2 py-1.5 text-sm"><dt className="text-slate-500">{k}</dt><dd className="col-span-2 text-slate-900">{v || <span className="text-slate-400">—</span>}</dd></div>);

  return (
    <AdminPage title={app.fullName} description={<><span className="font-mono">{app.referenceNo}</span> · submitted {formatDateTime(app.createdAt)}</>} flash={await searchParams} actions={<Link href="/admin/applications" className="btn-outline btn-sm">← All applications</Link>}>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Applicant">
            <dl className="divide-y divide-slate-100">
              {row("Status", <StatusBadge status={app.status} />)}
              {row("Plan", `${app.plan.name} — ${formatMoney(app.feeMinor, app.currency)} (quoted at submission)`)}
              {row("Email", app.email)}
              {row("Mobile", app.phoneE164)}
              {row("Date of birth", app.dateOfBirth ? formatDate(app.dateOfBirth) : null)}
              {row("City", app.city)}
              {row("Address", app.address)}
              {row("Experience", app.experienceLevel)}
              {row("Interests", app.interests.join(", "))}
              {row("Emergency contact", app.emergencyName ? `${app.emergencyName} · ${app.emergencyPhone}` : null)}
              {app.plan.requiresStudentVerification && row("Student", `${app.studentInstitution ?? "—"} · ID ${app.studentIdNumber ?? "—"}`)}
              {row("Referral", app.referralSource)}
              {row("Membership", app.membership ? `${app.membership.membershipNo} (${app.membership.status.toLowerCase()})` : null)}
              {row("Reviewed", app.reviewedAt ? `${formatDateTime(app.reviewedAt)} by ${app.reviewedBy?.name ?? "system"}${app.decisionNote ? ` — “${app.decisionNote}”` : ""}` : null)}
            </dl>
          </Panel>

          <Panel title="Status history">
            <ol className="space-y-2 text-sm">
              {app.history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2">
                  <span className="w-40 text-slate-500">{formatDateTime(h.createdAt)}</span>
                  {h.fromStatus && <><StatusBadge status={h.fromStatus} />→</>}
                  <StatusBadge status={h.toStatus} />
                  <span className="text-slate-600">{h.changedBy?.name ?? "System"}{h.note ? ` — ${h.note}` : ""}</span>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Notifications">
            <Table head={["Template", "Channel", "Status", "Detail"]} empty={!deliveries.length}>
              {deliveries.map((d) => (
                <tr key={d.id}><td className="font-mono text-xs">{d.templateKey}</td><td>{d.channel}</td><td><StatusBadge status={d.status} /></td><td className="text-xs text-slate-500">{d.lastError ?? d.providerMessageId}</td></tr>
              ))}
            </Table>
          </Panel>
        </div>

        <div className="space-y-6">
          {manage && app.status === "PENDING" && (
            <Panel title="Decision">
              <form action={decideAction} className="space-y-3">
                <input type="hidden" name="id" value={app.id} />
                <label htmlFor="note" className="label">Note to applicant</label>
                <textarea id="note" name="note" rows={3} className="input" placeholder="Required when rejecting; optional when approving." />
                <div className="flex gap-2">
                  <SubmitButton name="decision" value="approve" className="btn-primary btn-sm">Approve</SubmitButton>
                  <SubmitButton name="decision" value="reject" className="btn-danger btn-sm" confirm="Reject this application? The applicant will be notified.">Reject</SubmitButton>
                </div>
                <p className="help">{app.feeMinor > 0 ? "Approving creates a payment request. The membership activates once payment is confirmed." : "Free plan — approving activates the membership immediately."}</p>
              </form>
            </Panel>
          )}
          <Panel title="Payments">
            {app.feeMinor === 0 ? (
              <p className="text-sm text-slate-500">Free plan — no payment required.</p>
            ) : app.payments.length === 0 ? (
              <p className="text-sm text-slate-500">A payment request is created when the application is approved.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {app.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span><span className="font-mono text-xs">{p.reference}</span><br /><span className="text-slate-500">{formatMoney(p.amountMinor, p.currency)} · {p.provider ?? "no provider"}</span></span>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
            {openPayment && can(user, "payments.manage") && (
              <form action={offlinePaymentAction} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                <input type="hidden" name="reference" value={openPayment.reference} />
                <input type="hidden" name="back" value={`/admin/applications/${app.id}`} />
                <label htmlFor="pnote" className="label">Record offline payment</label>
                <input id="pnote" name="note" required className="input" placeholder="e.g. UPI txn 4123… / cash receipt #12" />
                <SubmitButton className="btn-outline btn-sm" confirm="Confirm you have verified this payment was received?">Mark as paid</SubmitButton>
              </form>
            )}
          </Panel>
          <Panel title="Communication consent">
            <ul className="space-y-1 text-xs text-slate-600">
              {consents.map((c) => <li key={c.id}>{formatDateTime(c.createdAt)} — {c.channel} {c.granted ? "granted" : "withdrawn"} ({c.source})</li>)}
            </ul>
          </Panel>
          {manage && ["PENDING", "APPROVED", "ACTIVE"].includes(app.status) && (
            <Panel title="Cancel">
              <form action={cancelApplicationAction} className="space-y-2">
                <input type="hidden" name="id" value={app.id} />
                <input name="note" required className="input" placeholder="Reason" aria-label="Reason for cancelling" />
                <SubmitButton className="btn-outline btn-sm" confirm="Cancel this application/membership?">Cancel application</SubmitButton>
              </form>
            </Panel>
          )}
          {deletion && (
            <section id="delete" className="rounded-xl border border-red-200 bg-red-50/50">
              <h2 className="border-b border-red-200 px-4 py-3 font-sans text-sm font-semibold normal-case tracking-normal text-red-800">Delete member</h2>
              <div className="space-y-3 p-4 text-sm text-slate-700">
                {deletion.mode === "delete" ? (
                  <p>No payment has been received, so this <strong>permanently deletes</strong> the application, membership, status history and message log. This cannot be undone.</p>
                ) : (
                  <p>A payment has been received, so the record will be <strong>anonymised</strong>: name, contact and personal details are erased and the membership cancelled. {deletion.paymentsKept} payment record(s) are kept for accounting. This cannot be undone.</p>
                )}
                <form action={deleteMemberAction} className="space-y-2">
                  <input type="hidden" name="id" value={app.id} />
                  <label htmlFor="confirm" className="label">Type <span className="font-mono">{app.referenceNo}</span> to confirm</label>
                  <input id="confirm" name="confirm" required autoComplete="off" className="input font-mono" />
                  <SubmitButton className="btn-danger btn-sm" confirm={deletion.mode === "delete" ? "Permanently delete this member? This cannot be undone." : "Anonymise this member? This cannot be undone."}>
                    {deletion.mode === "delete" ? "Delete permanently" : "Anonymise member"}
                  </SubmitButton>
                </form>
              </div>
            </section>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
