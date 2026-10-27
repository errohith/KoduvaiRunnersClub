import { headers } from "next/headers";
import { api, ok, parseJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth/session";
import { membershipApplicationSchema } from "@/validation/schemas";
import { submitApplication } from "@/server/services/membership";

export const POST = api(async (req) => {
  const ip = clientIp(await headers());
  await rateLimit(`apply:${ip ?? "unknown"}`, 5, 3600);
  const input = await parseJson(req, membershipApplicationSchema);
  const result = await submitApplication(input, ip);
  return ok(result, { status: 201 });
});
