import { badRequest } from "./errors";

/** Only http(s) links may be stored — blocks javascript: and data: URLs in admin-edited links. */
export function safeUrl(v: string | null | undefined): string | null {
  if (!v) return null;
  if (v.startsWith("/") && !v.startsWith("//")) return v; // site-relative link
  try {
    const u = new URL(v);
    if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
  } catch {}
  throw badRequest(`"${v}" is not a valid link. Use https://… or a path starting with /.`);
}
