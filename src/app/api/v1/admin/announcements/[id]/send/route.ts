import { api, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { scheduleCampaign } from "@/server/services/campaigns";

/** Queues the campaign for immediate dispatch by the background worker. */
export const POST = api<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const user = await requirePermission("comms.send");
  await scheduleCampaign((await params).id, null, user.id);
  return ok({ status: "SCHEDULED" }, { status: 202 });
});
