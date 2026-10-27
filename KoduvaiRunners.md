# Master Project Prompt: Running Club Website and Management Platform

## 1. Project Objective

Act as a senior full-stack software architect, UI/UX designer, PostgreSQL database architect, security engineer, and DevOps engineer.

Design and implement a complete, production-ready Running Club Website and Management Platform.

Do not build only a static landing page or a frontend prototype. Implement the complete application with a working backend, PostgreSQL persistence, admin dashboard, configurable integrations, registration workflows, notification infrastructure, validation, testing, and documentation.

The application must be easy to maintain and allow authorized administrators to edit website content, membership plans, marathon events, registration settings, and communication templates without modifying source code.

Use sensible defaults where details are unspecified, document assumptions, and never invent real credentials or claim that external integrations work without verification.

## 2. Technology Stack

Use the following default architecture unless the existing repository requires a justified alternative:

- Frontend: Next.js with TypeScript and App Router.
- UI: Tailwind CSS and accessible, reusable components.
- Backend: Next.js server-side handlers or a clearly separated Node.js API layer.
- Database: PostgreSQL.
- ORM and migrations: Prisma.
- Validation: Zod or an equivalent TypeScript validation library.
- Authentication: Secure, server-side authentication with role-based authorization.
- Email: Provider-independent notification adapter.
- WhatsApp: Official WhatsApp Business Platform API or a compatible provider.
- Payments: Provider-independent payment adapter, initially disabled.
- Testing: Unit tests, API integration tests, and end-to-end tests.
- Deployment: Docker-compatible setup with documented environment configuration.

Use stable, mutually compatible package versions. Verify APIs against the current official documentation before implementation.

## 3. Website Design and Reference Analysis

Study the following reference websites before designing the application:

1. https://runclubhq.com/features
2. https://info.runsignup.com/use-cases/running-club-management-software/
3. https://www.happymilez.com/
4. https://www.trackie.com/

Analyze their publicly accessible pages for:

- Navigation and information architecture.
- Homepage layouts and calls to action.
- Membership pricing and joining workflows.
- Event discovery and marathon registration.
- Mobile responsiveness and accessibility.
- Admin features, communication, and reporting.

Create a concise design analysis identifying useful patterns, potential shortcomings, and opportunities for improvement.

Use these websites as inspiration, not as templates to copy. Do not copy copyrighted text, logos, source code, or branding.

Build an original, modern, premium-looking running club website.

## 4. UI/UX Requirements

The design must be:

- Modern, energetic, clean, professional, and community-focused.
- Mobile-first and fully responsive.
- Fast-loading, accessible, and SEO-friendly.
- Easy to navigate for runners of all experience levels.
- Consistent in typography, spacing, buttons, forms, colors, and layouts.

Use authentic running photography, event photography, tasteful animations, clear visual hierarchy, and strong calls to action.

Avoid excessive gradients, generic AI-generated imagery, unnecessary animations, and overcrowded layouts.

Use configurable branding, including the club name, logo, colors, contact details, social links, and footer information.

## 5. Public Website Pages

Implement the following pages:

- Home: compelling hero section, introduction, upcoming events, membership options, club highlights, testimonials, and join/register calls to action.
- About Us: club history, mission, vision, values, committee, and leadership.
- Membership: membership types, fees, benefits, eligibility, FAQs, and registration links.
- Join the Club: membership registration form and submission status.
- Events: searchable and filterable upcoming and past club events.
- Marathons: dedicated marathon details and registration.
- Event Details: date, venue, distances, route information, eligibility, fees, capacity, schedule, terms, and registration.
- News and Updates: announcements, articles, achievements, and club activities.
- Gallery: club runs, races, community activities, and event photographs.
- Contact Us: contact form, official contact information, social media links, and configurable location/map.
- Privacy Policy, Terms and Conditions, Refund Policy, and event waiver pages.
- Registration confirmation and payment status pages.

All editable content must come from the database or an appropriate content-management configuration. Do not hardcode page copy that administrators should be able to edit.

## 6. Membership Types and Pricing

Create these five initial membership plans:

