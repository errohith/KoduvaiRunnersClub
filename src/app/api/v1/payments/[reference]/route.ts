import { prisma } from "@/lib/db";
import { api, ok } from "@/lib/api";
import { notFound } from "@/lib/errors";

/** Minimal, non-personal payment status (reference numbers are unguessable enough for this data). */
export const GET = api<{ params: Promise<{ reference: string }> }>(async (_req, { params }) => {
  const p = await prisma.payment.findUnique({ where: { reference: (await params).reference } });
  if (!p) throw notFound("Payment");
  return ok({ reference: p.reference, purpose: p.purpose, status: p.status, amountMinor: p.amountMinor, refundedMinor: p.refundedMinor, currency: p.currency, paidAt: p.paidAt });
});
