import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, ok, parseJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { conflict, isUniqueViolation } from "@/lib/errors";
import { planSchema } from "@/validation/schemas";

export const GET = api(async () => {
  await requirePermission("plans.manage");
  return ok(await prisma.membershipPlan.findMany({ orderBy: { sortOrder: "asc" } }));
});

export const POST = api(async (req) => {
  const user = await requirePermission("plans.manage");
  const body = await parseJson(req, planSchema.extend({ code: z.string().trim().regex(/^[A-Z0-9_]{2,30}$/) }));
  try {
    const plan = await prisma.membershipPlan.create({ data: body });
    await audit({ actorId: user.id, action: "plan.created", entityType: "membership_plan", entityId: plan.id, metadata: { via: "api" } });
    return ok(plan, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("duplicate_code", "A plan with this code already exists.");
    throw e;
  }
});
