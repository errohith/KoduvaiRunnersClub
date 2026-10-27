import { headers } from "next/headers";
import { api, ok, parseJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth/session";
import { eventRegistrationSchema } from "@/validation/schemas";
import { registerForEvent } from "@/server/services/events";

export const POST = api(async (req) => {
  const ip = clientIp(await headers());
  await rateLimit(`register:${ip ?? "unknown"}`, 10, 3600);
  const input = await parseJson(req, eventRegistrationSchema);
  return ok(await registerForEvent(input, ip), { status: 201 });
});
