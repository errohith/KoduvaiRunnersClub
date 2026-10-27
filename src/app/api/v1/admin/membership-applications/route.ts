import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { api, paged, pagination } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";

export const GET = api(async (req) => {
  await requirePermission("members.view");
  const u = new URL(req.url);
  const { page, pageSize, skip, take } = pagination(u);
  const status = u.searchParams.get("status") as ApplicationStatus | null;
  const where = { ...(status ? { status } : {}), ...(u.searchParams.get("planId") ? { planId: u.searchParams.get("planId")! } : {}) };
  const [rows, total] = await Promise.all([
    prisma.membershipApplication.findMany({ where, include: { plan: { select: { code: true, name: true } } }, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.membershipApplication.count({ where }),
  ]);
  return paged(rows.map(({ submittedIp, ...r }) => r), total, page, pageSize);
});
