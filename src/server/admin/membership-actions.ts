"use server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { parseMajorToMinor } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { badRequest, conflict, isUniqueViolation } from "@/lib/errors";
import { cancelApplication, decideApplication, renewMembership, setMembershipStatus } from "@/server/services/membership";
import { deleteMember } from "@/server/services/member-deletion";
import { bool, lines, optInt, optStr, runAdminAction, str } from "./run";

export async function decideAction(fd: FormData) {
  const id = str(fd, "id");
  return runAdminAction("members.manage", `/admin/applications/${id}`, async ({ user, ip }) => {
    const decision = str(fd, "decision") as "approve" | "reject";
    if (!["approve", "reject"].includes(decision)) throw badRequest("Invalid decision");
    await decideApplication(id, decision, optStr(fd, "note") ?? undefined, user.id, ip);
    return decision === "approve" ? "Application approved." : "Application rejected.";
  });
}

export async function cancelApplicationAction(fd: FormData) {
  const id = str(fd, "id");
  return runAdminAction("members.manage", `/admin/applications/${id}`, async ({ user, ip }) => {
    const note = str(fd, "note");
    if (!note) throw badRequest("Give a reason for cancelling.");
    await cancelApplication(id, note, user.id, ip);
    return "Application cancelled.";
  });
}

export async function membershipStatusAction(fd: FormData) {
  return runAdminAction("members.manage", str(fd, "back") || "/admin/members", async ({ user, ip }) => {
    const status = str(fd, "status") as "ACTIVE" | "SUSPENDED" | "CANCELLED";
    if (!["ACTIVE", "SUSPENDED", "CANCELLED"].includes(status)) throw badRequest("Invalid status");
    await setMembershipStatus(str(fd, "id"), status, user.id, ip);
    return `Membership ${status.toLowerCase()}.`;
  });
}

export async function renewAction(fd: FormData) {
  return runAdminAction("members.manage", str(fd, "back") || "/admin/members", async ({ user, ip }) => {
    await renewMembership(str(fd, "id"), optInt(fd, "months") ?? 12, user.id, ip);
    return "Membership renewed.";
  });
}

function planData(fd: FormData) {
  const currency = (str(fd, "currency") || "INR").toUpperCase();
  const approval = str(fd, "requiresApproval");
  const name = str(fd, "name");
  if (name.length < 2) throw badRequest("Plan name is required.");
  const description = str(fd, "description");
  if (!description) throw badRequest("Description is required.");
  const duration = optInt(fd, "durationMonths");
  if (duration !== null && (duration < 1 || duration > 120)) throw badRequest("Duration must be 1–120 months, or blank for no expiry.");
  return {
    name,
    description,
    feeMinor: parseMajorToMinor(str(fd, "fee") || "0", currency),
    currency,
    benefits: lines(fd, "benefits"),
    eligibility: optStr(fd, "eligibility"),
    requiresStudentVerification: bool(fd, "requiresStudentVerification"),
    requiresApproval: approval === "yes" ? true : approval === "no" ? false : null,
    durationMonths: duration,
    isActive: bool(fd, "isActive"),
    sortOrder: optInt(fd, "sortOrder") ?? 0,
  };
}

export async function savePlanAction(fd: FormData) {
  return runAdminAction("plans.manage", "/admin/plans", async ({ user, ip }) => {
    const id = str(fd, "id");
    const data = planData(fd);
    try {
      if (id) {
        const before = await prisma.membershipPlan.findUniqueOrThrow({ where: { id } });
        await prisma.membershipPlan.update({ where: { id }, data });
        await audit({ actorId: user.id, action: "plan.updated", entityType: "membership_plan", entityId: id, metadata: { feeBefore: before.feeMinor, feeAfter: data.feeMinor, isActive: data.isActive }, ip });
        return `Saved ${data.name}. New applications use the updated fee; existing applications keep the fee quoted at submission.`;
      }
      const code = (str(fd, "code") || slugify(data.name)).toUpperCase().replace(/-/g, "_");
      const created = await prisma.membershipPlan.create({ data: { ...data, code } });
      await audit({ actorId: user.id, action: "plan.created", entityType: "membership_plan", entityId: created.id, metadata: { code, feeMinor: data.feeMinor }, ip });
      return `Created ${data.name}.`;
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict("duplicate_code", "A plan with this code already exists.");
      throw e;
    }
  });
}

export async function movePlanAction(fd: FormData) {
  return runAdminAction("plans.manage", "/admin/plans", async ({ user }) => {
    const plans = await prisma.membershipPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    const i = plans.findIndex((p) => p.id === str(fd, "id"));
    const j = str(fd, "dir") === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= plans.length) return "Order unchanged.";
    [plans[i], plans[j]] = [plans[j], plans[i]];
    await prisma.$transaction(plans.map((p, idx) => prisma.membershipPlan.update({ where: { id: p.id }, data: { sortOrder: idx } })));
    await audit({ actorId: user.id, action: "plan.reordered", entityType: "membership_plan" });
    return "Plan order updated.";
  });
}

export async function deleteMemberAction(fd: FormData) {
  const id = str(fd, "id");
  return runAdminAction("members.delete", `/admin/applications/${id}`, async ({ user, ip }) => {
    const r = await deleteMember(id, str(fd, "confirm"), user.id, ip);
    return {
      message:
        r.mode === "delete"
          ? `${r.referenceNo} was permanently deleted.`
          : `${r.referenceNo} was anonymised: personal details removed, ${r.paymentsKept} payment record(s) kept for accounting.`,
      redirectTo: "/admin/applications",
    };
  });
}