| Membership Type | Fee (INR) |
|---|---:|
| Founding Member | 1000 |
| General Member | 500 |
| Student Member | 250 |
| Volunteer Member | 0 |
| Honorary Member | 0 |

Requirements:

- Store membership types, prices, descriptions, benefits, active status, and eligibility rules in PostgreSQL.
- Allow authorized administrators to create, edit, enable, disable, and reorder plans.
- Make the currency configurable, with INR as the initial currency.
- Make the membership fee configurable and treat the listed amounts as initial values, not permanent constants.
- Clearly distinguish paid and free memberships.
- Allow the club to configure whether memberships require administrator approval.
- Allow membership renewals and expiry settings to be configured, without assuming a renewal period.
- Do not automatically grant paid membership status before the required payment and approval conditions are satisfied.

## 7. Membership Registration Form

Create a professional, mobile-friendly membership registration form.

Suggested fields:

- Full name.
- Email address.
- Mobile number with country code.
- Date of birth, if required by club policy.
- Membership type.
- City and optional address.
- Running experience and interests.
- Emergency contact name and phone number, where justified.
- Student verification information for student membership, if required.
- Referral source, optional.
- Profile photograph, optional.
- Acceptance of privacy policy, membership terms, and required declarations.
- Separate consent for optional WhatsApp and marketing communications.

Requirements:

- Validate inputs on both client and server.
- Normalize phone numbers and validate email addresses.
- Prevent duplicate registrations using appropriate database constraints and checks.
- Generate a unique membership application/reference number.
- Save the registration in PostgreSQL.
- Support statuses such as Pending, Approved, Rejected, and Active, with clearly defined transition rules.
- Record approval history and timestamps.
- Show useful validation errors and a confirmation screen.
- Send a registration acknowledgement to the applicant.
- Notify designated club administrators of new applications.
- Provide configurable approval and rejection notifications.
- Allow authorized administrators to search, filter, review, approve, reject, and export membership applications.

## 8. Separate Marathon and Event Registration

Membership registration and marathon registration must be separate business workflows with separate database records and payment references.

Build an event-management module where administrators can:

- Create, edit, publish, unpublish, and cancel events.
- Configure event title, description, date, time, venue, distances, route, eligibility, and registration deadlines.
- Configure event fees, registration capacity, and participant limits.
- Configure separate prices for different distances or participant categories.
- Create free events and paid events.
- Enable or disable registrations.
- Define event-specific custom form fields.
- Configure event-specific terms, medical declarations, and liability waivers.
- Manage volunteers, participants, attendance, and registration statuses.
- Export participant lists and generate operational reports.

### Marathon registration form

Include, as applicable:

- Full name.
- Email.
- Mobile number with country code.
- Date of birth or age eligibility.
- Gender only where needed for legitimate event administration.
- Selected distance/category.
- Emergency contact.
- Relevant medical or safety declaration, with appropriate privacy controls.
- T-shirt size, if applicable.
- Optional accessibility requirements.
- Acceptance of event terms and waiver.
- Separate consent for optional communications.

Do not collect unnecessary sensitive medical information.

Generate a unique event registration number. Store the registration against the event and participant in PostgreSQL.

Support capacity limits, registration deadlines, duplicate-registration prevention, waitlists where enabled, and cancellation policies.

Use database transactions and appropriate locking or atomic updates to prevent overbooking when multiple runners register simultaneously.

Send participant confirmations and authorized event notifications.

## 9. PostgreSQL Database Design

Create a normalized relational schema with appropriate foreign keys, indexes, uniqueness constraints, timestamps, and migration files.

Include tables or equivalent models for:

- users
- roles and permissions
- website_settings
- website_pages
- content_sections
- media_assets
- membership_plans
- membership_applications
- memberships
- membership_status_history
- events
- event_categories or distances
- event_registrations
- event_custom_fields
- event_custom_field_responses
- payments
- payment_events or payment_webhook_events
- notification_templates
- notification_campaigns
- notification_recipients or delivery records
- contact_messages
- audit_logs

Add supporting tables for consent history, waitlists, refunds, or other required functionality when appropriate.

Requirements:

