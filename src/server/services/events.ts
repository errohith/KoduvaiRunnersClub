/**
 * Event & marathon registration — a workflow fully separate from membership.
 *
 * Overbooking protection: capacity slots are taken with a single conditional UPDATE
 *   UPDATE ... SET registered_count = registered_count + 1
 *   WHERE id = $1 AND (capacity IS NULL OR registered_count < capacity)
 * inside the registration transaction. Postgres row locks serialise concurrent increments, so
 * exactly `capacity` registrations succeed; a CHECK constraint is the final backstop.
 * Registrations awaiting payment HOLD their slot (holdsSlot = true) so paid events cannot be
 * oversold later; admins can cancel stale holds, which frees the slot and promotes the waitlist.
 */
import type { Event, EventCategory, EventCustomField, Prisma, RegistrationStatus } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { nextReference } from "@/lib/refs";
import { conflict, isUniqueViolation, notFound, validationError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { ageOn, formatDateTime } from "@/lib/time";
import { audit } from "@/lib/audit";
import { config } from "@/config/env";
import type { EventRegistrationInput } from "@/validation/schemas";
import { enqueueTemplate, kick, recordConsent } from "./notifications";
import { cancelOpenPayments, ensurePendingPayment } from "./payments";

export type RegistrationWindow = "open" | "not_open_yet" | "closed" | "disabled" | "cancelled" | "past";

export function registrationWindow(e: Pick<Event, "status" | "registrationEnabled" | "registrationOpensAt" | "registrationClosesAt" | "startsAt">, now = new Date()): RegistrationWindow {
  if (e.status === "CANCELLED") return "cancelled";
  if (e.status !== "PUBLISHED") return "disabled";
  if (e.startsAt < now) return "past";
  if (!e.registrationEnabled) return "disabled";
  if (e.registrationOpensAt && e.registrationOpensAt > now) return "not_open_yet";
  if (e.registrationClosesAt && e.registrationClosesAt < now) return "closed";
  return "open";
}

export function spotsLeft(capacity: number | null, registered: number) {
  return capacity === null ? null : Math.max(0, capacity - registered);
}

/** Validate event-specific custom field answers. Returns normalised values keyed by field id. */
export function validateCustomFields(fields: EventCustomField[], answers: Record<string, string>) {
  const errors: Record<string, string> = {};
  const values: { fieldId: string; value: string }[] = [];
  for (const f of fields) {
    const raw = (answers[f.key] ?? "").trim();
    if (!raw) {
      if (f.required && f.type !== "CHECKBOX") errors[`customFields.${f.key}`] = `${f.label} is required`;
      if (f.required && f.type === "CHECKBOX") errors[`customFields.${f.key}`] = `Please confirm: ${f.label}`;
      continue;
    }
    if (f.type === "NUMBER" && !/^-?\d+(\.\d+)?$/.test(raw)) errors[`customFields.${f.key}`] = `${f.label} must be a number`;
    else if (f.type === "DATE" && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) errors[`customFields.${f.key}`] = `${f.label} must be a date`;
    else if (f.type === "SELECT" && !f.options.includes(raw)) errors[`customFields.${f.key}`] = `Choose a valid option for ${f.label}`;
    else if (f.type === "CHECKBOX" && !["true", "on", "yes"].includes(raw.toLowerCase())) {
      if (f.required) errors[`customFields.${f.key}`] = `Please confirm: ${f.label}`;
      continue;
    } else values.push({ fieldId: f.id, value: f.type === "CHECKBOX" ? "yes" : raw.slice(0, 1000) });
  }
  return { errors, values };
}

/** Atomically take one slot on the event and category. Returns false when full. */
export async function takeSlot(tx: Tx, eventId: string, categoryId: string | null): Promise<boolean> {
  const ev = await tx.$executeRaw`
    UPDATE "events" SET "registered_count" = "registered_count" + 1
    WHERE "id" = ${eventId}::uuid AND ("capacity" IS NULL OR "registered_count" < "capacity")`;
  if (ev !== 1) return false;
  if (categoryId) {
    const cat = await tx.$executeRaw`
      UPDATE "event_categories" SET "registered_count" = "registered_count" + 1
      WHERE "id" = ${categoryId}::uuid AND ("capacity" IS NULL OR "registered_count" < "capacity")`;
    if (cat !== 1) {
      await tx.$executeRaw`UPDATE "events" SET "registered_count" = "registered_count" - 1 WHERE "id" = ${eventId}::uuid`;
      return false;
    }
  }
  return true;
}

export async function releaseSlot(tx: Tx, eventId: string, categoryId: string | null) {
  await tx.$executeRaw`UPDATE "events" SET "registered_count" = GREATEST("registered_count" - 1, 0) WHERE "id" = ${eventId}::uuid`;
  if (categoryId) await tx.$executeRaw`UPDATE "event_categories" SET "registered_count" = GREATEST("registered_count" - 1, 0) WHERE "id" = ${categoryId}::uuid`;
}

function regVars(e: Event, cat: EventCategory | null, reg: { registrationNo: string; feeMinor: number; currency: string }, extra: Record<string, unknown> = {}) {
  return {
    eventTitle: e.title,
    eventDate: formatDateTime(e.startsAt),
    venue: e.venueName,
    category: cat?.name ?? "Volunteer",
    registrationNo: reg.registrationNo,
    fee: formatMoney(reg.feeMinor, reg.currency),
    eventUrl: `${config.APP_URL}/events/${e.slug}`,
    ...extra,
  };
}

export async function registerForEvent(input: EventRegistrationInput, ip: string | null) {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    include: { categories: { where: { isActive: true } }, customFields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!event) throw notFound("Event");
  const window = registrationWindow(event);
  if (window !== "open") {
    const msg: Record<RegistrationWindow, string> = {
      open: "",
      not_open_yet: "Registration has not opened yet.",
      closed: "Registration for this event has closed.",
      disabled: "Registration is not available for this event.",
      cancelled: "This event has been cancelled.",
      past: "This event has already taken place.",
    };
    throw conflict(`registration_${window}`, msg[window]);
  }

  const isVolunteer = input.participantType === "VOLUNTEER";
  const errors: Record<string, string> = {};
  let category: EventCategory | null = null;
  if (isVolunteer) {
    if (!event.volunteersEnabled) errors.participantType = "This event is not accepting volunteers.";
  } else {
    category = event.categories.find((c) => c.id === input.categoryId) ?? null;
    if (!category) errors.categoryId = "Choose a distance / category.";
  }
  if (event.collectDateOfBirth && !input.dateOfBirth) errors.dateOfBirth = "Date of birth is required for this event.";
  if (event.collectGender && !isVolunteer && !input.gender) errors.gender = "Please select a category for results (gender).";
  if (event.collectTshirtSize && !input.tshirtSize) errors.tshirtSize = "Choose a T-shirt size.";
  if (input.tshirtSize && event.tshirtSizes.length && !event.tshirtSizes.includes(input.tshirtSize)) errors.tshirtSize = "Choose a valid T-shirt size.";
  if (event.waiverText && !input.acceptWaiver) errors.acceptWaiver = "You must accept the liability waiver.";
  if (event.medicalDeclarationText && !isVolunteer && !input.medicalDeclaration) errors.medicalDeclaration = "Please confirm the medical declaration.";
  if (category && (category.minAge || category.maxAge)) {
    if (!input.dateOfBirth) errors.dateOfBirth = "Date of birth is required to check age eligibility.";
    else {
      const age = ageOn(input.dateOfBirth, event.startsAt);
      if (category.minAge && age < category.minAge) errors.dateOfBirth = `Minimum age for ${category.name} is ${category.minAge} on race day.`;
      if (category.maxAge && age > category.maxAge) errors.dateOfBirth = `Maximum age for ${category.name} is ${category.maxAge} on race day.`;
    }
  }
  const custom = validateCustomFields(event.customFields, input.customFields);
  Object.assign(errors, custom.errors);
  if (Object.keys(errors).length) throw validationError(errors);

  const feeMinor = isVolunteer ? 0 : category!.feeMinor;
  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const gotSlot = isVolunteer ? false : await takeSlot(tx, event.id, category!.id);
      let status: RegistrationStatus;
      if (isVolunteer) status = "CONFIRMED";
      else if (gotSlot) status = feeMinor > 0 ? "PENDING_PAYMENT" : "CONFIRMED";
      else if (event.waitlistEnabled) status = "WAITLISTED";
      else throw conflict("sold_out", category!.capacity !== null && category!.registeredCount >= category!.capacity ? `${category!.name} is full.` : "This event is full.");

      const reg = await tx.eventRegistration.create({
        data: {
          registrationNo: await nextReference(tx, "E"),
          eventId: event.id,
          categoryId: category?.id ?? null,
          participantType: input.participantType,
          status,
          holdsSlot: gotSlot,
          feeMinor,
          currency: event.currency,
          fullName: input.fullName,
          email: input.email,
          phoneE164: input.phone,
          dateOfBirth: input.dateOfBirth ?? null,
          gender: event.collectGender ? input.gender : null,
          emergencyName: input.emergencyName,
          emergencyPhone: input.emergencyPhone,
          medicalDeclaredAt: input.medicalDeclaration ? now : null,
          medicalNotes: input.medicalNotes,
          tshirtSize: event.collectTshirtSize ? input.tshirtSize : null,
          accessibilityNeeds: input.accessibilityNeeds,
          termsAcceptedAt: now,
          waiverAcceptedAt: input.acceptWaiver ? now : null,
          waitlistedAt: status === "WAITLISTED" ? now : null,
          submittedIp: ip,
        },
      });
      if (custom.values.length) {
        await tx.eventCustomFieldResponse.createMany({ data: custom.values.map((v) => ({ registrationId: reg.id, ...v })) });
      }
      await recordConsent(tx, { phone: input.phone, channel: "WHATSAPP", granted: input.consentWhatsapp, source: "event_form", sourceRef: reg.id, ip });
      await recordConsent(tx, { email: input.email, channel: "EMAIL_MARKETING", granted: input.consentMarketingEmail, source: "event_form", sourceRef: reg.id, ip });

      let paymentReference: string | null = null;
      if (status === "PENDING_PAYMENT") {
        paymentReference = (await ensurePendingPayment(tx, { purpose: "EVENT_REGISTRATION", eventRegistrationId: reg.id }, feeMinor, event.currency)).reference;
      }
      const templateKey = status === "CONFIRMED" ? "event.registration.confirmed" : status === "WAITLISTED" ? "event.registration.waitlisted" : "event.registration.pending_payment";
      const ids = await enqueueTemplate(
        templateKey,
        { name: reg.fullName, email: reg.email, phone: reg.phoneE164 },
        regVars(event, category, reg, paymentReference ? { paymentReference, statusUrl: `${config.APP_URL}/payment/status?ref=${paymentReference}` } : {}),
        { idempotencyBase: `${templateKey}:${reg.id}`, relatedType: "event_registration", relatedId: reg.id },
        tx,
      );
      return { reg, paymentReference, ids };
    });
    kick(result.ids);
    return {
      registrationNo: result.reg.registrationNo,
      status: result.reg.status,
      feeMinor,
      currency: event.currency,
      eventTitle: event.title,
      eventSlug: event.slug,
      category: category?.name ?? "Volunteer",
      paymentReference: result.paymentReference,
    };
  } catch (e) {
    if (isUniqueViolation(e, "email")) {
      throw conflict("duplicate_registration", "This email is already registered for this event.");
    }
    throw e;
  }
}

