import { api, ok } from "@/lib/api";
import { destroySession } from "@/lib/auth/session";

export const POST = api(async () => {
  await destroySession();
  return ok({ signedOut: true });
});