- Use UUIDs or another consistent primary-key strategy.
- Use foreign keys and explicit database constraints.
- Store monetary values using an appropriate fixed-precision representation or integer minor units. Never use floating-point values for money.
- Store timestamps consistently and display them in the configured club timezone.
- Store membership and event payments separately through explicit business relationships, even if they share a payment ledger.
- Keep registration records separate from payment records.
- Store payment-provider references and transaction statuses, never raw card details.
- Use transactions for multi-step operations.
- Add indexes for common searches, filtering, reporting, and foreign-key lookups.
- Include database migrations, development seed data, and documented backup/restore procedures.
- Seed the five initial membership plans with the exact prices specified above.
- Never use mock or in-memory storage as a substitute for PostgreSQL persistence in the completed application.

## 10. Centralized Configuration: Single .env File

This is a mandatory architectural requirement.

All environment-specific values, integration endpoints, credentials, feature flags, and configurable technical settings must be managed through one root `.env` file.

Include documented placeholders for settings such as:

### Application

APP_NAME=
APP_ENV=
APP_URL=
APP_TIMEZONE=
PORT=
FRONTEND_URL=
API_BASE_URL=
CORS_ALLOWED_ORIGINS=

### PostgreSQL

DATABASE_URL=
DIRECT_DATABASE_URL=

### Authentication

AUTH_SECRET=
SESSION_SECRET=
ADMIN_BOOTSTRAP_ENABLED=

Use the actual environment variable names required by the chosen authentication library.

### Email

EMAIL_ENABLED=
EMAIL_PROVIDER=
EMAIL_API_BASE_URL=
EMAIL_API_KEY=
EMAIL_FROM_ADDRESS=
EMAIL_FROM_NAME=
EMAIL_REPLY_TO=
EMAIL_WEBHOOK_URL=

### WhatsApp

WHATSAPP_ENABLED=
WHATSAPP_PROVIDER=
WHATSAPP_API_BASE_URL=
WHATSAPP_API_VERSION=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_WEBHOOK_URL=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

### Payments

PAYMENT_ENABLED=false
PAYMENT_PROVIDER=
PAYMENT_API_BASE_URL=
PAYMENT_API_KEY=
PAYMENT_WEBHOOK_URL=
PAYMENT_WEBHOOK_SECRET=
PAYMENT_SUCCESS_URL=
PAYMENT_FAILURE_URL=
PAYMENT_CURRENCY=INR

### Storage

STORAGE_PROVIDER=
STORAGE_ENDPOINT=
STORAGE_BUCKET=
STORAGE_REGION=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=

### Notifications and Operations

CLUB_ADMIN_EMAIL=
CLUB_ADMIN_WHATSAPP=
MEMBER_ANNOUNCEMENTS_ENABLED=
NOTIFICATION_RETRY_LIMIT=
NOTIFICATION_TIMEOUT_MS=
LOG_LEVEL=

These names are examples. Finalize and document the exact variables based on the implemented libraries and providers.

Rules:

1. All configurable API base URLs and endpoints must be read from environment variables.
2. Changing a provider endpoint in `.env` must not require application source-code changes, provided the provider implements the configured adapter contract.
3. Validate required environment variables at application startup.
4. Fail safely with actionable configuration errors.
5. Never expose server secrets to client-side code.
6. Do not commit `.env` to Git.
7. Provide `.env.example` with placeholder values and explanations. Never include real secrets in it.
8. Keep application configuration centralized; do not scatter provider URLs or credentials throughout the codebase.
9. Support local, staging, and production configuration using deployment environment settings while maintaining the same configuration contract.
10. Document which settings require a restart or redeployment after changes.

Do not promise that every provider can be replaced through a URL alone. Different providers can have different authentication, request payloads, webhook formats, and API capabilities. Implement provider adapters so compatible integrations can be changed through configuration; provider-specific code changes may be necessary when the API contract changes.

## 11. Email Notification Integration

Implement an email notification service with a provider adapter.

Support:

- Membership application acknowledgement.
- New membership application alerts to club administrators.
- Membership approval and rejection.
- Payment initiation, confirmation, failure, and refund notifications when relevant.
- Marathon registration confirmation.
- Event reminders and schedule changes.
- Event cancellation and urgent operational announcements.
- Administrative announcements to selected members.

