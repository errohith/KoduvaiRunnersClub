"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { authenticate } from "@/lib/auth/login";
import { clientIp, createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }).safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };
  try {
    await authenticate(parsed.data.email, parsed.data.password, clientIp(await headers()));
  } catch (e) {
    if (e instanceof AppError) return { error: e.status === 429 ? "Too many sign-in attempts. Please wait 15 minutes." : e.message };
    throw e;
  }
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}

export async function changePasswordAction(_prev: { error?: string; ok?: boolean } | undefined, formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const db = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(current, db.passwordHash))) return { error: "Current password is incorrect." };
  const problem = passwordProblems(next);
  if (problem) return { error: problem };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  // Sign out other sessions.
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await createSession(user.id);
  await audit({ actorId: user.id, action: "auth.password_changed", entityType: "user", entityId: user.id });
  return { ok: true };
}
