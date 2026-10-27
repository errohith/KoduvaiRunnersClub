import { headers } from "next/headers";
import { z } from "zod";
import { api, ok, parseJson } from "@/lib/api";
import { authenticate } from "@/lib/auth/login";
import { clientIp } from "@/lib/auth/session";

/** Sign in for API clients (e.g. Postman). Sets the httpOnly `kr_session` cookie used by /admin/* endpoints. */
export const POST = api(async (req) => {
  const { email, password } = await parseJson(req, z.object({ email: z.string().email(), password: z.string().min(1).max(200) }));
  const user = await authenticate(email, password, clientIp(await headers()));
  return ok({ id: user.id, email: user.email, name: user.name });
});
