import { prisma } from "@/lib/db";
import { api, ok } from "@/lib/api";

export const GET = api(async () => {
  const plans = await prisma.membershipPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  return ok(
    plans.map((p) => ({
      id: p.id, code: p.code, name: p.name, description: p.description, feeMinor: p.feeMinor, currency: p.currency, isFree: p.feeMinor === 0,
      benefits: p.benefits, eligibility: p.eligibility, requiresStudentVerification: p.requiresStudentVerification, durationMonths: p.durationMonths,
    })),
  );
});