/** Promote the earliest waitlisted registrations while slots are available. */
export async function promoteWaitlist(tx: Tx, eventId: string): Promise<string[]> {
  const ids: string[] = [];
  const waiting = await tx.eventRegistration.findMany({
    where: { eventId, status: "WAITLISTED" },
    orderBy: { waitlistedAt: "asc" },
    include: { event: true, category: true },
  });
  for (const w of waiting) {
    if (!(await takeSlot(tx, eventId, w.categoryId))) continue;
    const status: RegistrationStatus = w.feeMinor > 0 ? "PENDING_PAYMENT" : "CONFIRMED";
    await tx.eventRegistration.update({ where: { id: w.id }, data: { status, holdsSlot: true } });
    let extra = {};
    if (status === "PENDING_PAYMENT") {
      const p = await ensurePendingPayment(tx, { purpose: "EVENT_REGISTRATION", eventRegistrationId: w.id }, w.feeMinor, w.currency);
      extra = { paymentReference: p.reference, statusUrl: `${config.APP_URL}/payment/status?ref=${p.reference}` };
    }
    ids.push(
      ...(await enqueueTemplate("event.registration.promoted", { name: w.fullName, email: w.email, phone: w.phoneE164 }, regVars(w.event, w.category, w, extra), {
        idempotencyBase: `event.registration.promoted:${w.id}`,
        relatedType: "event_registration",
        relatedId: w.id,
      }, tx)),
    );
  }
  return ids;
}

