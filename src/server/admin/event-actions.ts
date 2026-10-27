"use server";
import type { CustomFieldType, EventType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/slug";
import { parseMajorToMinor } from "@/lib/money";
import { parseLocalDateTime } from "@/lib/time";
import { badRequest, conflict, isUniqueViolation } from "@/lib/errors";
import { safeUrl } from "@/lib/url";
import { formatDateTime } from "@/lib/time";
import { config } from "@/config/env";
import { cancelRegistration, promoteNow, setAttendance, setEventStatus, upsertCategory } from "@/server/services/events";
import { enqueueTemplate, kick } from "@/server/services/notifications";
import { deleteEvent, deleteEventRegistration } from "@/server/services/event-deletion";
import { bool, lines, optInt, optStr, runAdminAction, str } from "./run";

const TYPES: EventType[] = ["CLUB_RUN", "MARATHON", "TRAINING", "SOCIAL", "VOLUNTEER", "OTHER"];

async function eventData(fd: FormData) {
  const title = str(fd, "title");
  if (title.length < 3) throw badRequest("Title is required.");
  const type = str(fd, "type") as EventType;
  if (!TYPES.includes(type)) throw badRequest("Choose an event type.");
  const startsAt = str(fd, "startsAt") ? parseLocalDateTime(str(fd, "startsAt")) : null;
  if (!startsAt) throw badRequest("Start date and time are required.");
  const dt = (k: string) => (str(fd, k) ? parseLocalDateTime(str(fd, k)) : null);
  const endsAt = dt("endsAt");
  if (endsAt && endsAt < startsAt) throw badRequest("End time must be after the start time.");
  const opens = dt("registrationOpensAt");
  const closes = dt("registrationClosesAt");
  if (opens && closes && closes < opens) throw badRequest("Registration must close after it opens.");
  const capacity = optInt(fd, "capacity");
  if (capacity !== null && capacity < 0) throw badRequest("Capacity cannot be negative.");
  const schedule = lines(fd, "schedule").map((l) => {
    const [time, ...rest] = l.split("|");
    return { time: time.trim(), label: rest.join("|").trim() };
  });
  return {
    title,
    slug: slugify(str(fd, "slug") || title),
    summary: str(fd, "summary"),
    description: str(fd, "description"),
    type,
    startsAt,
    endsAt,
    venueName: str(fd, "venueName"),
    venueAddress: optStr(fd, "venueAddress"),
    city: str(fd, "city"),
    mapUrl: safeUrl(optStr(fd, "mapUrl")),
    routeDescription: optStr(fd, "routeDescription"),
    routeMapUrl: safeUrl(optStr(fd, "routeMapUrl")),
    eligibility: optStr(fd, "eligibility"),
    terms: optStr(fd, "terms"),
    waiverText: optStr(fd, "waiverText"),
    medicalDeclarationText: optStr(fd, "medicalDeclarationText"),
    cancellationPolicy: optStr(fd, "cancellationPolicy"),
    schedule,
    currency: (str(fd, "currency") || "INR").toUpperCase(),
    registrationEnabled: bool(fd, "registrationEnabled"),
    registrationOpensAt: opens,
    registrationClosesAt: closes,
    capacity,
    waitlistEnabled: bool(fd, "waitlistEnabled"),
    volunteersEnabled: bool(fd, "volunteersEnabled"),
    collectDateOfBirth: bool(fd, "collectDateOfBirth"),
    collectGender: bool(fd, "collectGender"),
    collectTshirtSize: bool(fd, "collectTshirtSize"),
    tshirtSizes: str(fd, "tshirtSizes").split(",").map((s) => s.trim()).filter(Boolean),
    coverId: optStr(fd, "coverId"),
  };
}

export async function saveEventAction(fd: FormData) {
  const id = str(fd, "id");
  return runAdminAction("events.manage", id ? `/admin/events/${id}` : "/admin/events/new", async ({ user, ip }) => {
    const data = await eventData(fd);
    if (!data.summary || !data.venueName || !data.city) throw badRequest("Summary, venue and city are required.");
    try {
      if (id) {
        await prisma.event.update({ where: { id }, data });
        await audit({ actorId: user.id, action: "event.updated", entityType: "event", entityId: id, ip });
        return "Event saved.";
      }
      const ev = await prisma.event.create({ data: { ...data, status: "DRAFT" } });
      await audit({ actorId: user.id, action: "event.created", entityType: "event", entityId: ev.id, ip });
      return { message: "Event created as a draft. Add distances/categories, then publish.", redirectTo: `/admin/events/${ev.id}` };
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict("duplicate_slug", "Another event already uses this URL slug.");
      if ((e as Error).message.includes("events_capacity_bounds")) throw conflict("capacity_below_registered", "Capacity cannot be lower than current registrations.");
      throw e;
    }
  });
}

export async function eventStatusAction(fd: FormData) {
  const id = str(fd, "id");
  return runAdminAction("events.manage", `/admin/events/${id}`, async ({ user }) => {
    const status = str(fd, "status") as "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";
    if (!["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"].includes(status)) throw badRequest("Invalid status");
    if (status === "CANCELLED" && !str(fd, "reason")) throw badRequest("Give a reason — it is sent to registered participants.");
    await setEventStatus(id, status, user.id, optStr(fd, "reason") ?? undefined);
    return { DRAFT: "Event unpublished.", PUBLISHED: "Event published.", CANCELLED: "Event cancelled and participants notified.", COMPLETED: "Event marked completed." }[status];
  });
}

export async function saveCategoryAction(fd: FormData) {
  const eventId = str(fd, "eventId");
  return runAdminAction("events.manage", `/admin/events/${eventId}`, async ({ user }) => {
    const ev = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    const name = str(fd, "name");
    if (!name) throw badRequest("Category name is required.");
    const distance = str(fd, "distanceKm");
    if (distance && !/^\d+(\.\d{1,3})?$/.test(distance)) throw badRequest("Distance must be a number of km.");
    const capacity = optInt(fd, "capacity");
    if (capacity !== null && capacity < 0) throw badRequest("Capacity cannot be negative.");
    await upsertCategory(eventId, {
      id: optStr(fd, "id") ?? undefined,
      name,
      distanceKm: distance || null,
      description: optStr(fd, "description"),
      feeMinor: parseMajorToMinor(str(fd, "fee") || "0", ev.currency),
      capacity,
      minAge: optInt(fd, "minAge"),
      maxAge: optInt(fd, "maxAge"),
      startTime: optStr(fd, "startTime"),
      isActive: bool(fd, "isActive"),
      sortOrder: optInt(fd, "sortOrder") ?? 0,
    }, user.id);
    return "Category saved.";
  });
}

export async function deleteCategoryAction(fd: FormData) {
  const eventId = str(fd, "eventId");
  return runAdminAction("events.manage", `/admin/events/${eventId}`, async ({ user }) => {
    const id = str(fd, "id");
    const used = await prisma.eventRegistration.count({ where: { categoryId: id } });
    if (used) throw conflict("category_in_use", "This category has registrations — deactivate it instead.");
    await prisma.eventCategory.delete({ where: { id, eventId } });
    await audit({ actorId: user.id, action: "event_category.deleted", entityType: "event", entityId: eventId, metadata: { categoryId: id } });
    return "Category deleted.";
  });
}

export async function addCustomFieldAction(fd: FormData) {
  const eventId = str(fd, "eventId");
  return runAdminAction("events.manage", `/admin/events/${eventId}`, async ({ user }) => {
    const label = str(fd, "label");
    if (!label) throw badRequest("Field label is required.");
    const type = (str(fd, "type") || "TEXT") as CustomFieldType;
    const options = str(fd, "options").split(",").map((s) => s.trim()).filter(Boolean);
    if (type === "SELECT" && options.length < 2) throw badRequest("Select fields need at least two comma-separated options.");
    try {
      await prisma.eventCustomField.create({ data: { eventId, label, key: slugify(str(fd, "key") || label).replace(/-/g, "_"), type, options, required: bool(fd, "required"), helpText: optStr(fd, "helpText"), sortOrder: optInt(fd, "sortOrder") ?? 0 } });
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict("duplicate_field", "A field with this key already exists.");
      throw e;
    }
    await audit({ actorId: user.id, action: "event_custom_field.created", entityType: "event", entityId: eventId, metadata: { label } });
    return "Custom field added.";
  });
}

export async function deleteCustomFieldAction(fd: FormData) {
  const eventId = str(fd, "eventId");
  return runAdminAction("events.manage", `/admin/events/${eventId}`, async ({ user }) => {
    await prisma.eventCustomField.delete({ where: { id: str(fd, "id"), eventId } });
    await audit({ actorId: user.id, action: "event_custom_field.deleted", entityType: "event", entityId: eventId });
    return "Custom field removed (existing answers were deleted with it).";
  });
}

export async function notifyEventUpdateAction(fd: FormData) {
  const eventId = str(fd, "eventId");
  return runAdminAction("events.manage", `/admin/events/${eventId}`, async ({ user }) => {
    const message = str(fd, "message");
    if (message.length < 5) throw badRequest("Write the update message.");
    const ev = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    const regs = await prisma.eventRegistration.findMany({ where: { eventId, status: { in: ["CONFIRMED", "PENDING_PAYMENT", "WAITLISTED"] } } });
    const stamp = Date.now();
    const ids: string[] = [];
    for (const r of regs) {
      ids.push(...(await enqueueTemplate("event.updated", { name: r.fullName, email: r.email, phone: r.phoneE164 }, { eventTitle: ev.title, eventDate: formatDateTime(ev.startsAt), message, eventUrl: `${config.APP_URL}/events/${ev.slug}` }, { idempotencyBase: `event.updated:${eventId}:${stamp}:${r.id}`, relatedType: "event", relatedId: eventId })));
    }
    kick(ids);
    await audit({ actorId: user.id, action: "event.update_notified", entityType: "event", entityId: eventId, metadata: { recipients: regs.length } });
    return `Update queued for ${regs.length} registrants (${ids.length} messages).`;
  });
}

export async function cancelRegistrationAction(fd: FormData) {
  return runAdminAction("registrations.manage", str(fd, "back"), async ({ user, ip }) => {
    await cancelRegistration(str(fd, "id"), str(fd, "reason") || "Cancelled by the club", user.id, ip);
    return "Registration cancelled. Its place was released and the waitlist promoted if enabled.";
  });
}

export async function attendanceAction(fd: FormData) {
  return runAdminAction("registrations.manage", str(fd, "back"), async ({ user }) => {
    await setAttendance(str(fd, "id"), str(fd, "attended") === "1", user.id);
    return str(fd, "attended") === "1" ? "Checked in." : "Check-in undone.";
  });
}

export async function promoteWaitlistAction(fd: FormData) {
  const eventId = str(fd, "eventId");
  return runAdminAction("registrations.manage", `/admin/events/${eventId}/registrations`, async ({ user }) => {
    const n = await promoteNow(eventId, user.id);
    return n ? "Waitlisted runners promoted and notified." : "No places available, or nobody waiting.";
  });
}

export async function deleteEventAction(fd: FormData) {
  const id = str(fd, "id");
  return runAdminAction("events.delete", `/admin/events/${id}`, async ({ user, ip }) => {
    const r = await deleteEvent(id, str(fd, "confirm"), user.id, ip);
    return { message: `Event "${r.slug}" deleted${r.registrationsDeleted ? ` with ${r.registrationsDeleted} registration(s)` : ""}.`, redirectTo: "/admin/events" };
  });
}

export async function deleteRegistrationAction(fd: FormData) {
  return runAdminAction("events.delete", str(fd, "back"), async ({ user, ip }) => {
    const r = await deleteEventRegistration(str(fd, "id"), str(fd, "confirm"), user.id, ip);
    return r.mode === "delete"
      ? `Registration ${r.registrationNo} permanently deleted; its place was released.`
      : `Registration ${r.registrationNo} anonymised; the payment record was kept for accounting.`;
  });
}
