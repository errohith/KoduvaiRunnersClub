import type { MembershipPlan } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { formatMoney, minorToMajorString } from "@/lib/money";
import { getSettings } from "@/server/services/settings";
import { AdminPage, Check, Input, Panel, Select, Textarea } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { Badge } from "@/components/ui";
import { movePlanAction, savePlanAction } from "@/server/admin/membership-actions";

function PlanForm({ plan, defaultCurrency }: { plan?: MembershipPlan; defaultCurrency: string }) {
  const p = plan;
  return (
    <form action={savePlanAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {p && <input type="hidden" name="id" value={p.id} />}
      <Input name="name" label="Name" defaultValue={p?.name} required />
      {!p && <Input name="code" label="Code" placeholder="e.g. FAMILY" help="Unique, cannot change later" />}
      <Input name="fee" label="Fee (major units)" defaultValue={p ? minorToMajorString(p.feeMinor, p.currency) : "0"} required help="0 for a free membership" />
      <Input name="currency" label="Currency" defaultValue={p?.currency ?? defaultCurrency} />
      <Input name="durationMonths" label="Duration (months)" type="number" defaultValue={p?.durationMonths} help="Blank = no expiry" />
      <Select name="requiresApproval" label="Approval" defaultValue={p?.requiresApproval === true ? "yes" : p?.requiresApproval === false ? "no" : ""} options={[["", "Club default"], ["yes", "Always require approval"], ["no", "Auto-approve"]]} />
      <Input name="sortOrder" label="Sort order" type="number" defaultValue={p?.sortOrder ?? 0} />
      <Textarea name="description" label="Description" defaultValue={p?.description} rows={2} className="sm:col-span-2" required />
      <Textarea name="benefits" label="Benefits (one per line)" defaultValue={p?.benefits.join("\n")} rows={3} className="sm:col-span-2" />
      <Textarea name="eligibility" label="Eligibility" defaultValue={p?.eligibility} rows={2} className="sm:col-span-2" />
      <div className="flex flex-col justify-end gap-2 sm:col-span-2">
        <Check name="requiresStudentVerification" label="Requires student verification" defaultChecked={p?.requiresStudentVerification} />
        <Check name="isActive" label="Open for new applications" defaultChecked={p?.isActive ?? true} />
      </div>
      <div className="sm:col-span-2 lg:col-span-4"><SubmitButton className="btn-primary btn-sm">{p ? "Save changes" : "Create plan"}</SubmitButton></div>
    </form>
  );
}

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePagePermission("plans.manage");
  const [plans, settings] = await Promise.all([prisma.membershipPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { memberships: { where: { status: "ACTIVE" } } } } } }), getSettings()]);
  return (
    <AdminPage title="Membership plans & fees" description={`Fees apply to new applications. Club-wide approval default: ${settings.membership.requireApproval ? "approval required" : "auto-approve"} (change in Settings).`} flash={await searchParams}>
      {plans.map((p, i) => (
        <Panel
          key={p.id}
          title={`${p.name} · ${formatMoney(p.feeMinor, p.currency)}`}
          actions={
            <div className="flex items-center gap-2">
              <Badge tone={p.isActive ? "green" : "gray"}>{p.isActive ? "Open" : "Disabled"}</Badge>
              <Badge tone={p.feeMinor === 0 ? "green" : "brand"}>{p.feeMinor === 0 ? "Free" : "Paid"}</Badge>
              <span className="text-xs text-slate-500">{p._count.memberships} active</span>
              <form action={movePlanAction} className="flex gap-1">
                <input type="hidden" name="id" value={p.id} />
                <SubmitButton name="dir" value="up" disabled={i === 0} className="btn-ghost btn-sm" ariaLabel={`Move ${p.name} up`}>↑</SubmitButton>
                <SubmitButton name="dir" value="down" disabled={i === plans.length - 1} className="btn-ghost btn-sm" ariaLabel={`Move ${p.name} down`}>↓</SubmitButton>
              </form>
            </div>
          }
        >
          <details>
            <summary className="cursor-pointer text-sm font-medium text-brand">Edit plan</summary>
            <div className="mt-4"><PlanForm plan={p} defaultCurrency={settings.membership.currency} /></div>
          </details>
        </Panel>
      ))}
      <Panel title="Add a plan"><PlanForm defaultCurrency={settings.membership.currency} /></Panel>
    </AdminPage>
  );
}