export async function cancelRegistration(registrationId: string, reason: string, actorId: string | null, ip?: string | null) {
  const ids = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "event_registrations" WHERE "id" = ${registrationId}::uuid FOR UPDATE`;
    const reg = await tx.eventRegistration.findUnique({ where: { id: registrationId }, include: { event: true, category: true } });
    if (!reg) throw notFound("Registration");
    if (reg.status === "CANCELLED") return [];
    if (await tx.payment.findFirst({ where: { eventRegistrationId: reg.id, status: "SUCCEEDED" } })) {
      // Cancelling is allowed, but the refund decision follows the event's cancellation policy.
      reason = `${reason} (paid — review refund per cancellation policy)`;
    }
    await tx.eventRegistration.update({ where: { id: reg.id }, data: { status: "CANCELLED", holdsSlot: false, cancelledAt: new Date(), cancelReason: reason } });
    if (reg.holdsSlot) await releaseSlot(tx, reg.eventId, reg.categoryId);
    await cancelOpenPayments(tx, { eventRegistrationId: reg.id }, "Registration cancelled");
    await audit({ actorId, action: "event_registration.cancelled", entityType: "event_registration", entityId: reg.id, metadata: { reason }, ip }, tx);
    const out = await enqueueTemplate("event.registration.cancelled", { name: reg.fullName, email: reg.email, phone: reg.phoneE164 }, regVars(reg.event, reg.category, reg, { reason }), {
      idempotencyBase: `event.registration.cancelled:${reg.id}`,
      relatedType: "event_registration",
      relatedId: reg.id,
    }, tx);
    if (reg.holdsSlot && reg.event.waitlistEnabled) out.push(...(await promoteWaitlist(tx, reg.eventId)));
    return out;
  });
  kick(ids);
}

export async function promoteNow(eventId: string, actorId: string) {
  const ids = await prisma.$transaction(async (tx) => {
    const out = await promoteWaitlist(tx, eventId);
    await audit({ actorId, action: "event.waitlist_promoted", entityType: "event", entityId: eventId, metadata: { notified: out.length } }, tx);
    return out;
  });
  kick(ids);
  return ids.length;
}

/** Called inside the payment transaction when an event payment succeeds. Idempotent. */
export async function confirmAfterPayment(tx: Tx, registrationId: string): Promise<string[]> {
  await tx.$queryRaw`SELECT 1 FROM "event_registrations" WHERE "id" = ${registrationId}::uuid FOR UPDATE`;
  const reg = await tx.eventRegistration.findUniqueOrThrow({ where: { id: registrationId }, include: { event: true, category: true } });
  if (reg.status !== "PENDING_PAYMENT") return [];
  await tx.eventRegistration.update({ where: { id: reg.id }, data: { status: "CONFIRMED" } });
  return enqueueTemplate("event.registration.confirmed", { name: reg.fullName, email: reg.email, phone: reg.phoneE164 }, regVars(reg.event, reg.category, reg), {
    idempotencyBase: `event.registration.confirmed:${reg.id}`,
    relatedType: "event_registration",
    relatedId: reg.id,
  }, tx);
}

export async function setAttendance(registrationId: string, attended: boolean, actorId: string) {
  const reg = await prisma.eventRegistration.findUnique({ where: { id: registrationId } });
  if (!reg) throw notFound("Registration");
  if (reg.status !== "CONFIRMED") throw conflict("not_confirmed", "Only confirmed registrations can be checked in.");
  await prisma.eventRegistration.update({ where: { id: reg.id }, data: { attendedAt: attended ? new Date() : null } });
  await audit({ actorId, action: attended ? "event_registration.checked_in" : "event_registration.check_in_undone", entityType: "event_registration", entityId: reg.id });
}

// ───────────────────────────── Admin: event management ─────────────────────────────

export async function setEventStatus(eventId: string, status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED", actorId: string, reason?: string) {
  const ev = await prisma.event.findUnique({ where: { id: eventId }, include: { categories: true } });
  if (!ev) throw notFound("Event");
  if (ev.status === "CANCELLED" && status !== "CANCELLED") throw conflict("event_cancelled", "A cancelled event cannot be re-opened. Create a new event instead.");
  if (status === "PUBLISHED" && ev.categories.length === 0 && !ev.volunteersEnabled) {
    throw conflict("no_categories", "Add at least one distance/category before publishing.");
  }
  const ids = await prisma.$transaction(async (tx) => {
    await tx.event.update({ where: { id: ev.id }, data: { status, cancelledReason: status === "CANCELLED" ? (reason ?? null) : ev.cancelledReason, registrationEnabled: status === "CANCELLED" ? false : ev.registrationEnabled } });
    await audit({ actorId, action: `event.${status.toLowerCase()}`, entityType: "event", entityId: ev.id, metadata: { reason } }, tx);
    if (status !== "CANCELLED") return [];
    // Operational notice to everyone with a live registration.
    const regs = await tx.eventRegistration.findMany({ where: { eventId: ev.id, status: { not: "CANCELLED" } }, include: { category: true } });
    const out: string[] = [];
    for (const r of regs) {
      out.push(
        ...(await enqueueTemplate("event.cancelled", { name: r.fullName, email: r.email, phone: r.phoneE164 }, regVars(ev, r.category, r, { reason: reason ?? "" }), {
          idempotencyBase: `event.cancelled:${ev.id}:${r.id}`,
          relatedType: "event",
          relatedId: ev.id,
        }, tx)),
      );
    }
    for (const r of regs) await cancelOpenPayments(tx, { eventRegistrationId: r.id }, "Event cancelled");
    return out;
  });
  kick(ids);
}

export async function upsertCategory(
  eventId: string,
  data: { id?: string; name: string; distanceKm?: string | null; description?: string | null; feeMinor: number; capacity: number | null; minAge?: number | null; maxAge?: number | null; startTime?: string | null; isActive: boolean; sortOrder: number },
  actorId: string,
) {
  const payload: Prisma.EventCategoryUncheckedCreateInput = {
    eventId,
    name: data.name,
    distanceKm: data.distanceKm || null,
    description: data.description || null,
    feeMinor: data.feeMinor,
    capacity: data.capacity,
    minAge: data.minAge ?? null,
    maxAge: data.maxAge ?? null,
    startTime: data.startTime || null,
    isActive: data.isActive,
    sortOrder: data.sortOrder,
  };
  try {
    const cat = data.id
      ? await prisma.eventCategory.update({ where: { id: data.id, eventId }, data: payload })
      : await prisma.eventCategory.create({ data: payload });
    await audit({ actorId, action: data.id ? "event_category.updated" : "event_category.created", entityType: "event", entityId: eventId, metadata: { categoryId: cat.id, feeMinor: data.feeMinor, capacity: data.capacity } });
    return cat;
  } catch (e) {
    if ((e as Error).message.includes("event_categories_capacity_bounds")) throw conflict("capacity_below_registered", "Capacity cannot be lower than the number of current registrations.");
    if (isUniqueViolation(e)) throw conflict("duplicate_category", "A category with this name already exists for this event.");
    throw e;
  }
}

export async function listPublicEvents(filters: { q?: string; type?: string; when?: "upcoming" | "past"; city?: string }) {
  const now = new Date();
  const where: Prisma.EventWhereInput = {
    status: { in: ["PUBLISHED", "COMPLETED", "CANCELLED"] },
    ...(filters.when === "past" ? { startsAt: { lt: now } } : { startsAt: { gte: now } }),
    ...(filters.type ? { type: filters.type as Event["type"] } : {}),
    ...(filters.city ? { city: { contains: filters.city, mode: "insensitive" } } : {}),
    ...(filters.q
      ? { OR: [{ title: { contains: filters.q, mode: "insensitive" } }, { summary: { contains: filters.q, mode: "insensitive" } }, { venueName: { contains: filters.q, mode: "insensitive" } }] }
      : {}),
  };
  return prisma.event.findMany({
    where,
    orderBy: { startsAt: filters.when === "past" ? "desc" : "asc" },
    include: { categories: { where: { isActive: true }, orderBy: { sortOrder: "asc" } }, cover: true },
    take: 60,
  });
}
