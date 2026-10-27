import type { PaymentPurpose, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { api, paged, pagination } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";

export const GET = api(async (req) => {
  await requirePermission("payments.view");
  const u = new URL(req.url);
  const { page, pageSize, skip, take } = pagination(u);
  const where = {
    ...(u.searchParams.get("status") ? { status: u.searchParams.get("status") as PaymentStatus } : {}),
    ...(u.searchParams.get("purpose") ? { purpose: u.searchParams.get("purpose") as PaymentPurpose } : {}),
  };
  const [rows, total] = await Promise.all([prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }), prisma.payment.count({ where })]);
  return paged(rows, total, page, pageSize);
});
