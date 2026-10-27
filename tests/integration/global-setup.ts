import { execSync } from "node:child_process";
import { testEnv } from "./env";

/**
 * Apply all migrations to the isolated test schema (non-destructive `migrate deploy`; creates the
 * schema on first run) and seed reference data. Each test file then clears transactional tables
 * via resetData(), which only ever targets TEST_DATABASE_URL.
 */
export default function setup() {
  const env = { ...process.env, ...testEnv() };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "pipe" });
}
