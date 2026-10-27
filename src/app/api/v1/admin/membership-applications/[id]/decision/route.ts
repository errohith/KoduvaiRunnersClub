import { headers } from "next/headers";
import { api, ok, parseJson } from "@/lib/api";
import { clientIp, requirePermission } from "@/lib/auth/session";
import { decisionSchema } from "@/validation/schemas";
import { decideApplication } from "@/server/services/membership";
import { prisma } from "@/lib/db";

export const POST = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requirePermission("members.manage");
  const { id } = await params;
  const { decision, note } = await parseJson(req, decisionSchema);
  await decideApplication(id, decision, note, user.id, clientIp(await headers()));
  const app = await prisma.membershipApplication.findUniqueOrThrow({ where: { id }, select: { referenceNo: true, status: true } });
  return ok(app);
});
