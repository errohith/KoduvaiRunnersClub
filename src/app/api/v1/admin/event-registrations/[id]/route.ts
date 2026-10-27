import { headers } from "next/headers";
import { api, ok } from "@/lib/api";
import { clientIp, requirePermission } from "@/lib/auth/session";
import { deleteEventRegistration } from "@/server/services/event-deletion";

/** DELETE ?confirm=<registrationNo> — hard delete if unpaid (place released), otherwise anonymise. */
export const DELETE = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requirePermission("events.delete");
  const confirm = new URL(req.url).searchParams.get("confirm") ?? "";
  return ok(await deleteEventRegistration((await params).id, confirm, user.id, clientIp(await headers())));
});
