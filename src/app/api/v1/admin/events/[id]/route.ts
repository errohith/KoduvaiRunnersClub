import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { api, ok } from "@/lib/api";
import { clientIp, requirePermission } from "@/lib/auth/session";
import { notFound } from "@/lib/errors";
import { deleteEvent } from "@/server/services/event-deletion";

export const GET = api<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  await requirePermission("events.view");
  const event = await prisma.event.findUnique({ where: { id: (await params).id }, include: { categories: { orderBy: { sortOrder: "asc" } }, customFields: { orderBy: { sortOrder: "asc" } } } });
  if (!event) throw notFound("Event");
  return ok(event);
});

/** DELETE ?confirm=<slug> — refused (409) when any registration has a received payment. */
export const DELETE = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requirePermission("events.delete");
  const confirm = new URL(req.url).searchParams.get("confirm") ?? "";
  return ok(await deleteEvent((await params).id, confirm, user.id, clientIp(await headers())));
});
