import { headers } from "next/headers";
import { api, ok } from "@/lib/api";
import { clientIp, requirePermission } from "@/lib/auth/session";
import { deleteMember } from "@/server/services/member-deletion";

/** DELETE ?confirm=<referenceNo> — hard delete if unpaid, otherwise anonymise (payments kept). */
export const DELETE = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requirePermission("members.delete");
  const confirm = new URL(req.url).searchParams.get("confirm") ?? "";
  return ok(await deleteMember((await params).id, confirm, user.id, clientIp(await headers())));
});
