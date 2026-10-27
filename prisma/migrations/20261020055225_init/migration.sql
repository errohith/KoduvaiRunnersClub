-- CreateEnum
CREATE TYPE "NavLocation" AS ENUM ('HEADER', 'FOOTER');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'ACTIVE', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CLUB_RUN', 'MARATHON', 'TRAINING', 'SOCIAL', 'VOLUNTEER', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('CONFIRMED', 'PENDING_PAYMENT', 'WAITLISTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParticipantType" AS ENUM ('PARTICIPANT', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('MEMBERSHIP', 'EVENT_REGISTRATION');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'INITIATED', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "MessageCategory" AS ENUM ('OPERATIONAL', 'PROMOTIONAL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsentChannel" AS ENUM ('EMAIL_MARKETING', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'READ', 'ARCHIVED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "window_start" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "website_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "website_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "website_pages" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meta_description" TEXT,
    "body" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "website_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_sections" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "body" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "image_id" UUID,
    "cta_label" TEXT,
    "cta_href" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "content_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "navigation_links" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "location" "NavLocation" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "navigation_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "alt_text" TEXT NOT NULL DEFAULT '',
    "caption" TEXT,
    "album_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_albums" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taken_on" DATE,
    "cover_id" UUID,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gallery_albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_posts" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Announcement',
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ,
    "cover_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "news_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_members" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "bio" TEXT,
    "photo_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "committee_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" UUID NOT NULL,
    "quote" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "context" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_plans" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fee_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eligibility" TEXT,
    "requires_student_verification" BOOLEAN NOT NULL DEFAULT false,
    "requires_approval" BOOLEAN,
    "duration_months" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_applications" (
    "id" UUID NOT NULL,
    "reference_no" TEXT NOT NULL,
    "plan_id" UUID NOT NULL,
    "fee_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "approval_required" BOOLEAN NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "date_of_birth" DATE,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "experience_level" TEXT NOT NULL,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emergency_name" TEXT,
    "emergency_phone" TEXT,
    "student_institution" TEXT,
    "student_id_number" TEXT,
    "referral_source" TEXT,
    "photo_key" TEXT,
    "terms_accepted_at" TIMESTAMPTZ NOT NULL,
    "privacy_accepted_at" TIMESTAMPTZ NOT NULL,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "decision_note" TEXT,
    "submitted_ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "membership_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_status_history" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "from_status" "ApplicationStatus",
    "to_status" "ApplicationStatus" NOT NULL,
    "changed_by_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "membership_no" TEXT NOT NULL,
    "application_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "starts_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "EventType" NOT NULL DEFAULT 'CLUB_RUN',
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ,
    "venue_name" TEXT NOT NULL,
    "venue_address" TEXT,
    "city" TEXT NOT NULL,
    "map_url" TEXT,
    "route_description" TEXT,
    "route_map_url" TEXT,
    "eligibility" TEXT,
    "terms" TEXT,
    "waiver_text" TEXT,
    "medical_declaration_text" TEXT,
    "cancellation_policy" TEXT,
    "schedule" JSONB NOT NULL DEFAULT '[]',
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "registration_enabled" BOOLEAN NOT NULL DEFAULT false,
    "registration_opens_at" TIMESTAMPTZ,
    "registration_closes_at" TIMESTAMPTZ,
    "capacity" INTEGER,
    "registered_count" INTEGER NOT NULL DEFAULT 0,
    "waitlist_enabled" BOOLEAN NOT NULL DEFAULT false,
    "volunteers_enabled" BOOLEAN NOT NULL DEFAULT false,
    "collect_date_of_birth" BOOLEAN NOT NULL DEFAULT false,
    "collect_gender" BOOLEAN NOT NULL DEFAULT false,
    "collect_tshirt_size" BOOLEAN NOT NULL DEFAULT false,
    "tshirt_sizes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cover_id" UUID,
    "cancelled_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_categories" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "distance_km" DECIMAL(6,3),
    "description" TEXT,
    "fee_minor" INTEGER NOT NULL,
    "capacity" INTEGER,
    "registered_count" INTEGER NOT NULL DEFAULT 0,
    "min_age" INTEGER,
    "max_age" INTEGER,
    "start_time" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" UUID NOT NULL,
    "registration_no" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "category_id" UUID,
    "participant_type" "ParticipantType" NOT NULL DEFAULT 'PARTICIPANT',
    "status" "RegistrationStatus" NOT NULL,
    "holds_slot" BOOLEAN NOT NULL DEFAULT false,
    "fee_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "date_of_birth" DATE,
    "gender" TEXT,
    "emergency_name" TEXT NOT NULL,
    "emergency_phone" TEXT NOT NULL,
    "medical_declared_at" TIMESTAMPTZ,
    "medical_notes" TEXT,
    "tshirt_size" TEXT,
    "accessibility_needs" TEXT,
    "terms_accepted_at" TIMESTAMPTZ NOT NULL,
    "waiver_accepted_at" TIMESTAMPTZ,
    "waitlisted_at" TIMESTAMPTZ,
    "attended_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "cancel_reason" TEXT,
    "submitted_ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_custom_fields" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL DEFAULT 'TEXT',
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "help_text" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_custom_field_responses" (
    "id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "event_custom_field_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "membership_application_id" UUID,
    "event_registration_id" UUID,
    "amount_minor" INTEGER NOT NULL,
    "refunded_minor" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "provider_checkout_id" TEXT,
    "provider_payment_id" TEXT,
    "checkout_url" TEXT,
    "failure_reason" TEXT,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ,
    "processing_error" TEXT,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "provider_refund_id" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "MessageCategory" NOT NULL DEFAULT 'OPERATIONAL',
    "subject" TEXT,
    "body_html" TEXT,
    "body_text" TEXT NOT NULL,
    "whatsapp_template_name" TEXT,
    "whatsapp_language" TEXT,
    "whatsapp_params" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_campaigns" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "body_text" TEXT NOT NULL,
    "body_html" TEXT,
    "whatsapp_template_name" TEXT,
    "whatsapp_language" TEXT,
    "channels" "Channel"[],
    "category" "MessageCategory" NOT NULL DEFAULT 'PROMOTIONAL',
    "audience" JSONB NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMPTZ,
    "dispatched_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "campaign_id" UUID,
    "template_key" TEXT,
    "channel" "Channel" NOT NULL,
    "category" "MessageCategory" NOT NULL,
    "recipient_name" TEXT,
    "recipient_email" TEXT,
    "recipient_phone" TEXT,
    "subject" TEXT,
    "body_text" TEXT NOT NULL,
    "body_html" TEXT,
    "whatsapp_template" JSONB,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "provider_message_id" TEXT,
    "related_type" TEXT,
    "related_id" TEXT,
    "sent_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "phone_e164" TEXT,
    "channel" "ConsentChannel" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "source_ref" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_counters" (
    "scope" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "reference_counters_pkey" PRIMARY KEY ("scope")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "website_pages_slug_key" ON "website_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "content_sections_page_id_key_key" ON "content_sections"("page_id", "key");

-- CreateIndex
CREATE INDEX "navigation_links_location_sort_order_idx" ON "navigation_links"("location", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "media_assets_album_id_sort_order_idx" ON "media_assets"("album_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "gallery_albums_slug_key" ON "gallery_albums"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "news_posts_slug_key" ON "news_posts"("slug");

-- CreateIndex
CREATE INDEX "news_posts_status_published_at_idx" ON "news_posts"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "membership_plans_code_key" ON "membership_plans"("code");

-- CreateIndex
CREATE INDEX "membership_plans_is_active_sort_order_idx" ON "membership_plans"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "membership_applications_reference_no_key" ON "membership_applications"("reference_no");

-- CreateIndex
CREATE INDEX "membership_applications_status_created_at_idx" ON "membership_applications"("status", "created_at");

-- CreateIndex
CREATE INDEX "membership_applications_plan_id_idx" ON "membership_applications"("plan_id");

-- CreateIndex
CREATE INDEX "membership_applications_email_idx" ON "membership_applications"("email");

-- CreateIndex
CREATE INDEX "membership_applications_phone_e164_idx" ON "membership_applications"("phone_e164");

-- CreateIndex
CREATE INDEX "membership_status_history_application_id_created_at_idx" ON "membership_status_history"("application_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_membership_no_key" ON "memberships"("membership_no");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_application_id_key" ON "memberships"("application_id");

-- CreateIndex
CREATE INDEX "memberships_status_plan_id_idx" ON "memberships"("status", "plan_id");

-- CreateIndex
CREATE INDEX "memberships_email_idx" ON "memberships"("email");

-- CreateIndex
CREATE INDEX "memberships_expires_at_idx" ON "memberships"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_status_starts_at_idx" ON "events"("status", "starts_at");

-- CreateIndex
CREATE INDEX "events_type_starts_at_idx" ON "events"("type", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_categories_event_id_name_key" ON "event_categories"("event_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_registration_no_key" ON "event_registrations"("registration_no");

-- CreateIndex
CREATE INDEX "event_registrations_event_id_status_idx" ON "event_registrations"("event_id", "status");

-- CreateIndex
CREATE INDEX "event_registrations_category_id_status_idx" ON "event_registrations"("category_id", "status");

-- CreateIndex
CREATE INDEX "event_registrations_email_idx" ON "event_registrations"("email");

-- CreateIndex
CREATE INDEX "event_registrations_event_id_waitlisted_at_idx" ON "event_registrations"("event_id", "waitlisted_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_custom_fields_event_id_key_key" ON "event_custom_fields"("event_id", "key");

-- CreateIndex
CREATE INDEX "event_custom_field_responses_field_id_idx" ON "event_custom_field_responses"("field_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_custom_field_responses_registration_id_field_id_key" ON "event_custom_field_responses"("registration_id", "field_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "payments_membership_application_id_idx" ON "payments"("membership_application_id");

-- CreateIndex
CREATE INDEX "payments_event_registration_id_idx" ON "payments"("event_registration_id");

-- CreateIndex
CREATE INDEX "payments_provider_provider_checkout_id_idx" ON "payments"("provider", "provider_checkout_id");

-- CreateIndex
CREATE INDEX "payments_provider_provider_payment_id_idx" ON "payments"("provider", "provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_provider_event_id_key" ON "payment_webhook_events"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_key_channel_key" ON "notification_templates"("key", "channel");

-- CreateIndex
CREATE INDEX "notification_campaigns_status_scheduled_at_idx" ON "notification_campaigns"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_idempotency_key_key" ON "notification_deliveries"("idempotency_key");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_next_attempt_at_idx" ON "notification_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_campaign_id_status_idx" ON "notification_deliveries"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "notification_deliveries_provider_message_id_idx" ON "notification_deliveries"("provider_message_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_related_type_related_id_idx" ON "notification_deliveries"("related_type", "related_id");

-- CreateIndex
CREATE INDEX "consent_records_email_channel_created_at_idx" ON "consent_records"("email", "channel", "created_at");

-- CreateIndex
CREATE INDEX "consent_records_phone_e164_channel_created_at_idx" ON "consent_records"("phone_e164", "channel", "created_at");

-- CreateIndex
CREATE INDEX "contact_messages_status_created_at_idx" ON "contact_messages"("status", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_sections" ADD CONSTRAINT "content_sections_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "website_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_sections" ADD CONSTRAINT "content_sections_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "gallery_albums"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_albums" ADD CONSTRAINT "gallery_albums_cover_id_fkey" FOREIGN KEY ("cover_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_cover_id_fkey" FOREIGN KEY ("cover_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_status_history" ADD CONSTRAINT "membership_status_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_status_history" ADD CONSTRAINT "membership_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_cover_id_fkey" FOREIGN KEY ("cover_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "event_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_custom_fields" ADD CONSTRAINT "event_custom_fields_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_custom_field_responses" ADD CONSTRAINT "event_custom_field_responses_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "event_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_custom_field_responses" ADD CONSTRAINT "event_custom_field_responses_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "event_custom_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_membership_application_id_fkey" FOREIGN KEY ("membership_application_id") REFERENCES "membership_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_event_registration_id_fkey" FOREIGN KEY ("event_registration_id") REFERENCES "event_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "notification_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
