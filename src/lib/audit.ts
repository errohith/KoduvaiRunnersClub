import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "./db";

export async function audit(
  entry: { actorId?: string | null; action: string; entityType: string; entityId?: string | null; metadata?: Prisma.InputJsonValue; ip?: string | null },
  tx: Tx = prisma,
) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
      ip: entry.ip ?? null,
    },
  });
}
