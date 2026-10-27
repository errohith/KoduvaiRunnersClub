import { z } from "zod";
import { api, ok, parseJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { setEventStatus } from "@/server/services/events";

export const POST = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requirePermission("events.manage");
  const body = await parseJson(req, z.object({ status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"]), reason: z.string().max(500).optional() }));
  await setEventStatus((await params).id, body.status, user.id, body.reason);
  return ok({ status: body.status });
});
