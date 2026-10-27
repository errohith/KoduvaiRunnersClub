/**
 * Membership workflow.
 *
 *  Status machine (MembershipApplication.status):
 *
 *     submit ──► PENDING ──approve──► APPROVED ──payment succeeded──► ACTIVE
 *                  │   └──approve (free plan)─────────────────────────► ACTIVE
 *                  └─reject──► REJECTED          APPROVED ─reject/cancel─► REJECTED/CANCELLED
 *     When approval is not required, submission immediately performs the "approve" step.
 *
 *  Activation rule: approval satisfied AND (fee == 0 OR a SUCCEEDED payment exists).
 *  Paid plans are never ACTIVE without a confirmed payment.
 */
import type { ApplicationStatus, MembershipApplication } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { nextMembershipNumber, nextReference } from "@/lib/refs";
import { badRequest, conflict, isUniqueViolation, notFound, validationError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { audit } from "@/lib/audit";
import { config } from "@/config/env";
import type { MembershipApplicationInput } from "@/validation/schemas";
import { loadSettings } from "./settings";
import { enqueueAdminAlert, enqueueTemplate, kick, recordConsent } from "./notifications";
import { cancelOpenPayments, ensurePendingPayment } from "./payments";

export const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  PENDING: ["APPROVED", "ACTIVE", "REJECTED", "CANCELLED"],
  APPROVED: ["ACTIVE", "REJECTED", "CANCELLED"],
  ACTIVE: ["CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus) {
  return TRANSITIONS[from].includes(to);
}

/** Status an application should move to once approval is satisfied. */
export function statusAfterApproval(feeMinor: number, hasSucceededPayment: boolean): ApplicationStatus {
  return feeMinor === 0 || hasSucceededPayment ? "ACTIVE" : "APPROVED";
}

async function transition(tx: Tx, app: MembershipApplication, to: ApplicationStatus, actorId: string | null, note?: string) {
  if (!canTransition(app.status, to)) throw conflict("invalid_transition", `Cannot move an application from ${app.status} to ${to}.`);
  const updated = await tx.membershipApplication.update({
    where: { id: app.id },
    data: {
      status: to,
      ...(actorId && ["APPROVED", "ACTIVE", "REJECTED"].includes(to) && app.status === "PENDING"
        ? { reviewedById: actorId, reviewedAt: new Date(), decisionNote: note ?? null }
        : {}),
      ...(to === "REJECTED" ? { decisionNote: note ?? null } : {}),
    },
  });
  await tx.membershipStatusHistory.create({ data: { applicationId: app.id, fromStatus: app.status, toStatus: to, changedById: actorId, note } });
  return updated;
}

async function lockApplication(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT 1 FROM "membership_applications" WHERE "id" = ${id}::uuid FOR UPDATE`;
  const app = await tx.membershipApplication.findUnique({ where: { id }, include: { plan: true } });
  if (!app) throw notFound("Application");
  return app;
}

async function createMembership(tx: Tx, app: MembershipApplication & { plan: { durationMonths: number | null } }) {
  const existing = await tx.membership.findUnique({ where: { applicationId: app.id } });
  if (existing) return existing;
  const startsAt = new Date();
  const expiresAt = app.plan.durationMonths ? addMonths(startsAt, app.plan.durationMonths) : null;
  return tx.membership.create({
    data: {
      membershipNo: await nextMembershipNumber(tx),
      applicationId: app.id,
      planId: app.planId,
      fullName: app.fullName,
      email: app.email,
      phoneE164: app.phoneE164,
      startsAt,
      expiresAt,
    },
  });
}

export function addMonths(d: Date, months: number) {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}

/** Performs the approval step (by an admin, or automatically when approval is not required). */
async function applyApproval(tx: Tx, app: Awaited<ReturnType<typeof lockApplication>>, actorId: string | null, note?: string) {
  const paid = await tx.payment.findFirst({ where: { membershipApplicationId: app.id, status: "SUCCEEDED" } });
  const target = statusAfterApproval(app.feeMinor, !!paid);
  const updated = await transition(tx, app, target, actorId, note ?? (actorId ? undefined : "Auto-approved (approval not required)"));
  const ids: string[] = [];
  const who = { name: app.fullName, email: app.email, phone: app.phoneE164 };
  if (target === "ACTIVE") {
    const m = await createMembership(tx, app);
    ids.push(
      ...(await enqueueTemplate("membership.activated", who, { referenceNo: app.referenceNo, planName: app.plan.name, membershipNo: m.membershipNo }, {
        idempotencyBase: `membership.activated:${app.id}`,
        relatedType: "membership_application",
        relatedId: app.id,
      }, tx)),
    );
  } else {
    const payment = await ensurePendingPayment(tx, { purpose: "MEMBERSHIP", membershipApplicationId: app.id }, app.feeMinor, app.currency);
    ids.push(
      ...(await enqueueTemplate(
        "membership.approved",
        who,
        {
          referenceNo: app.referenceNo,
          planName: app.plan.name,
          fee: formatMoney(app.feeMinor, app.currency),
          paymentReference: payment.reference,
          statusUrl: `${config.APP_URL}/payment/status?ref=${payment.reference}`,
          note: note ?? "",
        },
        { idempotencyBase: `membership.approved:${app.id}`, relatedType: "membership_application", relatedId: app.id },
        tx,
      )),
    );
  }
  return { app: updated, ids };
}

export async function submitApplication(input: MembershipApplicationInput, ip: string | null) {
  const settings = await loadSettings();
  if (!settings.membership.applicationsOpen) throw conflict("applications_closed", "Membership applications are currently closed.");
  const plan = await prisma.membershipPlan.findUnique({ where: { id: input.planId } });
  if (!plan || !plan.isActive) throw validationError({ planId: "This membership type is not available." });

  const fieldErrors: Record<string, string> = {};
  if (plan.requiresStudentVerification) {
    if (!input.studentInstitution) fieldErrors.studentInstitution = "Institution is required for student membership";
    if (!input.studentIdNumber) fieldErrors.studentIdNumber = "Student ID number is required for student membership";
  }
  if (settings.membership.requireDateOfBirth && !input.dateOfBirth) fieldErrors.dateOfBirth = "Date of birth is required";
  if (settings.membership.requireEmergencyContact && (!input.emergencyName || !input.emergencyPhone)) {
    fieldErrors.emergencyName = "Emergency contact is required";
  }
  if (Object.keys(fieldErrors).length) throw validationError(fieldErrors);

  // Friendly pre-check; the partial unique indexes are the real guarantee under concurrency.
  const dup = await prisma.membershipApplication.findFirst({
    where: { status: { in: ["PENDING", "APPROVED", "ACTIVE"] }, OR: [{ email: input.email }, { phoneE164: input.phone }] },
    select: { referenceNo: true },
  });
  if (dup) throw conflict("duplicate_application", "An application with this email or mobile number is already open or active. Contact the club if you need help.");

  const approvalRequired = plan.requiresApproval ?? settings.membership.requireApproval;
  const now = new Date();
  try {
    const { app, ids } = await prisma.$transaction(async (tx) => {
      const created = await tx.membershipApplication.create({
        data: {
          referenceNo: await nextReference(tx, "M"),
          planId: plan.id,
          feeMinor: plan.feeMinor,
          currency: plan.currency,
          approvalRequired,
          status: "PENDING",
          fullName: input.fullName,
          email: input.email,
          phoneE164: input.phone,
          dateOfBirth: input.dateOfBirth ?? null,
          city: input.city,
          address: input.address,
          experienceLevel: input.experienceLevel,
          interests: input.interests,
          emergencyName: input.emergencyName,
          emergencyPhone: input.emergencyPhone,
          studentInstitution: plan.requiresStudentVerification ? input.studentInstitution : null,
          studentIdNumber: plan.requiresStudentVerification ? input.studentIdNumber : null,
          referralSource: input.referralSource,
          termsAcceptedAt: now,
          privacyAcceptedAt: now,
          submittedIp: ip,
        },
      });
      await tx.membershipStatusHistory.create({ data: { applicationId: created.id, toStatus: "PENDING", note: "Application submitted" } });
      await recordConsent(tx, { phone: input.phone, channel: "WHATSAPP", granted: input.consentWhatsapp, source: "membership_form", sourceRef: created.id, ip });
      await recordConsent(tx, { email: input.email, channel: "EMAIL_MARKETING", granted: input.consentMarketingEmail, source: "membership_form", sourceRef: created.id, ip });

      const who = { name: created.fullName, email: created.email, phone: created.phoneE164 };
      const vars = { referenceNo: created.referenceNo, planName: plan.name, fee: formatMoney(plan.feeMinor, plan.currency) };
      const ids = [
        ...(await enqueueTemplate("membership.application.received", who, vars, { idempotencyBase: `membership.received:${created.id}`, relatedType: "membership_application", relatedId: created.id }, tx)),
        ...(await enqueueAdminAlert(
          "membership.application.admin_alert",
          { ...vars, applicantName: created.fullName, applicantEmail: created.email, applicantPhone: created.phoneE164, reviewUrl: `${config.APP_URL}/admin/applications/${created.id}` },
          { idempotencyBase: `membership.admin_alert:${created.id}`, relatedType: "membership_application", relatedId: created.id },
          tx,
        )),
      ];
      if (!approvalRequired) {
        const locked = await lockApplication(tx, created.id);
        const r = await applyApproval(tx, locked, null);
        return { app: r.app, ids: [...ids, ...r.ids] };
      }
      return { app: created, ids };
    });
    kick(ids);
    const payment = await prisma.payment.findFirst({ where: { membershipApplicationId: app.id, status: { in: ["PENDING", "INITIATED"] } } });
    return { referenceNo: app.referenceNo, status: app.status, planName: plan.name, feeMinor: app.feeMinor, currency: app.currency, approvalRequired, paymentReference: payment?.reference ?? null };
  } catch (e) {
    if (isUniqueViolation(e, ["email", "phone_e164"])) {
      throw conflict("duplicate_application", "An application with this email or mobile number is already open or active. Contact the club if you need help.");
    }
    throw e;
  }
}

export async function decideApplication(applicationId: string, decision: "approve" | "reject", note: string | undefined, actorId: string, ip?: string | null) {
  const ids = await prisma.$transaction(async (tx) => {
    const app = await lockApplication(tx, applicationId);
    if (decision === "approve") {
      if (app.status !== "PENDING") throw conflict("invalid_transition", `Only pending applications can be approved (current: ${app.status}).`);
      const r = await applyApproval(tx, app, actorId, note);
      await audit({ actorId, action: "membership.approved", entityType: "membership_application", entityId: app.id, metadata: { to: r.app.status }, ip }, tx);
      return r.ids;
    }
    if (await tx.payment.findFirst({ where: { membershipApplicationId: app.id, status: "SUCCEEDED" } })) {
      throw conflict("payment_received", "A payment has been received for this application. Record a refund before rejecting it.");
    }
    if (!note) throw badRequest("Please give a reason for the rejection.");
    await transition(tx, app, "REJECTED", actorId, note);
    await cancelOpenPayments(tx, { membershipApplicationId: app.id }, "Application rejected");
    await audit({ actorId, action: "membership.rejected", entityType: "membership_application", entityId: app.id, metadata: { note }, ip }, tx);
    return enqueueTemplate(
      "membership.rejected",
      { name: app.fullName, email: app.email, phone: app.phoneE164 },
      { referenceNo: app.referenceNo, planName: app.plan.name, note },
      { idempotencyBase: `membership.rejected:${app.id}`, relatedType: "membership_application", relatedId: app.id },
      tx,
    );
  });
  kick(ids);
}

/** Called inside the payment transaction when a membership payment succeeds. Idempotent. */
export async function activateAfterPayment(tx: Tx, applicationId: string): Promise<string[]> {
  const app = await lockApplication(tx, applicationId);
  if (app.status !== "APPROVED") return []; // still awaiting approval, or already active
  await transition(tx, app, "ACTIVE", null, "Payment confirmed");
  const m = await createMembership(tx, app);
  return enqueueTemplate(
    "membership.activated",
    { name: app.fullName, email: app.email, phone: app.phoneE164 },
    { referenceNo: app.referenceNo, planName: app.plan.name, membershipNo: m.membershipNo },
    { idempotencyBase: `membership.activated:${app.id}`, relatedType: "membership_application", relatedId: app.id },
    tx,
  );
}

export async function cancelApplication(applicationId: string, note: string, actorId: string, ip?: string | null) {
  await prisma.$transaction(async (tx) => {
    const app = await lockApplication(tx, applicationId);
    await transition(tx, app, "CANCELLED", actorId, note);
    await cancelOpenPayments(tx, { membershipApplicationId: app.id }, "Application cancelled");
    await tx.membership.updateMany({ where: { applicationId: app.id, status: { in: ["ACTIVE", "SUSPENDED"] } }, data: { status: "CANCELLED" } });
    await audit({ actorId, action: "membership.cancelled", entityType: "membership_application", entityId: app.id, metadata: { note }, ip }, tx);
  });
}

export async function setMembershipStatus(membershipId: string, status: "ACTIVE" | "SUSPENDED" | "CANCELLED", actorId: string, ip?: string | null) {
  const m = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!m) throw notFound("Membership");
  if (m.status === "CANCELLED") throw conflict("membership_cancelled", "Cancelled memberships cannot be changed.");
  await prisma.$transaction([
    prisma.membership.update({ where: { id: m.id }, data: { status } }),
    prisma.auditLog.create({ data: { actorId, action: `membership.status.${status.toLowerCase()}`, entityType: "membership", entityId: m.id, metadata: { from: m.status }, ip: ip ?? null } }),
  ]);
}

/** Admin-recorded renewal (payment verified separately). Extends from the later of now/expiry. */
export async function renewMembership(membershipId: string, months: number, actorId: string, ip?: string | null) {
  if (!Number.isInteger(months) || months < 1 || months > 120) throw badRequest("Renewal must be between 1 and 120 months.");
  const m = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!m) throw notFound("Membership");
  if (m.status === "CANCELLED") throw conflict("membership_cancelled", "Cancelled memberships cannot be renewed.");
  const base = m.expiresAt && m.expiresAt > new Date() ? m.expiresAt : new Date();
  const expiresAt = addMonths(base, months);
  await prisma.$transaction([
    prisma.membership.update({ where: { id: m.id }, data: { status: "ACTIVE", expiresAt } }),
    prisma.auditLog.create({ data: { actorId, action: "membership.renewed", entityType: "membership", entityId: m.id, metadata: { months, expiresAt: expiresAt.toISOString() }, ip: ip ?? null } }),
  ]);
}

/** Worker job: expire memberships past their expiry date. */
export async function expireMemberships() {
  return prisma.membership.updateMany({ where: { status: "ACTIVE", expiresAt: { lt: new Date() } }, data: { status: "EXPIRED" } });
}

export async function getApplicationStatus(referenceNo: string, email: string) {
  const app = await prisma.membershipApplication.findUnique({
    where: { referenceNo },
    include: { plan: true, membership: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!app || app.email !== email.trim().toLowerCase()) return null;
  return app;
}
