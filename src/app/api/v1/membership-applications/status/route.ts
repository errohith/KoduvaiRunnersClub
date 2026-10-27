import { headers } from "next/headers";
import { z } from "zod";
import { api, ok, parseJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth/session";
import { notFound } from "@/lib/errors";
import { getApplicationStatus } from "@/server/services/membership";

// POST (not GET) so the email address never appears in URLs or access logs.
export const POST = api(async (req) => {
  await rateLimit(`status:${clientIp(await headers()) ?? "unknown"}`, 20, 600);
  const { referenceNo, email } = await parseJson(req, z.object({ referenceNo: z.string().trim().min(5).max(40), email: z.string().email() }));
  const app = await getApplicationStatus(referenceNo.toUpperCase(), email);
  if (!app) throw notFound("Application");
  return ok({ referenceNo: app.referenceNo, status: app.status, plan: app.plan.name, membershipNo: app.membership?.membershipNo ?? null, paymentReference: app.payments[0]?.reference ?? null, paymentStatus: app.payments[0]?.status ?? null });
});
