import { prisma } from "./db";
import { tooManyRequests } from "./errors";

/**
 * Fixed-window rate limiter stored in Postgres so it works across multiple app instances.
 * One atomic UPSERT per call.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "rate_limit_buckets" ("key", "count", "window_start") VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rate_limit_buckets"."window_start" < now() - make_interval(secs => ${windowSeconds}::int)
                     THEN 1 ELSE "rate_limit_buckets"."count" + 1 END,
      "window_start" = CASE WHEN "rate_limit_buckets"."window_start" < now() - make_interval(secs => ${windowSeconds}::int)
                     THEN now() ELSE "rate_limit_buckets"."window_start" END
    RETURNING "count"`;
  if (Number(rows[0].count) > limit) throw tooManyRequests();
}
