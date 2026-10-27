import { api, ok, parseJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { categoryCreateSchema } from "@/validation/schemas";
import { upsertCategory } from "@/server/services/events";

export const POST = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requirePermission("events.manage");
  const b = await parseJson(req, categoryCreateSchema);
  const cat = await upsertCategory((await params).id, { ...b, distanceKm: b.distanceKm?.toString() ?? null, isActive: true }, user.id);
  return ok(cat, { status: 201 });
});
