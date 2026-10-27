import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { AppError, validationError } from "./errors";
import { config } from "@/config/env";
import { logger } from "./logger";

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: CSRF origin check for unsafe methods, structured JSON errors. */
export function api<C = unknown>(handler: Handler<C>, opts: { skipOriginCheck?: boolean } = {}): Handler<C> {
  return async (req, ctx) => {
    try {
      if (!opts.skipOriginCheck && !["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ZodError) e = validationError(flattenZod(e));
  if (e instanceof AppError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
  }
  logger.error("unhandled_api_error", { err: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined });
  return NextResponse.json({ error: { code: "internal_error", message: "Something went wrong. Please try again." } }, { status: 500 });
}

export function flattenZod(e: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of e.issues) {
    const k = issue.path.join(".") || "_";
    out[k] ??= issue.message;
  }
  return out;
}

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  // Non-browser clients (curl, server-to-server) send no Origin; they also carry no ambient cookies
  // unless deliberately configured, so cookie-authenticated CSRF is the only threat we gate here.
  if (!origin) return;
  const allowed = new Set([new URL(config.APP_URL).origin, ...config.CORS_ALLOWED_ORIGINS]);
  if (!allowed.has(origin)) throw new AppError(403, "bad_origin", "Cross-origin request rejected.");
}

export async function parseJson<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError(400, "invalid_json", "Request body must be valid JSON.");
  }
  return schema.parse(body);
}

export function pagination(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 25));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export const ok = (data: unknown, init?: ResponseInit) => NextResponse.json({ data }, init);
export const paged = (data: unknown[], total: number, page: number, pageSize: number) =>
  NextResponse.json({ data, meta: { total, page, pageSize, pages: Math.ceil(total / pageSize) } });
