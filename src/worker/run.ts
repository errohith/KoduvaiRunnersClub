/**
 * Background worker: run with `npm run worker` (Docker: the `worker` service).
 * Sends queued notifications, dispatches scheduled announcements, sends event reminders,
 * expires memberships and cleans up sessions. Safe to run multiple replicas.
 */
import "dotenv/config";
import { getConfig } from "@/config/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { tick } from "@/server/jobs";

process.env.NOTIFICATIONS_INLINE = "false";
const cfg = getConfig(); // fail fast on bad configuration
let stopping = false;

async function main() {
  logger.info("worker.started", { pollMs: cfg.WORKER_POLL_INTERVAL_MS, email: cfg.EMAIL_ENABLED ? cfg.EMAIL_PROVIDER : "disabled", whatsapp: cfg.WHATSAPP_ENABLED ? cfg.WHATSAPP_PROVIDER : "disabled" });
  while (!stopping) {
    try {
      const r = await tick();
      if (r.sent || r.campaigns || r.reminders) logger.info("worker.tick", r);
    } catch (e) {
      logger.error("worker.tick_failed", { err: (e as Error).message });
    }
    await new Promise((res) => setTimeout(res, cfg.WORKER_POLL_INTERVAL_MS));
  }
  await prisma.$disconnect();
  logger.info("worker.stopped");
}

for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => (stopping = true));
main().catch((e) => {
  logger.error("worker.crashed", { err: (e as Error).message });
  process.exit(1);
});
