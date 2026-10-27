import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/** Clear rate-limit counters so repeated local E2E runs are not throttled. */
export default async function setup() {
  const prisma = new PrismaClient();
  await prisma.rateLimitBucket.deleteMany({});
  await prisma.$disconnect();
}
