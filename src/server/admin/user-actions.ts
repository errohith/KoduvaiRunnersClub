"use server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashPassword, passwordProblems } from "@/lib/auth/password";
import { badRequest, conflict, isUniqueViolation } from "@/lib/errors";
import { normalizeEmail } from "@/lib/phone";
import { bool, runAdminAction, str } from "./run";

async function assertNotLastSuperAdmin(userId: string, nextRoles?: string[]) {
  const superRole = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
  const isSuper = await prisma.userRole.findUnique({ where: { userId_roleId: { userId, roleId: superRole.id } } });
  if (!isSuper || (nextRoles && nextRoles.includes(superRole.id))) return;
  const others = await prisma.userRole.count({ where: { roleId: superRole.id, userId: { not: userId }, user: { isActive: true } } });
  if (!others) throw conflict("last_super_admin", "You cannot remove the last active Super Admin.");
}

export async function createUserAction(fd: FormData) {
  return runAdminAction("users.manage", "/admin/users", async ({ user, ip }) => {
    const email = normalizeEmail(str(fd, "email"));
    const name = str(fd, "name");
    const password = str(fd, "password");
    const roles = fd.getAll("roles").map(String);
    if (!email.includes("@") || !name) throw badRequest("Name and a valid email are required.");
    const problem = passwordProblems(password);
    if (problem) throw badRequest(problem);
    if (!roles.length) throw badRequest("Assign at least one role.");
    try {
      const u = await prisma.user.create({ data: { email, name, passwordHash: await hashPassword(password), roles: { create: roles.map((roleId) => ({ roleId })) } } });
      await audit({ actorId: user.id, action: "user.created", entityType: "user", entityId: u.id, metadata: { email, roles }, ip });
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict("duplicate_email", "A user with this email already exists.");
      throw e;
    }
    return `User ${email} created. Share the temporary password securely and ask them to change it.`;
  });
}

export async function updateUserAction(fd: FormData) {
  return runAdminAction("users.manage", "/admin/users", async ({ user, ip }) => {
    const id = str(fd, "id");
    const roles = fd.getAll("roles").map(String);
    const isActive = bool(fd, "isActive");
    if (!roles.length) throw badRequest("Assign at least one role.");
    if (!isActive || roles) await assertNotLastSuperAdmin(id, isActive ? roles : []);
    if (id === user.id && !isActive) throw conflict("self_deactivate", "You cannot deactivate your own account.");
    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: id } }),
      prisma.userRole.createMany({ data: roles.map((roleId) => ({ userId: id, roleId })) }),
      prisma.user.update({ where: { id }, data: { isActive } }),
      ...(isActive ? [] : [prisma.session.deleteMany({ where: { userId: id } })]),
    ]);
    await audit({ actorId: user.id, action: "user.updated", entityType: "user", entityId: id, metadata: { roles, isActive }, ip });
    return "User updated.";
  });
}

export async function resetPasswordAction(fd: FormData) {
  return runAdminAction("users.manage", "/admin/users", async ({ user, ip }) => {
    const id = str(fd, "id");
    const password = str(fd, "password");
    const problem = passwordProblems(password);
    if (problem) throw badRequest(problem);
    await prisma.$transaction([prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } }), prisma.session.deleteMany({ where: { userId: id } })]);
    await audit({ actorId: user.id, action: "user.password_reset", entityType: "user", entityId: id, ip });
    return "Password reset and existing sessions signed out.";
  });
}
