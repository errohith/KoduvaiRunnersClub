import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { registerForEvent } from "@/server/services/events";
import { recordOfflinePayment } from "@/server/services/payments";
import { deleteEvent, deleteEventRegistration, previewEventDeletion } from "@/server/services/event-deletion";
import { ROLES } from "@/lib/auth/permissions";
import { makeEvent, registrationInput, resetData } from "./helpers";

beforeEach(resetData);
const admin = () => prisma.user.create({ data: { email: `sa${Date.now()}${Math.random()}@club.test`, name: "SA", passwordHash: "x" } });

describe("deleting event registrations", () => {
  it("only Super Admin holds events.delete", () => {
    for (const [key, role] of Object.entries(ROLES)) expect(role.permissions.includes("events.delete")).toBe(key === "SUPER_ADMIN");
  });

  it("hard-deletes an unpaid registration, releases its place and promotes the waitlist", async () => {
    const a = await admin();
    const ev = await makeEvent({ categoryCapacity: 1, waitlist: true });
    const cat = ev.categories[0];
    const first = await registerForEvent(registrationInput(ev.id, cat.id, { customFields: {} }), null);
    const waiting = await registerForEvent(registrationInput(ev.id, cat.id), null);
    expect(waiting.status).toBe("WAITLISTED");
    const reg = await prisma.eventRegistration.findUniqueOrThrow({ where: { registrationNo: first.registrationNo } });

    await expect(deleteEventRegistration(reg.id, "nope", a.id)).rejects.toMatchObject({ code: "bad_request" });
    const out = await deleteEventRegistration(reg.id, first.registrationNo, a.id);
    expect(out.mode).toBe("delete");
    expect(await prisma.eventRegistration.count({ where: { id: reg.id } })).toBe(0);
    expect(await prisma.notificationDelivery.count({ where: { relatedId: reg.id } })).toBe(0);
    expect((await prisma.eventRegistration.findUniqueOrThrow({ where: { registrationNo: waiting.registrationNo } })).status).toBe("CONFIRMED");
    expect((await prisma.eventCategory.findUniqueOrThrow({ where: { id: cat.id } })).registeredCount).toBe(1);
  });

  it("anonymises a paid registration and keeps the payment", async () => {
    const a = await admin();
    const ev = await makeEvent({ feeMinor: 40000 });
    const r = await registerForEvent(registrationInput(ev.id, ev.categories[0].id), null);
    await recordOfflinePayment(r.paymentReference!, "Cash receipt 7", a.id);
    const reg = await prisma.eventRegistration.findUniqueOrThrow({ where: { registrationNo: r.registrationNo } });
    const out = await deleteEventRegistration(reg.id, r.registrationNo, a.id);
    expect(out.mode).toBe("anonymise");
    const after = await prisma.eventRegistration.findUniqueOrThrow({ where: { id: reg.id } });
    expect(after).toMatchObject({ fullName: "Deleted participant", status: "CANCELLED", holdsSlot: false, medicalNotes: null });
    expect(after.email).not.toContain("example.com");
    expect((await prisma.payment.findUniqueOrThrow({ where: { reference: r.paymentReference! } })).status).toBe("SUCCEEDED");
    expect((await prisma.event.findUniqueOrThrow({ where: { id: ev.id } })).registeredCount).toBe(0);
  });
});

describe("deleting events", () => {
  it("deletes an event with its unpaid registrations, after confirming the slug", async () => {
    const a = await admin();
    const ev = await makeEvent({ feeMinor: 20000 });
    await registerForEvent(registrationInput(ev.id, ev.categories[0].id), null); // pending payment
    await registerForEvent(registrationInput(ev.id, ev.categories[0].id), null);
    expect(await previewEventDeletion(ev.id)).toMatchObject({ allowed: true, registrations: 2 });
    await expect(deleteEvent(ev.id, "wrong-slug", a.id)).rejects.toMatchObject({ code: "bad_request" });
    await expect(deleteEvent(ev.id, ev.slug, a.id)).resolves.toMatchObject({ registrationsDeleted: 2 });
    expect(await prisma.event.count({ where: { id: ev.id } })).toBe(0);
    expect(await prisma.eventCategory.count({ where: { eventId: ev.id } })).toBe(0);
    expect(await prisma.eventRegistration.count({ where: { eventId: ev.id } })).toBe(0);
    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "event.deleted", entityId: ev.id } })).toBe(1);
  });

  it("refuses to delete an event that has received payments", async () => {
    const a = await admin();
    const ev = await makeEvent({ feeMinor: 20000 });
    const r = await registerForEvent(registrationInput(ev.id, ev.categories[0].id), null);
    await recordOfflinePayment(r.paymentReference!, "UPI 99", a.id);
    expect((await previewEventDeletion(ev.id)).allowed).toBe(false);
    await expect(deleteEvent(ev.id, ev.slug, a.id)).rejects.toMatchObject({ code: "event_has_payments" });
    expect(await prisma.event.count({ where: { id: ev.id } })).toBe(1);
  });
});
