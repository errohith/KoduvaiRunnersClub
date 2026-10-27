import type { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { api, paged, pagination } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";

export const GET = api(async (req) => {
  await requirePermission("members.view");
  const u = new URL(req.url);
  const { page, pageSize, skip, take } = pagination(u);
  const status = u.searchParams.get("status") as MembershipStatus | null;
  const where = { ...(status ? { status } : {}), ...(u.searchParams.get("planId") ? { planId: u.searchParams.get("planId")! } : {}) };
  const [rows, total] = await Promise.all([prisma.membership.findMany({ where, include: { plan: { select: { code: true, name: true } } }, orderBy: { createdAt: "desc" }, skip, take }), prisma.membership.count({ where })]);
  return paged(rows, total, page, pageSize);
});
