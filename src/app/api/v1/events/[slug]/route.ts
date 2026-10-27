import { prisma } from "@/lib/db";
import { api, ok } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { registrationWindow, spotsLeft } from "@/server/services/events";

export const GET = api<{ params: Promise<{ slug: string }> }>(async (_req, { params }) => {
  const e = await prisma.event.findFirst({
    where: { slug: (await params).slug, status: { in: ["PUBLISHED", "COMPLETED", "CANCELLED"] } },
    include: { categories: { where: { isActive: true }, orderBy: { sortOrder: "asc" } }, customFields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!e) throw notFound("Event");
  const { registeredCount, ...rest } = e;
  return ok({
    ...rest,
    registration: registrationWindow(e),
    spotsLeft: spotsLeft(e.capacity, registeredCount),
    categories: e.categories.map(({ registeredCount: rc, ...c }) => ({ ...c, distanceKm: c.distanceKm ? Number(c.distanceKm) : null, spotsLeft: spotsLeft(c.capacity, rc) })),
  });
});
