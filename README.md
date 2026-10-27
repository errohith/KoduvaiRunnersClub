# Koduvai Runners — club website & management platform

A production-oriented running-club platform. It has a public website, membership applications with an approval workflow, event and marathon registration with capacity and waitlists, an email and WhatsApp notification engine, announcement campaigns, and a payment layer that is ready to enable later. Everything ordinary (fees, events, copy, branding, templates) is edited in an admin dashboard. No code changes are needed.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · PostgreSQL · Prisma 6 · Zod · Vitest · Playwright.

| Doc | What's inside |
|---|---|
| **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)** | **Step-by-step guide: setup, admin tasks, runner flows, Postman** |
| [docs/postman/](docs/postman/) | Postman collection (45 requests) + local environment |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Components, key decisions, state machines |
| [docs/DESIGN_ANALYSIS.md](docs/DESIGN_ANALYSIS.md) | Reference-site analysis and design direction |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | **What is not yet live** and exactly how to activate email, WhatsApp and payments |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker, VM and serverless deployment, plus the release checklist |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Backups and restores |
| [docs/DATA_RETENTION.md](docs/DATA_RETENTION.md) | Personal-data retention and deletion policy (template) |
| [docs/openapi.json](docs/openapi.json) | API reference, also served at `/api/v1/openapi.json` |

## Quick start (local)

Requirements: Node 20.11+ and PostgreSQL 14+.

```bash
npm install
cp .env.example .env                 # fill in DATABASE_URL, AUTH_SECRET, ADMIN_BOOTSTRAP_*
npm run env:check                    # validates configuration
npx prisma migrate deploy            # creates tables in the schema named in DATABASE_URL
npm run db:seed -- --sample          # roles, 5 plans, pages, templates, admin (+ sample events/news)
npm run dev                          # http://localhost:3000   admin: /admin
npm run worker                       # second terminal: sends notifications, runs scheduled jobs
```

Sign in at `/admin/login` with `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`. Then set `ADMIN_BOOTSTRAP_ENABLED=false` and change your password under *My account*.

## Features

**Public site:** home, about (story, mission, values, committee), membership (plans, comparison, FAQ), join form and status lookup, event search and filters (upcoming and past), marathons, event details with distances, fees, route, schedule, eligibility, policies and registration, news, gallery albums, contact form with map, editable policy pages (privacy, terms, refund, waiver), confirmation and payment-status pages, and email unsubscribe. The site is responsive (no horizontal scroll at phone widths), passes axe WCAG A/AA scans with no serious issues, and includes SEO metadata and `SportsEvent` JSON-LD.

**Membership:** the five initial plans (Founding ₹1,000 · General ₹500 · Student ₹250 · Volunteer free · Honorary free) are seeded and fully editable: fee, currency, benefits, eligibility, approval rule, duration, active flag and order.
- Applications are validated on the client and the server. Phones are normalised to E.164, and duplicates are blocked by DB constraints.
- Each application gets a reference number (`KR-M-2026-000123`).
- The status flow is Pending → Approved → Active (or Rejected/Cancelled), with history, an audit trail, approval and rejection notifications, admin alerts, CSV export, suspension and renewal.

**Events & marathons:** create, edit, publish, unpublish, cancel or complete events.
- Each event has distances or categories with their own fees, capacities and age limits, plus deadlines, waitlists, volunteers, custom fields, waivers and a medical declaration.
- Registrations are overbooking-safe. Each gets a registration number (`KR-E-…`), and the admin view supports check-in, cancellation with automatic waitlist promotion, change notifications and participant export.

**Payments (off by default):** a separate ledger entry per membership application or registration.
- Includes a provider adapter (Razorpay) and a dev-only mock provider. Webhooks are signature-verified and idempotent.
- Free items never create a payment. While payments are disabled, admins can record verified offline payments (cash or UPI) and refunds.

**Communications:**
- Email (Resend-compatible API or SMTP) and WhatsApp Cloud API adapters.
- Editable HTML and text templates with preview and test send.
- Consent and opt-out enforcement, with STOP keywords honoured.
- A queue with retries and backoff, and a delivery log.
- Announcements to members, a plan, event participants or volunteers. You can schedule, cancel and retry failed sends, and recipients are snapshotted per campaign.

