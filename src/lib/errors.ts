/** Domain errors carry an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (msg: string, details?: unknown) => new AppError(400, "bad_request", msg, details);
export const validationError = (details: unknown) => new AppError(422, "validation_failed", "Some fields need attention.", details);
export const unauthorized = () => new AppError(401, "unauthorized", "Please sign in.");
export const forbidden = () => new AppError(403, "forbidden", "You do not have permission to do that.");
export const notFound = (what = "Resource") => new AppError(404, "not_found", `${what} not found.`);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);
export const tooManyRequests = () => new AppError(429, "rate_limited", "Too many attempts. Please wait a minute and try again.");

/**
 * Postgres unique-violation surfaced by Prisma. `hint` matches any of the violated columns
 * (Prisma reports partial unique indexes by column list, not index name) or text in the message.
 */
export function isUniqueViolation(e: unknown, hint?: string | string[]): boolean {
  const err = e as { code?: string; meta?: { target?: unknown }; message?: string };
  const hints = hint === undefined ? [] : Array.isArray(hint) ? hint : [hint];
  const matches = (haystack: string) => !hints.length || hints.some((h) => haystack.includes(h));
  if (err?.code === "P2002") return matches(JSON.stringify(err.meta?.target ?? "") + (err.message ?? ""));
  // Raw queries surface as P2010 with the PG code 23505 inside.
  if (err?.code === "P2010" && (err.message ?? "").includes("23505")) return matches(err.message ?? "");
  return false;
}
