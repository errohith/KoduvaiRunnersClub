/**
 * Deleting a member (Super Admin only).
 *
 *  - No money ever moved (no SUCCEEDED / REFUNDED payment): HARD DELETE of the application,
 *    membership, status history, unpaid payment rows and related notification log entries.
 *  - Money moved: ANONYMISE instead — personal fields are wiped, the application/membership are
 *    cancelled, and payment amounts/references stay for accounting (the DB also forbids deleting them).
 *
 * Explicit opt-outs (WhatsApp STOP, unsubscribe link) are kept so the person is never messaged again by mistake.
 * The audit log records who deleted what, without storing the person's details.
 */
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { badRequest, notFound } from "@/lib/errors";

const MONEY_MOVED = ["SUCCEEDED", "REFUNDED", "PARTIALLY_REFUNDED"] as const;

export type DeletionPreview = { mode: "delete" | "anonymise"; referenceNo: string; paymentsKept: number };

export async function previewMemberDeletion(applicationId: string): Promise<DeletionPreview> {
  const app = await prisma.membershipApplication.findUnique({ where: { id: applicationId }, include: { payments: true } });
  if (!app) throw notFound("Application");
  const paid = app.payments.filter((p) => (MONEY_MOVED as readonly string[]).includes(p.status));
  return { mode: paid.length ? "anonymise" : "delete", referenceNo: app.referenceNo, paymentsKept: paid.length };
}

export async function deleteMember(applicationId: string, confirmReference: string, actorId: string, ip?: string | null): Promise<DeletionPreview> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "membership_applications" WHERE "id" = ${applicationId}::uuid FOR UPDATE`;
    const app = await tx.membershipApplication.findUnique({ where: { id: applicationId }, include: { payments: true, membership: true } });
    if (!app) throw notFound("Application");
    if (confirmReference.trim().toUpperCase() !== app.referenceNo) {
      throw badRequest(`Type the reference number ${app.referenceNo} exactly to confirm.`);
    }

    const paymentIds = app.payments.map((p) => p.id);
    const paid = app.payments.filter((p) => (MONEY_MOVED as readonly string[]).includes(p.status));

    // Notification log entries hold names, emails and message bodies — remove them in both modes.
    await tx.notificationDelivery.deleteMany({
      where: {
        OR: [
          { relatedId: { in: [app.id, ...paymentIds] } },
          { campaignId: { not: null }, OR: [{ recipientEmail: app.email }, { recipientPhone: app.phoneE164 }] },
        ],
      },
    });
    // Choices captured by this application form are removed. Explicit opt-outs made elsewhere
    // (WhatsApp STOP, unsubscribe link) have no sourceRef to this application and are kept.
    await tx.consentRecord.deleteMany({ where: { sourceRef: app.id } });

    if (!paid.length) {
      if (app.membership) await tx.membership.delete({ where: { id: app.membership.id } });
      await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });
      await tx.membershipApplication.delete({ where: { id: app.id } }); // status history cascades
      await audit({ actorId, action: "membership.deleted", entityType: "membership_application", entityId: app.id, metadata: { referenceNo: app.referenceNo, mode: "delete" }, ip }, tx);
      return { mode: "delete", referenceNo: app.referenceNo, paymentsKept: 0 };
    }

    // Anonymise: keep the shell for accounting, wipe everything personal.
    const placeholderEmail = `deleted-${app.id}@deleted.invalid`;
    const placeholderPhone = `deleted-${app.id.slice(0, 8)}`;
    await tx.payment.updateMany({ where: { id: { in: paymentIds }, status: { in: ["PENDING", "INITIATED"] } }, data: { status: "CANCELLED", failureReason: "Member deleted" } });
    if (app.membership) {
      await tx.membership.update({ where: { id: app.membership.id }, data: { fullName: "Deleted member", email: placeholderEmail, phoneE164: placeholderPhone, status: "CANCELLED" } });
    }
    if (["PENDING", "APPROVED", "ACTIVE"].includes(app.status)) {
      await tx.membershipStatusHistory.create({ data: { applicationId: app.id, fromStatus: app.status, toStatus: "CANCELLED", changedById: actorId, note: "Personal data deleted" } });
    }
    await tx.membershipStatusHistory.updateMany({ where: { applicationId: app.id }, data: { note: null } });
    await tx.membershipApplication.update({
      where: { id: app.id },
      data: {
        status: ["PENDING", "APPROVED", "ACTIVE"].includes(app.status) ? "CANCELLED" : app.status,
        fullName: "Deleted member",
        email: placeholderEmail,
        phoneE164: placeholderPhone,
        dateOfBirth: null,
        city: "—",
        address: null,
        experienceLevel: "—",
        interests: [],
        emergencyName: null,
        emergencyPhone: null,
        studentInstitution: null,
        studentIdNumber: null,
        referralSource: null,
        photoKey: null,
        decisionNote: null,
        submittedIp: null,
      },
    });
    await audit({ actorId, action: "membership.anonymised", entityType: "membership_application", entityId: app.id, metadata: { referenceNo: app.referenceNo, mode: "anonymise", paymentsKept: paid.length }, ip }, tx);
    return { mode: "anonymise", referenceNo: app.referenceNo, paymentsKept: paid.length };
  });
}
