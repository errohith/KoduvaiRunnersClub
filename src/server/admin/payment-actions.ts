"use server";
import { parseMajorToMinor } from "@/lib/money";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { recordOfflinePayment, recordRefund } from "@/server/services/payments";
import { runAdminAction, str } from "./run";

export async function offlinePaymentAction(fd: FormData) {
  return runAdminAction("payments.manage", str(fd, "back") || "/admin/payments", async ({ user, ip }) => {
    await recordOfflinePayment(str(fd, "reference"), str(fd, "note"), user.id, ip);
    return "Payment recorded and the registration updated.";
  });
}

export async function refundAction(fd: FormData) {
  return runAdminAction("payments.manage", str(fd, "back") || "/admin/payments", async ({ user, ip }) => {
    const p = await prisma.payment.findUnique({ where: { reference: str(fd, "reference") } });
    if (!p) throw notFound("Payment");
    await recordRefund(p.reference, parseMajorToMinor(str(fd, "amount"), p.currency), str(fd, "reason") || "Refund", user.id, ip);
    return "Refund recorded.";
  });
}
