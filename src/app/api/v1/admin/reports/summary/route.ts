import { prisma } from "@/lib/db";
import { api, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";

export const GET = api(async () => {
  await requirePermission("reports.view");
  const [applications, members, payments, deliveries] = await Promise.all([
    prisma.membershipApplication.groupBy({ by: ["status"], _count: true }),
    prisma.membership.groupBy({ by: ["planId", "status"], _count: true }),
    prisma.payment.groupBy({ by: ["purpose", "status", "currency"], _count: true, _sum: { amountMinor: true, refundedMinor: true } }),
    prisma.notificationDelivery.groupBy({ by: ["channel", "status"], _count: true }),
  ]);
  return ok({ applications, members, payments, deliveries });
});