Requirements:

- Use configurable email providers and endpoints.
- Use verified sender addresses and supported authentication.
- Use reusable HTML and plain-text templates.
- Support configurable subjects and message content.
- Record notification status and provider message IDs.
- Handle API failures, timeouts, retries, and duplicate delivery risks.
- Support test emails and a preview function in the admin panel.
- Do not expose API keys in the browser.

## 12. WhatsApp Notification Integration

Use the official WhatsApp Business Platform Cloud API or a compatible, authorized provider.

Support configurable messages for:

- Membership registration acknowledgements.
- Membership approval and rejection.
- Marathon registration confirmation.
- Payment status updates.
- Upcoming event reminders.
- Event changes and cancellations.
- Club-wide announcements.
- Volunteer coordination and operational updates.

Requirements:

- Configure provider endpoints, tokens, phone-number identifiers, and webhooks through environment variables.
- Use approved WhatsApp templates where required by WhatsApp policies.
- Respect user opt-in, opt-out, consent records, messaging windows, and applicable platform policies.
- Record delivery statuses and failures where available.
- Handle provider rate limits and retries safely.
- Provide test-send functionality for administrators.
- Do not claim delivery success until supported by the provider response or delivery-status webhook.

Important: Do not assume that the WhatsApp Business API can send arbitrary messages directly to ordinary WhatsApp groups. Implement club announcements as opt-in individual messages or use a group-based mechanism only if the selected provider officially supports it.

## 13. Club-Wide Announcements

Create an admin-only announcement module.

Administrators must be able to:

- Compose an announcement.
- Select the audience: all eligible members, a membership category, approved/active members, event participants, or volunteers.
- Select email, WhatsApp, or both.
- Preview the content.
- Send a test message.
- Schedule or send the announcement.
- Review recipient counts and delivery outcomes.
- View failed deliveries and retry eligible recipients.
- Cancel scheduled announcements where possible.

Use a database-backed recipient snapshot or equivalent auditable campaign record so the intended audience is traceable.

Prevent duplicate sends using campaign and recipient identifiers.

Respect channel-specific consent and opt-out settings. Separate mandatory operational messages from optional promotional messages.

Use background jobs or a reliable queue for bulk sending. Avoid sending large campaigns synchronously inside a web request.

## 14. Payment Integration — Prepare Now, Activate Later

Do not activate a payment gateway during the initial implementation.

Build a payment abstraction layer so a compatible provider can be configured later.

Requirements:

- Keep payment functionality disabled by default.
- Separate membership payments from event registration payments.
- Support pending, initiated, successful, failed, cancelled, refunded, and partially refunded statuses where applicable.
- Generate unique internal payment references.
- Associate every payment with the correct membership application or event registration.
- Create provider checkout sessions only when payment integration is enabled and configured.
- Verify webhook signatures and provider payment status server-side.
- Make webhook processing idempotent.
- Do not trust browser redirects as proof of payment.
- Do not mark an application paid based solely on a client-side success page.
- Do not store card numbers, CVVs, or other prohibited payment credentials.
- Ensure zero-fee memberships and free events can complete without a payment transaction.
- Provide a clear payment-pending interface until the real integration is enabled.

When payments are disabled, paid registrations must not be falsely marked as paid or active. Preserve their application records and display a clear pending-payment or payment-unavailable status.

Include a documented procedure for enabling and testing a real payment provider later.

## 15. Admin Dashboard and Editable Website

Create a secure admin dashboard with role-based access.

Suggested roles:

- Super Admin.
- Club Administrator.
- Membership Manager.
- Event Manager.
- Communications Manager.

Implement least-privilege permissions.

Dashboard features:

- Total applications and active members.
- Membership counts by category.
- Membership fee configuration.
- Pending approvals.
- Upcoming events and marathon registrations.
- Participant capacity and waitlist status.
- Payment status and revenue reports.
- Notification delivery reports.
- Contact form submissions.
- Website page and media management.
- User management and audit logs.
- CSV exports and other appropriate reports.

