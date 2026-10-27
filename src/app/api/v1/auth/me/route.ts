import { api, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { unauthorized } from "@/lib/errors";

export const GET = api(async () => {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return ok({ id: user.id, email: user.email, name: user.name, roles: user.roles, permissions: [...user.permissions].sort() });
});
