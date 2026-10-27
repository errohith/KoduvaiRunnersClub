import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { cancelRegistration, registerForEvent } from "@/server/services/events";
import { makeEvent, registrationInput, resetData } from "./helpers";

beforeEach(resetData);

describe("event registration", () => {
  it("never overbooks under concurrent registrations", async () => {
    const ev = await makeEvent({ categoryCapacity: 5 });
    const cat = ev.categories[0];
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => registerForEvent(registrationInput(ev.id, cat.id), null)));
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(5);
    expect(failed.every((f) => f.reason.code === "sold_out")).toBe(true);
    const fresh = await prisma.eventCategory.findUniqueOrThrow({ where: { id: cat.id } });
    expect(fresh.registeredCount).toBe(5);
    expect(await prisma.eventRegistration.count({ where: { eventId: ev.id, holdsSlot: true } })).toBe(5);
  });

  it("enforces the overall event capacity across categories", async () => {
    const ev = await makeEvent({ capacity: 3 });
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => registerForEvent(registrationInput(ev.id, ev.categories[0].id), null)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: ev.id } })).registeredCount).toBe(3);
  });

  it("waitlists when full and promotes the earliest waitlisted runner on cancellation", async () => {
    const ev = await makeEvent({ categoryCapacity: 2, waitlist: true });
    const cat = ev.categories[0];
    const a = await registerForEvent(registrationInput(ev.id, cat.id), null);
    await registerForEvent(registrationInput(ev.id, cat.id), null);
    const w1 = await registerForEvent(registrationInput(ev.id, cat.id), null);
    const w2 = await registerForEvent(registrationInput(ev.id, cat.id), null);
    expect([a.status, w1.status, w2.status]).toEqual(["CONFIRMED", "WAITLISTED", "WAITLISTED"]);

    const regA = await prisma.eventRegistration.findUniqueOrThrow({ where: { registrationNo: a.registrationNo } });
    await cancelRegistration(regA.id, "Injured", null);
    const promoted = await prisma.eventRegistration.findUniqueOrThrow({ where: { registrationNo: w1.registrationNo } });
    expect(promoted).toMatchObject({ status: "CONFIRMED", holdsSlot: true });
    expect((await prisma.eventRegistration.findUniqueOrThrow({ where: { registrationNo: w2.registrationNo } })).status).toBe("WAITLISTED");
    expect((await prisma.eventCategory.findUniqueOrThrow({ where: { id: cat.id } })).registeredCount).toBe(2);
    expect(await prisma.notificationDelivery.count({ where: { templateKey: "event.registration.promoted", relatedId: promoted.id } })).toBeGreaterThan(0);
  });

  it("prevents duplicate registrations and respects deadlines", async () => {
    const ev = await makeEvent();
    const input = registrationInput(ev.id, ev.categories[0].id);
    await registerForEvent(input, null);
    await expect(registerForEvent({ ...input, phone: "+919000011111" }, null)).rejects.toMatchObject({ code: "duplicate_registration" });
    expect((await prisma.event.findUniqueOrThrow({ where: { id: ev.id } })).registeredCount).toBe(1);

    const closed = await makeEvent({ closesAt: new Date(Date.now() - 60_000) });
    await expect(registerForEvent(registrationInput(closed.id, closed.categories[0].id), null)).rejects.toMatchObject({ code: "registration_closed" });
  });

  it("paid registrations hold a slot as PENDING_PAYMENT with a separate event payment record", async () => {
    const ev = await makeEvent({ feeMinor: 60000, categoryCapacity: 10 });
    const r = await registerForEvent(registrationInput(ev.id, ev.categories[0].id), null);
    expect(r.status).toBe("PENDING_PAYMENT");
    const reg = await prisma.eventRegistration.findUniqueOrThrow({ where: { registrationNo: r.registrationNo }, include: { payments: true } });
    expect(reg.holdsSlot).toBe(true);
    expect(reg.payments[0]).toMatchObject({ purpose: "EVENT_REGISTRATION", status: "PENDING", amountMinor: 60000, membershipApplicationId: null });
  });

  it("the database refuses to exceed capacity even if application checks are bypassed", async () => {
    const ev = await makeEvent({ categoryCapacity: 1 });
    await expect(prisma.eventCategory.update({ where: { id: ev.categories[0].id }, data: { registeredCount: 2 } })).rejects.toThrow(/event_categories_capacity_bounds/);
  });
});
