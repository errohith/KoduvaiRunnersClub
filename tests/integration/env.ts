import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

/** Shared by global setup and per-file setup: point everything at the isolated test schema. */
export function testEnv(): Record<string, string> {
  const fileEnv = existsSync(".env") ? parse(readFileSync(".env")) : {};
  const url = process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL must be set (use a dedicated schema, e.g. ?schema=koduvai_test).");
  // Guard against wiping real data: the test database must differ from the app database in .env.
  const appUrl = fileEnv.DATABASE_URL;
  if (appUrl && url === appUrl) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL — tests wipe their database.");
  return {
    TEST_DATABASE_URL: url,
    DATABASE_URL: url,
    DIRECT_DATABASE_URL: url,
    APP_ENV: "test",
    APP_URL: "http://localhost:3000",
    AUTH_SECRET: "integration-secret-integration-secret-012345",
    ADMIN_BOOTSTRAP_ENABLED: "false",
    EMAIL_ENABLED: "true",
    EMAIL_PROVIDER: "log",
    WHATSAPP_ENABLED: "true",
    WHATSAPP_PROVIDER: "log",
    PAYMENT_ENABLED: "false",
    PAYMENT_PROVIDER: "none",
    NOTIFICATION_RETRY_LIMIT: "3",
    NOTIFICATIONS_INLINE: "false",
    CLUB_ADMIN_EMAIL: "admin@club.test",
    CLUB_ADMIN_WHATSAPP: "",
    LOG_LEVEL: "error",
  };
}
