/**
 * Deleting events and event registrations (Super Admin only).
 *
 * Registration: no money moved → hard delete (place released, waitlist promoted);
 *               money moved   → anonymised (personal fields wiped, payment kept for accounting).
 * Event:        allowed only when no registration has a received payment — otherwise the event
 *               must be cancelled instead, so payment records keep their context. Deleting an
 *               event removes all its registrations, unpaid payment requests and message logs.
 */
import { prisma, type Tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { kick } from "./notifications";
import { promoteWaitlist, releaseSlot } from "./events";

const MONEY_MOVED = ["SUCCEEDED", "REFUNDED", "PARTIALLY_REFUNDED"] as const;
const moneyMoved = (status: string) => (MONEY_MOVED as readonly string[]).includes(status);

async function purgeRegistrationLogs(tx: Tx, registrationIds: string[], paymentIds: string[], extraRelatedIds: string[] = []) {
  await tx.notificationDelivery.deleteMany({ where: { relatedId: { in: [...registrationIds, ...paymentIds, ...extraRelatedIds] } } });
  await tx.consentRecord.deleteMany({ where: { sourceRef: { in: registrationIds } } });
}

export async function previewRegistrationDeletion(registrationId: string) {
  const reg = await prisma.eventRegistration.findUnique({ where: { id: registrationId }, include: { payments: true } });
  if (!reg) throw notFound("Registration");
  return { mode: reg.payments.some((p) => moneyMoved(p.status)) ? ("anonymise" as const) : ("delete" as const), registrationNo: reg.registrationNo };
}

export async function deleteEventRegistration(registrationId: string, confirm: string, actorId: string, ip?: string | null) {
  const out = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "event_registrations" WHERE "id" = ${registrationId}::uuid FOR UPDATE`;
    const reg = await tx.eventRegistration.findUnique({ where: { id: registrationId }, include: { payments: true, event: true } });
    if (!reg) throw notFound("Registration");
    if (confirm.trim().toUpperCase() !== reg.registrationNo) throw badRequest(`Type the registration number ${reg.registrationNo} to confirm.`);

    const paymentIds = reg.payments.map((p) => p.id);
    const paid = reg.payments.filter((p) => moneyMoved(p.status));
    const freedSlot = reg.holdsSlot && reg.status !== "CANCELLED";
    if (freedSlot) await releaseSlot(tx, reg.eventId, reg.categoryId);
    await purgeRegistrationLogs(tx, [reg.id], paymentIds);

    if (!paid.length) {
      await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });
      await tx.eventRegistration.delete({ where: { id: reg.id } }); // custom answers cascade
    } else {
      await tx.payment.updateMany({ where: { id: { in: paymentIds }, status: { in: ["PENDING", "INITIATED"] } }, data: { status: "CANCELLED", failureReason: "Registration deleted" } });
      await tx.eventCustomFieldResponse.deleteMany({ where: { registrationId: reg.id } });
      await tx.eventRegistration.update({
        where: { id: reg.id },
        data: {
          status: "CANCELLED",
          holdsSlot: false,
          cancelledAt: reg.cancelledAt ?? new Date(),
          cancelReason: "Personal data deleted",
          fullName: "Deleted participant",
          email: `deleted-${reg.id}@deleted.invalid`,
          phoneE164: `deleted-${reg.id.slice(0, 8)}`,
          dateOfBirth: null,
          gender: null,
          emergencyName: "—",
          emergencyPhone: "—",
          medicalNotes: null,
          medicalDeclaredAt: null,
          tshirtSize: null,
          accessibilityNeeds: null,
          submittedIp: null,
        },
      });
    }
    const promoted = freedSlot && reg.event.waitlistEnabled ? await promoteWaitlist(tx, reg.eventId) : [];
    const mode = paid.length ? "anonymise" : "delete";
    await audit({ actorId, action: `event_registration.${mode === "delete" ? "deleted" : "anonymised"}`, entityType: "event_registration", entityId: reg.id, metadata: { registrationNo: reg.registrationNo, eventId: reg.eventId, mode }, ip }, tx);
    return { mode, registrationNo: reg.registrationNo, eventId: reg.eventId, promoted };
  });
  kick(out.promoted);
  return { mode: out.mode, registrationNo: out.registrationNo, eventId: out.eventId };
}

export async function previewEventDeletion(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { _count: { select: { registrations: true } } } });
  if (!event) throw notFound("Event");
  const paid = await prisma.payment.count({ where: { eventRegistration: { eventId }, status: { in: [...MONEY_MOVED] } } });
  return { slug: event.slug, registrations: event._count.registrations, paidRegistrations: paid, allowed: paid === 0 };
}

export async function deleteEvent(eventId: string, confirm: string, actorId: string, ip?: string | null) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "events" WHERE "id" = ${eventId}::uuid FOR UPDATE`;
    const event = await tx.event.findUnique({ where: { id: eventId }, include: { registrations: { include: { payments: true } } } });
    if (!event) throw notFound("Event");
    if (confirm.trim().toLowerCase() !== event.slug) throw badRequest(`Type the event URL slug "${event.slug}" to confirm.`);
    if (event.registrations.some((r) => r.payments.some((p) => moneyMoved(p.status)))) {
      throw conflict("event_has_payments", "This event has registrations with received payments. Cancel the event instead (participants are notified and payment records stay intact), or delete those registrations first.");
    }
    const regIds = event.registrations.map((r) => r.id);
    const paymentIds = event.registrations.flatMap((r) => r.payments.map((p) => p.id));
    await purgeRegistrationLogs(tx, regIds, paymentIds, [event.id]);
    await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });
    await tx.eventRegistration.deleteMany({ where: { eventId } });
    await tx.event.delete({ where: { id: eventId } }); // categories + custom fields cascade
    await audit({ actorId, action: "event.deleted", entityType: "event", entityId: eventId, metadata: { slug: event.slug, title: event.title, registrationsDeleted: regIds.length }, ip }, tx);
    return { slug: event.slug, registrationsDeleted: regIds.length };
  });
}