Administrators must be able to edit website text, headings, images, navigation links, contact information, membership fees, event information, notification templates, and social media links without editing source code.

Include preview, validation, and publish/unpublish workflows where appropriate.

Never provide public users with admin permissions or unrestricted database access.

## 16. Security, Privacy, and Reliability

Implement:

- Secure authentication and password/session handling.
- Role-based authorization enforced on the server.
- Input validation and output encoding.
- Protection against SQL injection, cross-site scripting, cross-site request forgery where applicable, and broken access control.
- Rate limiting for login, registration, and contact forms.
- Secure HTTP headers and production HTTPS.
- Secret management through environment variables.
- Audit logging for sensitive administrative operations.
- Appropriate file upload validation and storage access controls.
- Database transaction management and safe error handling.
- Consent records and data minimization.
- A documented personal-data retention and deletion policy.
- Protection of emergency contacts and other restricted participant data.
- Secure backup and restoration procedures.
- Dependency vulnerability checks.

Do not log passwords, access tokens, payment secrets, or unnecessary personal information.

## 17. API Design

Create documented, versioned APIs for:

- Membership plans.
- Membership applications.
- Membership approvals and membership records.
- Events and marathon categories.
- Event registrations.
- Payments and payment webhooks.
- Admin announcements.
- Email and WhatsApp delivery callbacks.
- Website content management.
- Reports and exports.

Use consistent HTTP status codes, request validation, response schemas, authorization, pagination, and structured errors.

Generate API documentation, preferably using OpenAPI where appropriate.

## 18. Testing and Acceptance Criteria

Provide automated tests covering:

- All five membership types and their initial prices.
- Registration validation and duplicate submissions.
- Free and paid membership workflows.
- Admin approval and rejection.
- Event creation and event registration.
- Registration capacity and concurrent booking.
- Separation of membership and event payment records.
- Disabled payment behavior.
- Invalid and valid webhook signatures.
- Duplicate webhook processing.
- Email and WhatsApp adapter failures.
- Consent and opt-out enforcement.
- Admin permissions and unauthorized access.
- Database migrations and persistence.
- Environment-variable validation.
- Mobile-responsive layouts and accessibility basics.

Use mocked providers in automated tests and sandbox providers for integration testing where available.

The application is not complete until the core workflows work end to end and the tests pass.

## 19. Deliverables

Produce:

1. A complete working source-code project.
2. Responsive public website.
3. Functional admin dashboard.
4. PostgreSQL schema and migrations.
5. Seed script for membership plans.
6. `.env.example` with all documented settings.
7. A single centralized configuration module.
8. Email and WhatsApp provider adapters.
9. Payment adapter disabled by default.
10. Database backup and restore documentation.
11. API documentation.
12. Automated test suite.
13. Docker and local-development instructions.
14. Production deployment instructions.
15. README with architecture, setup, configuration, troubleshooting, and security notes.
16. A list of incomplete external integrations and the exact credentials or provider setup needed to activate them.

## 20. Implementation Instructions

Work in phases:

Phase 1: Inspect the existing repository, analyze reference websites, document the architecture, and identify risks.

Phase 2: Create the design system, page structure, database schema, migrations, and environment configuration.

Phase 3: Implement authentication, role permissions, membership registration, and the admin dashboard.

Phase 4: Implement events, marathon registration, capacity management, and separate payment records.

Phase 5: Implement email and WhatsApp adapters, notification templates, announcement campaigns, and delivery tracking.

Phase 6: Implement the disabled-by-default payment adapter and secure webhook architecture.

Phase 7: Complete testing, security checks, accessibility improvements, deployment configuration, and documentation.

At every phase, produce working code rather than only plans or code snippets.

If an external provider's credentials are unavailable, implement the adapter interface and test it with mocks. Clearly document what remains to be configured. Never fabricate successful external API calls.

Start by inspecting the repository and presenting a concise implementation plan. Then proceed with implementation, keeping the code modular, secure, testable, and easy to maintain.

Final goal: deliver an original, production-oriented running club platform where club administrators can manage the website, members, fees, events, marathon registrations, notifications, and future payments without requiring source-code changes for ordinary operational updates.
