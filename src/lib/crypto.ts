import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "@/config/env";

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function hmacHex(secret: string, payload: string | Buffer) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Compact signed token "<base64url(json)>.<sig>" for unsubscribe links etc. */
export function signToken(data: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${body}.${createHmac("sha256", config.AUTH_SECRET).update(body).digest("base64url")}`;
}

export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", config.AUTH_SECRET).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as T;
  } catch {
    return null;
  }
}
