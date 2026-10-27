import type { Tx } from "./db";

/**
 * Human-readable, unique reference numbers backed by an atomic counter row:
 *   KR-M-2026-000123   membership application
 *   KR-E-2026-000045   event registration
 *   KR-PAY-2026-000078 payment
 *   KRM-00012          membership number
 * The UPSERT ... RETURNING runs inside the caller's transaction, so numbers are gap-free
 * per committed transaction and never duplicated under concurrency.
 */
export async function nextCounter(tx: Tx, scope: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "reference_counters" ("scope", "value") VALUES (${scope}, 1)
    ON CONFLICT ("scope") DO UPDATE SET "value" = "reference_counters"."value" + 1
    RETURNING "value"`;
  return Number(rows[0].value);
}

const pad = (n: number, w = 6) => String(n).padStart(w, "0");

export async function nextReference(tx: Tx, kind: "M" | "E" | "PAY", now = new Date()) {
  const year = now.getUTCFullYear();
  const n = await nextCounter(tx, `${kind}-${year}`);
  return `KR-${kind}-${year}-${pad(n)}`;
}

export async function nextMembershipNumber(tx: Tx) {
  return `KRM-${pad(await nextCounter(tx, "MEM"), 5)}`;
}
