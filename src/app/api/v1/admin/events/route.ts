import { prisma } from "@/lib/db";
import { api, ok, parseJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/slug";
import { conflict, isUniqueViolation } from "@/lib/errors";
import { eventCreateSchema } from "@/validation/schemas";

export const GET = api(async () => {
  await requirePermission("events.view");
  return ok(await prisma.event.findMany({ orderBy: { startsAt: "desc" }, include: { categories: true }, take: 200 }));
});

/** Creates the event as a DRAFT. Add categories, then publish via /admin/events/{id}/status. */
export const POST = api(async (req) => {
  const user = await requirePermission("events.manage");
  const body = await parseJson(req, eventCreateSchema);
  try {
    const event = await prisma.event.create({ data: { ...body, slug: body.slug ?? slugify(body.title), status: "DRAFT" } });
    await audit({ actorId: user.id, action: "event.created", entityType: "event", entityId: event.id, metadata: { via: "api" } });
    return ok(event, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("duplicate_slug", "Another event already uses this slug.");
    throw e;
  }
});
