import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { config } from "@/config/env";
import { randomToken, sha256 } from "@/lib/crypto";
import { forbidden, unauthorized } from "@/lib/errors";
import type { Permission } from "./permissions";

export const SESSION_COOKIE = "kr_session";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: Set<Permission>;
};

export async function createSession(userId: string) {
  const token = randomToken();
  const h = await headers();
  const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 3600_000);
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt,
      ip: clientIp(h),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function loadUserByToken(token: string | undefined): Promise<CurrentUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  const perms = new Set<Permission>();
  for (const ur of session.user.roles) for (const rp of ur.role.permissions) perms.add(rp.permission.key as Permission);
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    roles: session.user.roles.map((r) => r.role.key),
    permissions: perms,
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return loadUserByToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export function can(user: CurrentUser | null, perm: Permission) {
  return !!user && user.permissions.has(perm);
}

/** For API route handlers and server actions: throws 401/403. */
export async function requirePermission(perm: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  if (!user.permissions.has(perm)) throw forbidden();
  return user;
}

/** For admin pages: redirects instead of throwing. */
export async function requirePagePermission(perm: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (!user.permissions.has(perm)) redirect("/admin?denied=1");
  return user;
}

export function clientIp(h: Headers): string | null {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}
