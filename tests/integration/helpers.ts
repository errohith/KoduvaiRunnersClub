import { prisma } from "@/lib/db";
import type { MembershipApplicationInput, EventRegistrationInput } from "@/validation/schemas";
import { membershipApplicationSchema, eventRegistrationSchema } from "@/validation/schemas";

/** Wipe transactional data; keep seeded reference data (roles, plans, templates, settings, pages). */
export async function resetData() {
  await prisma.$executeRawUnsafe(`TRUNCATE
    "notification_deliveries", "notification_campaigns", "consent_records", "payment_webhook_events", "refunds", "payments",
    "event_custom_field_responses", "event_registrations", "event_custom_fields", "event_categories", "events",
    "membership_status_history", "memberships", "membership_applications", "contact_messages", "audit_logs",
    "sessions", "user_roles", "users", "rate_limit_buckets", "reference_counters", "website_settings" CASCADE`);
  await prisma.membershipPlan.updateMany({ data: { isActive: true, requiresApproval: null } });
  await prisma.$executeRawUnsafe(`UPDATE "membership_plans" SET "requires_approval" = true WHERE "code" = 'HONORARY'`);
}

let seq = 0;
export async function plan(code: string) {
  return prisma.membershipPlan.findUniqueOrThrow({ where: { code } });
}

export function applicationInput(planId: string, over: Partial<Record<keyof MembershipApplicationInput, unknown>> = {}): MembershipApplicationInput {
  seq++;
  return membershipApplicationSchema.parse({
    planId,
    fullName: `Runner ${seq}`,
    email: `runner${seq}@example.com`,
    phone: `+9198765${String(10000 + seq).slice(-5)}`,
    city: "Koduvai",
    experienceLevel: "Walker",
    emergencyName: "Kin",
    emergencyPhone: "+919123456789",
    acceptTerms: true,
    acceptPrivacy: true,
    acceptDeclaration: true,
    ...over,
  });
}

export async function makeEvent(opts: { capacity?: number | null; categoryCapacity?: number | null; feeMinor?: number; waitlist?: boolean; closesAt?: Date } = {}) {
  seq++;
  return prisma.event.create({
    data: {
      slug: `test-event-${seq}-${Date.now()}`,
      title: `Test Event ${seq}`,
      summary: "Test",
      description: "Test",
      type: "MARATHON",
      status: "PUBLISHED",
      startsAt: new Date(Date.now() + 30 * 86400_000),
      venueName: "Ground",
      city: "Koduvai",
      registrationEnabled: true,
      registrationClosesAt: opts.closesAt,
      capacity: opts.capacity ?? null,
      waitlistEnabled: opts.waitlist ?? false,
      categories: { create: [{ name: "10K", feeMinor: opts.feeMinor ?? 0, capacity: opts.categoryCapacity ?? null }] },
    },
    include: { categories: true },
  });
}

export function registrationInput(eventId: string, categoryId: string, over: Partial<Record<keyof EventRegistrationInput, unknown>> = {}): EventRegistrationInput {
  seq++;
  return eventRegistrationSchema.parse({
    eventId,
    categoryId,
    fullName: `Racer ${seq}`,
    email: `racer${seq}@example.com`,
    phone: `+9190000${String(10000 + seq).slice(-5)}`,
    emergencyName: "Kin",
    emergencyPhone: "+919123456789",
    acceptTerms: true,
    ...over,
  });
}
