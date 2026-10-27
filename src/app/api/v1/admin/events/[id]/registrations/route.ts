import { prisma } from "@/lib/db";
import { api, paged, pagination } from "@/lib/api";
import { can, requirePermission } from "@/lib/auth/session";

export const GET = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requirePermission("registrations.view");
  const u = new URL(req.url);
  const { page, pageSize, skip, take } = pagination(u);
  const where = { eventId: (await params).id };
  const [rows, total] = await Promise.all([prisma.eventRegistration.findMany({ where, include: { category: { select: { name: true } } }, orderBy: { createdAt: "asc" }, skip, take }), prisma.eventRegistration.count({ where })]);
  const restricted = can(user, "registrations.restricted");
  // Emergency contacts and medical notes are only returned to holders of registrations.restricted.
  const data = rows.map(({ submittedIp, emergencyName, emergencyPhone, medicalNotes, ...r }) => (restricted ? { ...r, emergencyName, emergencyPhone, medicalNotes } : r));
  return paged(data, total, page, pageSize);
});
