import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { flattenZod } from "@/lib/api";
import { logger } from "@/lib/logger";
import { clientIp, getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";

function withParam(path: string, key: string, value: string) {
  const u = new URL(path, "http://x");
  u.searchParams.delete("ok");
  u.searchParams.delete("error");
  u.searchParams.set(key, value);
  return u.pathname + u.search;
}

/**
 * Runs an admin server action: enforces the permission on the server, converts domain errors into
 * a flash message, revalidates, and redirects. `fn` returns the success message (or a redirect target).
 */
export async function runAdminAction(
  perm: Permission,
  back: string,
  fn: (ctx: { user: CurrentUser; ip: string | null }) => Promise<string | { message: string; redirectTo: string }>,
): Promise<never> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (!user.permissions.has(perm)) redirect(withParam(back, "error", "You do not have permission to do that."));
  const ip = clientIp(await headers());
  let target: string;
  try {
    const r = await fn({ user, ip });
    target = typeof r === "string" ? withParam(back, "ok", r) : withParam(r.redirectTo, "ok", r.message);
  } catch (e) {
    let msg = "Something went wrong.";
    if (e instanceof AppError) msg = e.message + (e.details && typeof e.details === "object" ? " " + Object.values(e.details as Record<string, string>).join(" ") : "");
    else if (e instanceof ZodError) msg = Object.entries(flattenZod(e)).map(([k, v]) => `${k}: ${v}`).join("; ");
    else logger.error("admin_action_failed", { err: (e as Error).message, stack: (e as Error).stack });
    target = withParam(back, "error", msg.slice(0, 400));
  }
  revalidatePath("/", "layout");
  redirect(target);
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
export const optInt = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new AppError(422, "validation_failed", `${k} must be a whole number.`);
  return n;
};
export const lines = (fd: FormData, k: string) => str(fd, k).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
