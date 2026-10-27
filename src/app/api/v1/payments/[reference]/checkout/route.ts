import { headers } from "next/headers";
import { api, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth/session";
import { initiateCheckout } from "@/server/services/payments";

/** Returns 503 payments_disabled until PAYMENT_ENABLED=true and a provider is configured. */
export const POST = api<{ params: Promise<{ reference: string }> }>(async (_req, { params }) => {
  await rateLimit(`checkout:${clientIp(await headers()) ?? "unknown"}`, 20, 600);
  return ok(await initiateCheckout((await params).reference));
});
