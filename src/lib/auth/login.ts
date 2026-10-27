import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { DUMMY_HASH, verifyPassword } from "./password";
import { createSession } from "./session";

/**
 * Shared by the admin sign-in form and POST /api/v1/auth/login. Rate-limited per IP and per
 * email; the same generic error for unknown email, wrong password and inactive accounts.
 */
export async function authenticate(email: string, password: string, ip: string | null) {
  const normalized = email.trim().toLowerCase();
  await rateLimit(`login:ip:${ip ?? "unknown"}`, 20, 900);
  await rateLimit(`login:email:${normalized}`, 8, 900);
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.isActive) {
    await audit({ action: "auth.login_failed", entityType: "user", entityId: user?.id, metadata: { email: normalized }, ip });
    throw new AppError(401, "invalid_credentials", "Incorrect email or password.");
  }
  await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ actorId: user.id, action: "auth.login", entityType: "user", entityId: user.id, ip });
  return user;
}
