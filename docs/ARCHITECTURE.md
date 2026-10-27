# Architecture

```
Browser ──► Next.js 15 (App Router, React 19)
             ├─ (site)/…            public pages (server components, DB-driven content)
             ├─ admin/…             admin UI (server components + server actions)
             ├─ api/v1/…            versioned REST API + webhooks (route handlers)
             └─ instrumentation.ts  validates .env at startup
                   │
                   ▼
            src/server/services      business logic (membership, events, payments,
                   │                  notifications, campaigns, settings, content)
                   ├─ src/server/adapters   email · whatsapp · payment · storage (provider adapters)
                   └─ src/lib/db.ts  Prisma ─► PostgreSQL (schema from DATABASE_URL)

Worker (npm run worker) ──► src/server/jobs.ts: send queued notifications, dispatch
                            announcements, event reminders, expire memberships, housekeeping
```

## Key decisions

| Area | Decision | Why |
|---|---|---|
| Config | `src/config/env.ts` is the only reader of `process.env`. It uses Zod validation with cross-field rules (e.g. payments enabled ⇒ webhook secret required). | One contract and actionable startup errors. |
| Auth | Built-in session auth: bcrypt (cost 12), random 256-bit session tokens stored **hashed**, httpOnly SameSite=Lax cookies, DB-backed sessions that are revocable. | Admins only, no third-party identity needed, fully auditable. |
| AuthZ | Permissions in the DB (`roles`, `permissions`, `role_permissions`). Every page, server action and API checks a permission server-side. | Least privilege, and roles are editable without deploys. |
| CSRF | Server actions get Next's built-in origin check. API route handlers reject unsafe methods whose `Origin` ≠ `APP_URL`. | Cookie-auth endpoints are protected. |
| Money | Integer minor units plus an ISO currency, and DB CHECK constraints. | No float rounding. |
| Capacity | Conditional `UPDATE … WHERE registered_count < capacity` inside the registration transaction, plus a DB CHECK as backstop. | Exactly-capacity under concurrency (tested with 20 parallel registrations). |
| Duplicates | Partial unique indexes on open applications (email, phone) and live registrations (event, email). | Race-proof duplicate prevention. |
| Payments | One ledger table. Each row is linked to exactly one application **or** registration (CHECK). Webhooks are signature-verified on the raw body and idempotent per `(provider, event_id)`. | Separate business flows, auditable money. |
| Notifications | `notification_deliveries` is both the log and a durable queue (`FOR UPDATE SKIP LOCKED`). Idempotency keys, retries with exponential backoff, and a consent re-check at send time. | Reliable bulk sends without Redis, and no double sends. |
| Content | Settings (JSON groups), pages and sections, navigation, news, gallery, committee and testimonials are all in the DB. Markdown is rendered without raw HTML. | Admins edit everything without code, and XSS-safe. |

## Membership status machine

```
submit ─► PENDING ─approve─► APPROVED ─payment succeeded─► ACTIVE ─► (membership row)
             │  └─approve, free plan──────────────────────► ACTIVE
             └─reject─► REJECTED         APPROVED/ACTIVE ─cancel─► CANCELLED
```
When approval is not required (club setting, overridable per plan), submission performs the approve step automatically. A paid plan **never** becomes ACTIVE without a SUCCEEDED payment, whether from a verified webhook, a server-side status check, or an audited offline payment recorded by an admin.

## Event registration states

`CONFIRMED` (free, or paid and settled) · `PENDING_PAYMENT` (holds a place) · `WAITLISTED` (no place, ordered by `waitlisted_at`) · `CANCELLED` (place released, waitlist auto-promoted).

## Directory map

| Path | Contents |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/` | Schema, initial migration, constraints migration |
| `prisma/seed.ts` | Roles and permissions, 5 plans, settings, pages, navigation, templates, bootstrap admin, `--sample` content |
| `src/config/env.ts` | Configuration contract |
| `src/server/services/` | Business logic |
| `src/server/adapters/` | Provider adapters (swap providers here) |
| `src/server/admin/` | Admin server actions |
| `src/app/api/v1/` | REST API (see `docs/openapi.json`, also served at `/api/v1/openapi.json`) |
| `src/worker/run.ts`, `src/server/jobs.ts` | Background jobs |
| `tests/unit`, `tests/integration`, `tests/e2e` | Vitest (unit, Postgres integration) and Playwright (browser, axe, mobile) |
