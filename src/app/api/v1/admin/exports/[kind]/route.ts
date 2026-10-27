import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { api } from "@/lib/api";
import { can, requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { csvResponse, toCsv } from "@/lib/csv";
import { minorToMajorString } from "@/lib/money";
import { notFound } from "@/lib/errors";
import type { Permission } from "@/lib/auth/permissions";

const PERM: Record<string, Permission> = { applications: "members.export", members: "members.export", registrations: "registrations.export", payments: "reports.view", contacts: "contact.view" };
const d = (x: Date | null | undefined) => (x ? x.toISOString() : "");

export const GET = api<{ params: Promise<{ kind: string }> }>(async (req, { params }) => {
  const kind = (await params).kind;
  if (!PERM[kind]) throw notFound("Export");
  const user = await requirePermission(PERM[kind]);
  const q = new URL(req.url).searchParams;
  const stamp = new Date().toISOString().slice(0, 10);
  let csv: string;

  if (kind === "applications") {
    const where: Prisma.MembershipApplicationWhereInput = { ...(q.get("status") ? { status: q.get("status") as never } : {}), ...(q.get("plan") ? { planId: q.get("plan")! } : {}) };
    const rows = await prisma.membershipApplication.findMany({ where, include: { plan: true }, orderBy: { createdAt: "asc" } });
    csv = toCsv(
      ["Reference", "Status", "Plan", "Fee", "Currency", "Full name", "Email", "Phone", "City", "Experience", "Interests", "Student institution", "Submitted", "Reviewed"],
      rows.map((r) => [r.referenceNo, r.status, r.plan.name, minorToMajorString(r.feeMinor, r.currency), r.currency, r.fullName, r.email, r.phoneE164, r.city, r.experienceLevel, r.interests.join("; "), r.studentInstitution, d(r.createdAt), d(r.reviewedAt)]),
    );
  } else if (kind === "members") {
    const where: Prisma.MembershipWhereInput = { ...(q.get("status") ? { status: q.get("status") as never } : {}), ...(q.get("plan") ? { planId: q.get("plan")! } : {}) };
    const rows = await prisma.membership.findMany({ where, include: { plan: true }, orderBy: { membershipNo: "asc" } });
    csv = toCsv(["Membership no.", "Status", "Plan", "Full name", "Email", "Phone", "Starts", "Expires"], rows.map((m) => [m.membershipNo, m.status, m.plan.name, m.fullName, m.email, m.phoneE164, d(m.startsAt), d(m.expiresAt)]));
  } else if (kind === "registrations") {
    const eventId = q.get("eventId");
    if (!eventId) throw notFound("Event");
    const restricted = can(user, "registrations.restricted");
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId }, include: { customFields: { orderBy: { sortOrder: "asc" } } } });
    const rows = await prisma.eventRegistration.findMany({
      where: { eventId, ...(q.get("status") ? { status: q.get("status") as never } : {}), ...(q.get("category") ? { categoryId: q.get("category")! } : {}), ...(q.get("type") ? { participantType: q.get("type") as never } : {}) },
      include: { category: true, responses: true },
      orderBy: { createdAt: "asc" },
    });
    csv = toCsv(
      ["Registration no.", "Status", "Type", "Category", "Full name", "Email", "Phone", "Date of birth", "Gender", "T-shirt", "Fee", "Checked in", ...(restricted ? ["Emergency name", "Emergency phone", "Medical notes", "Accessibility"] : []), ...event.customFields.map((f) => f.label), "Registered"],
      rows.map((r) => [
        r.registrationNo, r.status, r.participantType, r.category?.name, r.fullName, r.email, r.phoneE164, r.dateOfBirth?.toISOString().slice(0, 10), r.gender, r.tshirtSize, minorToMajorString(r.feeMinor, r.currency), d(r.attendedAt),
        ...(restricted ? [r.emergencyName, r.emergencyPhone, r.medicalNotes, r.accessibilityNeeds] : []),
        ...event.customFields.map((f) => r.responses.find((x) => x.fieldId === f.id)?.value ?? ""),
        d(r.createdAt),
      ]),
    );
  } else if (kind === "payments") {
    const rows = await prisma.payment.findMany({ include: { membershipApplication: true, eventRegistration: { include: { event: true } } }, orderBy: { createdAt: "asc" } });
    csv = toCsv(
      ["Reference", "Purpose", "For", "Payer", "Amount", "Refunded", "Currency", "Status", "Provider", "Provider payment id", "Paid at", "Created"],
      rows.map((p) => [p.reference, p.purpose, p.membershipApplication?.referenceNo ?? `${p.eventRegistration?.registrationNo} ${p.eventRegistration?.event.title}`, p.membershipApplication?.fullName ?? p.eventRegistration?.fullName, minorToMajorString(p.amountMinor, p.currency), minorToMajorString(p.refundedMinor, p.currency), p.currency, p.status, p.provider, p.providerPaymentId, d(p.paidAt), d(p.createdAt)]),
    );
  } else {
    const rows = await prisma.contactMessage.findMany({ orderBy: { createdAt: "asc" } });
    csv = toCsv(["Received", "Status", "Name", "Email", "Phone", "Subject", "Message"], rows.map((m) => [d(m.createdAt), m.status, m.name, m.email, m.phone, m.subject, m.message]));
  }
  await audit({ actorId: user.id, action: `export.${kind}`, entityType: "export", metadata: Object.fromEntries(q) });
  return csvResponse(`${kind}-${stamp}.csv`, csv);
});
