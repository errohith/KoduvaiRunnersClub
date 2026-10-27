-- Constraints that Prisma's schema language cannot express.

-- Money is never negative.
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_fee_nonnegative" CHECK ("fee_minor" >= 0);
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_fee_nonnegative" CHECK ("fee_minor" >= 0);
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_fee_nonnegative" CHECK ("fee_minor" >= 0);
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_fee_nonnegative" CHECK ("fee_minor" >= 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount_minor" > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_refund_bounds" CHECK ("refunded_minor" >= 0 AND "refunded_minor" <= "amount_minor");
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_positive" CHECK ("amount_minor" > 0);

-- Capacity counters can never exceed configured capacity (last line of defence against overbooking).
ALTER TABLE "events" ADD CONSTRAINT "events_capacity_bounds"
  CHECK ("registered_count" >= 0 AND ("capacity" IS NULL OR ("capacity" >= 0 AND "registered_count" <= "capacity")));
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_capacity_bounds"
  CHECK ("registered_count" >= 0 AND ("capacity" IS NULL OR ("capacity" >= 0 AND "registered_count" <= "capacity")));

-- A payment belongs to exactly one business object, matching its purpose.
ALTER TABLE "payments" ADD CONSTRAINT "payments_single_target" CHECK (
  ("purpose" = 'MEMBERSHIP' AND "membership_application_id" IS NOT NULL AND "event_registration_id" IS NULL) OR
  ("purpose" = 'EVENT_REGISTRATION' AND "event_registration_id" IS NOT NULL AND "membership_application_id" IS NULL)
);

-- Emails are stored normalised.
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_email_lower" CHECK ("email" = lower("email"));
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_email_lower" CHECK ("email" = lower("email"));

-- Duplicate prevention: one open membership application per email and per phone.
CREATE UNIQUE INDEX "membership_applications_open_email_key" ON "membership_applications" ("email")
  WHERE "status" IN ('PENDING', 'APPROVED', 'ACTIVE');
CREATE UNIQUE INDEX "membership_applications_open_phone_key" ON "membership_applications" ("phone_e164")
  WHERE "status" IN ('PENDING', 'APPROVED', 'ACTIVE');

-- Duplicate prevention: one live registration per person per event.
CREATE UNIQUE INDEX "event_registrations_open_email_key" ON "event_registrations" ("event_id", "email")
  WHERE "status" <> 'CANCELLED';

-- At most one open (not failed/cancelled) payment per business object.
CREATE UNIQUE INDEX "payments_open_membership_key" ON "payments" ("membership_application_id")
  WHERE "membership_application_id" IS NOT NULL AND "status" IN ('PENDING', 'INITIATED', 'SUCCEEDED');
CREATE UNIQUE INDEX "payments_open_registration_key" ON "payments" ("event_registration_id")
  WHERE "event_registration_id" IS NOT NULL AND "status" IN ('PENDING', 'INITIATED', 'SUCCEEDED');
