import { prisma } from "@/lib/db";
import { api, ok, parseJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import { planSchema } from "@/validation/schemas";

export const PUT = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requirePermission("plans.manage");
  const { id } = await params;
  const before = await prisma.membershipPlan.findUnique({ where: { id } });
  if (!before) throw notFound("Plan");
  const body = await parseJson(req, planSchema.partial());
  const plan = await prisma.membershipPlan.update({ where: { id }, data: body });
  await audit({ actorId: user.id, action: "plan.updated", entityType: "membership_plan", entityId: id, metadata: { via: "api", feeBefore: before.feeMinor, feeAfter: plan.feeMinor } });
  return ok(plan);
});
