import { prisma } from "@/lib/db";
import { api, ok, parseJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { campaignSchema } from "@/validation/schemas";
import { createCampaign, scheduleCampaign } from "@/server/services/campaigns";

export const GET = api(async () => {
  await requirePermission("comms.view");
  return ok(await prisma.notificationCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 100 }));
});

/** Creates a draft. Pass `scheduledAt` to schedule immediately; use /send to send now. */
export const POST = api(async (req) => {
  const user = await requirePermission("comms.send");
  const input = await parseJson(req, campaignSchema);
  const c = await createCampaign(input, user.id);
  if (input.scheduledAt) await scheduleCampaign(c.id, input.scheduledAt, user.id);
  return ok(await prisma.notificationCampaign.findUniqueOrThrow({ where: { id: c.id } }), { status: 201 });
});