**Admin:** a dashboard and reports covering revenue, members by plan, events and delivery outcomes, plus CSV exports.
- Role-based access with five roles: Super Admin, Club Administrator, Membership Manager, Event Manager and Communications Manager.
- User management, an audit log, and editing for branding, colours, contact details, social links, pages, sections, navigation, news, media, gallery, committee and testimonials.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run worker` | Background worker (notifications, campaigns, reminders, expiry, cleanup) |
| `npm run env:check` | Validate `.env` without starting the app |
| `npm run db:deploy` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:seed [-- --sample]` | Idempotent seed; never overwrites admin-edited content |
| `npm run admin:create -- --email x@y --role SUPER_ADMIN` | Create or reset an admin (password prompted) |
| `npm test` | Unit and integration tests (integration uses `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright browser tests against a running app (`npx playwright install chromium` once) |
| `npm run docs:openapi` | Regenerate `docs/openapi.json` |
| `npm run docs:postman` | Regenerate the Postman collection in `docs/postman/` |
| `npm run audit:deps` | Dependency vulnerability check |

## Testing

- **Unit (38 tests):** money, validation, env rules, state machine, role matrix, adapters (timeouts, retryable vs permanent errors, rate limits), webhook signatures, CSV injection, templates, timezone, URL safety.
- **Integration (35 tests, real PostgreSQL):**
  - all five plans and their exact prices
  - duplicate and concurrent applications
  - free and paid flows, approval and rejection
  - disabled payments never activating a membership
  - 20 concurrent registrations against 5 places → exactly 5
  - waitlist promotion
  - payment-ledger separation enforced by the DB
  - valid, invalid, duplicate and amount-mismatched webhooks
  - retry limits, no double sends, consent and opt-out
  - campaign snapshots, permissions and sessions
  - migration constraints
- **E2E (31 tests, Chromium):** axe scans of every public page, mobile layout with no horizontal scroll, the mobile menu, the join and event-registration flows, server-side validation errors, admin login, approval, CSV export, CSRF origin rejection, and an Event Manager being denied membership and user admin in both the UI and the API.

Integration tests use the database in `TEST_DATABASE_URL`, which must differ from `DATABASE_URL`. They apply migrations with `prisma migrate deploy` and truncate transactional tables in that schema between tests.

## Security notes

- Server-side permission checks on every admin page, action and API route. Restricted participant data (emergency contacts, medical notes) needs its own permission.
- Sessions use bcrypt hashing, hashed DB tokens and httpOnly cookies, and are revoked on password change or deactivation. The last Super Admin cannot be removed.
- Rate limits (stored in Postgres) cover login, applications, registrations, contact and status lookups. A honeypot field stops simple bots.
- CSRF protection: Next.js origin checks for server actions and an `Origin` allow-list for the API.
- Security headers: CSP, X-Frame-Options DENY, nosniff, Referrer-Policy and Permissions-Policy, plus HSTS in production.
- XSS defences: Markdown rendered without raw HTML, template variables HTML-escaped, only http(s) links stored, uploads validated by magic bytes, and CSV formula injection neutralised.
- Secrets live only in `.env` and are never exposed to the client. Logs redact sensitive keys.

## Assumptions

- Runners do not need accounts. Applicants track progress with a reference number and their email. Only club officers sign in.
- Paid memberships are charged **after** approval when approval is required, and immediately when a plan is set to auto-approve.
- No renewal period is assumed. Plans without a duration never expire, and renewals are recorded by admins until online payments are live.
- Paid event registrations hold their place while payment is pending. Admins cancel stale holds, which releases the place and promotes the waitlist.
- The club timezone is `Asia/Kolkata` and currency is INR, both configurable.
- Policy pages ship as clearly marked templates and need committee and legal review.

## Troubleshooting

| Symptom | Fix |
|---|---|
| App exits with "Invalid configuration" | Read the listed keys and fix `.env`, or run `npm run env:check` |
| Emails show **Skipped** | `EMAIL_ENABLED=false`, or (for announcements) the recipient hasn't opted in |
| WhatsApp shows *No approved WhatsApp template configured* | Enter the approved template name in Admin → Templates |
| Notifications stay **Queued** | The worker isn't running (`npm run worker`), or for serverless the cron isn't calling `/api/v1/internal/cron` |
| "Online payment is not available yet" | Expected while `PAYMENT_ENABLED=false`. See docs/INTEGRATIONS.md |
| `prisma migrate dev` warns about drift | You edited the DB by hand. Create a migration rather than editing tables directly |
