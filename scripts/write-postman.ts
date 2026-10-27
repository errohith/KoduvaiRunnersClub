/**
 * Generates the Postman collection + environment in docs/postman/.
 *   npm run docs:postman
 * Run the collection top-to-bottom (Collection Runner or `npx newman run`): requests save the IDs
 * they create into collection variables for the requests that follow.
 */
import { mkdirSync, writeFileSync } from "node:fs";

type Req = {
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  description?: string;
  pre?: string[];
  test?: string[];
};

const json = (o: unknown) => JSON.stringify(o, null, 2);
const expectStatus = (...codes: number[]) =>
  codes.length === 1
    ? `pm.test("status ${codes[0]}", () => pm.response.to.have.status(${codes[0]}));`
    : `pm.test("status ${codes.join(" or ")}", () => pm.expect([${codes.join(", ")}]).to.include(pm.response.code));`;
const save = (variable: string, expr: string) => `if (pm.response.code < 300) { const d = pm.response.json().data; pm.collectionVariables.set("${variable}", ${expr}); }`;
const uniqueContact = [
  `const n = Date.now().toString();`,
  `pm.collectionVariables.set("uniqueEmail", "postman" + n + "@example.com");`,
  `pm.collectionVariables.set("uniquePhone", "+919" + n.slice(-9));`,
];

function item(r: Req) {
  const [p, q] = r.path.split("?");
  return {
    name: r.name,
    request: {
      method: r.method,
      description: r.description,
      header: r.body ? [{ key: "Content-Type", value: "application/json" }] : [],
      url: {
        raw: `{{baseUrl}}/api/v1${r.path}`,
        host: ["{{baseUrl}}"],
        path: ["api", "v1", ...p.split("/").filter(Boolean)],
        query: q ? q.split("&").map((kv) => ({ key: kv.split("=")[0], value: kv.split("=")[1] })) : undefined,
      },
      body: r.body ? { mode: "raw", raw: json(r.body), options: { raw: { language: "json" } } } : undefined,
    },
    event: [
      ...(r.pre ? [{ listen: "prerequest", script: { type: "text/javascript", exec: r.pre } }] : []),
      ...(r.test ? [{ listen: "test", script: { type: "text/javascript", exec: r.test } }] : []),
    ],
  };
}

const folder = (name: string, description: string, reqs: Req[]) => ({ name, description, item: reqs.map(item) });

const collection = {
  info: {
    name: "Koduvai Runners API",
    description:
      "Koduvai Runners REST API (v1). Run top-to-bottom: requests save created IDs into collection variables.\n\n" +
      "1. Import this collection and the environment file.\n2. Set `adminEmail` / `adminPassword` in the environment.\n3. Run **0 · Health & sign-in → Sign in** first — Postman keeps the `kr_session` cookie for the admin requests.\n\n" +
      "Money is in paise (`feeMinor: 50000` = ₹500). Errors look like `{ error: { code, message, details } }`. Full reference: docs/openapi.json.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    "planId", "freePlanId", "referenceNo", "applicationId", "eventSlug", "eventId", "categoryId", "registrationNo",
    "paymentReference", "adminEventId", "adminEventSlug", "adminCategoryId", "adminRegistrationNo", "adminRegistrationId",
    "deleteApplicationId", "deleteReferenceNo", "paidCategoryId", "savedHours", "campaignId", "uniqueEmail", "uniquePhone", "eventStart",
  ].map((key) => ({ key, value: "" })),
  item: [
    folder("0 · Health & sign-in", "Sign in once; the session cookie is reused by all admin requests.", [
      { name: "Health check", method: "GET", path: "/health", test: [expectStatus(200)] },
      { name: "Sign in (admin)", method: "POST", path: "/auth/login", body: { email: "{{adminEmail}}", password: "{{adminPassword}}" }, description: "Sets the httpOnly `kr_session` cookie. 8 failed attempts per email lock sign-in for 15 minutes.", test: [expectStatus(200)] },
      { name: "Who am I", method: "GET", path: "/auth/me", test: [expectStatus(200), `pm.test("has permissions", () => pm.expect(pm.response.json().data.permissions.length).to.be.above(0));`] },
    ]),
    folder("1 · Public · Membership", "What the website's join form uses. No sign-in needed.", [
      {
        name: "List membership plans",
        method: "GET",
        path: "/membership-plans",
        test: [expectStatus(200), save("planId", `d.find(p => p.code === "GENERAL").id`), save("freePlanId", `d.find(p => p.feeMinor === 0).id`)],
      },
      {
        name: "Submit membership application",
        method: "POST",
        path: "/membership-applications",
        pre: uniqueContact,
        body: {
          planId: "{{planId}}", fullName: "Postman Runner", email: "{{uniqueEmail}}", phone: "{{uniquePhone}}", city: "Koduvai",
          experienceLevel: "Beginner (up to 5K)", interests: ["Weekend long runs"], emergencyName: "Family Contact", emergencyPhone: "+919123456789",
          acceptTerms: true, acceptPrivacy: true, acceptDeclaration: true, consentWhatsapp: false, consentMarketingEmail: true,
        },
        description: "Returns a reference number (KR-M-YYYY-NNNNNN). 409 duplicate_application if the email/phone already has an open application. Rate limited to 5/hour per IP.",
        test: [expectStatus(201), save("referenceNo", "d.referenceNo")],
      },
      { name: "Check application status", method: "POST", path: "/membership-applications/status", body: { referenceNo: "{{referenceNo}}", email: "{{uniqueEmail}}" }, test: [expectStatus(200)] },
      {
        name: "Validation error example (422)",
        method: "POST",
        path: "/membership-applications",
        body: { planId: "{{planId}}", fullName: "X", email: "not-an-email" },
        description: "Shows the error format: `details` maps each field to a message.",
        test: [expectStatus(422)],
      },
    ]),
    folder("2 · Public · Events", "Event discovery and registration (separate from membership).", [
      {
        name: "List upcoming events",
        method: "GET",
        path: "/events?when=upcoming",
        test: [expectStatus(200), `const open = pm.response.json().data.find(e => e.registration === "open" && e.categories.length); if (open) { pm.collectionVariables.set("eventSlug", open.slug); pm.collectionVariables.set("eventId", open.id); pm.collectionVariables.set("categoryId", open.categories[0].id); }`],
      },
      { name: "Search events", method: "GET", path: "/events?q=marathon&type=MARATHON&when=upcoming", test: [expectStatus(200)] },
      { name: "Event details", method: "GET", path: "/events/{{eventSlug}}", test: [expectStatus(200, 404)] },
    ]),
    folder("3 · Public · Website & payments", "Content API, contact form and payment status.", [
      { name: "Site settings (branding, contact)", method: "GET", path: "/content/settings", test: [expectStatus(200)] },
      { name: "CMS page", method: "GET", path: "/content/pages/about", test: [expectStatus(200)] },
      { name: "Send contact message", method: "POST", path: "/contact", body: { name: "Postman Tester", email: "postman@example.com", subject: "API test", message: "Hello from the Postman collection." }, test: [expectStatus(201)] },
      { name: "OpenAPI document", method: "GET", path: "/openapi.json", test: [expectStatus(200)] },
    ]),
    folder("4 · Admin · Membership", "Requires sign-in. Approve applications, manage plans, delete members.", [
      { name: "List pending applications", method: "GET", path: "/admin/membership-applications?status=PENDING&page=1&pageSize=25", test: [expectStatus(200), `const a = pm.response.json().data.find(x => x.referenceNo === pm.collectionVariables.get("referenceNo")); if (a) pm.collectionVariables.set("applicationId", a.id);`] },
      { name: "Approve application", method: "POST", path: "/admin/membership-applications/{{applicationId}}/decision", body: { decision: "approve", note: "Welcome to the club!" }, description: "Paid plans move to APPROVED (payment pending); free plans become ACTIVE. To reject: `{ decision: \"reject\", note: \"reason\" }` (note required).", test: [expectStatus(200)] },
      { name: "List members", method: "GET", path: "/admin/memberships?page=1&pageSize=25", test: [expectStatus(200)] },
      { name: "List plans", method: "GET", path: "/admin/membership-plans", test: [expectStatus(200)] },
      { name: "Update a plan fee", method: "PUT", path: "/admin/membership-plans/{{planId}}", body: { feeMinor: 50000 }, description: "feeMinor is in paise. Only affects NEW applications.", test: [expectStatus(200)] },
      {
        name: "Create a throwaway application (to delete)",
        method: "POST",
        path: "/membership-applications",
        pre: uniqueContact,
        body: { planId: "{{freePlanId}}", fullName: "Delete Me", email: "{{uniqueEmail}}", phone: "{{uniquePhone}}", city: "Koduvai", experienceLevel: "Walker", emergencyName: "Kin", emergencyPhone: "+919123456789", acceptTerms: true, acceptPrivacy: true, acceptDeclaration: true },
        test: [expectStatus(201), save("deleteReferenceNo", "d.referenceNo")],
      },
      { name: "Find it", method: "GET", path: "/admin/membership-applications?page=1&pageSize=50", test: [expectStatus(200), `const a = pm.response.json().data.find(x => x.referenceNo === pm.collectionVariables.get("deleteReferenceNo")); if (a) pm.collectionVariables.set("deleteApplicationId", a.id);`] },
      { name: "Delete member (Super Admin)", method: "DELETE", path: "/admin/membership-applications/{{deleteApplicationId}}?confirm={{deleteReferenceNo}}", description: "`confirm` must equal the reference number. Unpaid → permanently deleted; paid → anonymised (payments kept).", test: [expectStatus(200), `pm.test("deleted", () => pm.expect(pm.response.json().data.mode).to.eql("delete"));`] },
    ]),
    folder("5 · Admin · Events", "Create → add distance → publish → register → manage → delete.", [
      {
        name: "Create event (draft)",
        method: "POST",
        path: "/admin/events",
        pre: [`pm.collectionVariables.set("adminEventSlug", "postman-run-" + Date.now()); const d = new Date(Date.now() + 14 * 86400000); d.setUTCHours(0, 30, 0, 0); pm.collectionVariables.set("eventStart", d.toISOString());`],
        body: { title: "Postman Test Run", slug: "{{adminEventSlug}}", summary: "Created from the Postman collection.", description: "Safe to delete.", type: "CLUB_RUN", startsAt: "{{eventStart}}", venueName: "Temple Junction", city: "Koduvai", registrationEnabled: true, capacity: 50, waitlistEnabled: true, volunteersEnabled: true },
        test: [expectStatus(201), save("adminEventId", "d.id")],
      },
      { name: "Add distance / category", method: "POST", path: "/admin/events/{{adminEventId}}/categories", body: { name: "5K Easy", distanceKm: 5, feeMinor: 0, capacity: 30, startTime: "06:00" }, test: [expectStatus(201), save("adminCategoryId", "d.id")] },
      { name: "Publish event", method: "POST", path: "/admin/events/{{adminEventId}}/status", body: { status: "PUBLISHED" }, description: "Other statuses: DRAFT (unpublish), COMPLETED, CANCELLED (+ reason, notifies registrants).", test: [expectStatus(200)] },
      {
        name: "Register a runner (public)",
        method: "POST",
        path: "/event-registrations",
        pre: uniqueContact,
        body: { eventId: "{{adminEventId}}", categoryId: "{{adminCategoryId}}", participantType: "PARTICIPANT", fullName: "Postman Racer", email: "{{uniqueEmail}}", phone: "{{uniquePhone}}", emergencyName: "Family Contact", emergencyPhone: "+919123456789", acceptTerms: true, consentWhatsapp: false, customFields: {} },
        description: "Free category → CONFIRMED. Paid → PENDING_PAYMENT with a paymentReference. Full → WAITLISTED (if enabled) or 409 sold_out.",
        test: [expectStatus(201), save("adminRegistrationNo", "d.registrationNo"), `if (pm.response.json().data && pm.response.json().data.paymentReference) pm.collectionVariables.set("paymentReference", pm.response.json().data.paymentReference);`],
      },
      { name: "Add a paid distance", method: "POST", path: "/admin/events/{{adminEventId}}/categories", body: { name: "10K Timed", distanceKm: 10, feeMinor: 30000, capacity: 20, minAge: 16, startTime: "06:15" }, description: "feeMinor 30000 = ₹300.", test: [expectStatus(201), save("paidCategoryId", "d.id")] },
      {
        name: "Register for the paid distance (payment pending)",
        method: "POST",
        path: "/event-registrations",
        pre: uniqueContact,
        body: { eventId: "{{adminEventId}}", categoryId: "{{paidCategoryId}}", fullName: "Postman Payer", email: "{{uniqueEmail}}", phone: "{{uniquePhone}}", dateOfBirth: "1990-01-15", emergencyName: "Family Contact", emergencyPhone: "+919123456789", acceptTerms: true },
        test: [expectStatus(201), save("paymentReference", "d.paymentReference"), `pm.test("pending payment", () => pm.expect(pm.response.json().data.status).to.eql("PENDING_PAYMENT"));`],
      },
      { name: "Payment status (public)", method: "GET", path: "/payments/{{paymentReference}}", test: [expectStatus(200)] },
      { name: "Start online checkout (503 while payments are disabled)", method: "POST", path: "/payments/{{paymentReference}}/checkout", description: "Returns 503 payments_disabled until PAYMENT_ENABLED=true. The registration stays PENDING_PAYMENT — never marked paid.", test: [expectStatus(200, 503)] },
      { name: "Event details (admin)", method: "GET", path: "/admin/events/{{adminEventId}}", test: [expectStatus(200)] },
      { name: "List registrations", method: "GET", path: "/admin/events/{{adminEventId}}/registrations?page=1&pageSize=50", description: "Emergency contacts/medical notes are included only for roles with registrations.restricted.", test: [expectStatus(200), `const r = pm.response.json().data.find(x => x.registrationNo === pm.collectionVariables.get("adminRegistrationNo")); if (r) pm.collectionVariables.set("adminRegistrationId", r.id);`] },
      { name: "Delete registration (Super Admin)", method: "DELETE", path: "/admin/event-registrations/{{adminRegistrationId}}?confirm={{adminRegistrationNo}}", description: "Unpaid → deleted and the place released (waitlist promoted). Paid → anonymised, payment kept.", test: [expectStatus(200)] },
      { name: "Delete event (Super Admin)", method: "DELETE", path: "/admin/events/{{adminEventId}}?confirm={{adminEventSlug}}", description: "`confirm` must equal the slug. 409 event_has_payments if any registration has been paid — cancel the event instead.", test: [expectStatus(200)] },
      { name: "List all events (admin)", method: "GET", path: "/admin/events", test: [expectStatus(200)] },
    ]),
    folder("6 · Admin · Announcements", "Draft → send. Sending is done by the background worker.", [
      { name: "List announcements", method: "GET", path: "/admin/announcements", test: [expectStatus(200)] },
      {
        name: "Create announcement (draft)",
        method: "POST",
        path: "/admin/announcements",
        body: { title: "Postman test announcement", subject: "Hello {{name}}", bodyText: "Hi {{name}}, this is a test announcement.", channels: ["EMAIL"], category: "PROMOTIONAL", audience: { type: "ALL_ACTIVE_MEMBERS" } },
        description: "{{name}} is left for the server (no Postman variable has that name) and becomes each recipient's name. Audience types: ALL_ACTIVE_MEMBERS, ALL_APPROVED_OR_ACTIVE, PLAN (+planId), EVENT_PARTICIPANTS / EVENT_VOLUNTEERS (+eventId). WhatsApp needs whatsappTemplateName.",
        test: [expectStatus(201), save("campaignId", "d.id")],
      },
      { name: "Send announcement now (queues it)", method: "POST", path: "/admin/announcements/{{campaignId}}/send", description: "Returns 202; the worker (npm run worker) dispatches it. Only opted-in recipients receive promotional messages.", test: [expectStatus(202)] },
    ]),
    folder("7 · Admin · Payments, reports & settings", "", [
      { name: "List payments", method: "GET", path: "/admin/payments?page=1&pageSize=25", test: [expectStatus(200)] },
      { name: "Reports summary", method: "GET", path: "/admin/reports/summary", test: [expectStatus(200)] },
      { name: "Get contact settings", method: "GET", path: "/admin/settings/contact", test: [expectStatus(200), save("savedHours", "d.hours ?? \"\"")] },
      { name: "Update contact settings (writes back the current value)", method: "PUT", path: "/admin/settings/contact", body: { hours: "{{savedHours}}" }, description: "Groups: branding, contact, social, membership, seo. Send only the fields to change, e.g. { \"hours\": \"Tue & Thu 5:30 am\" }. This sample re-saves the current value so running the collection does not change your site.", test: [expectStatus(200)] },
      { name: "Export members (CSV)", method: "GET", path: "/admin/exports/members", description: "Other kinds: applications, registrations?eventId=…, payments, contacts.", test: [expectStatus(200)] },
    ]),
    folder("8 · Sign out", "", [
      { name: "Sign out", method: "POST", path: "/auth/logout", test: [expectStatus(200)] },
      { name: "Admin API now refuses (401)", method: "GET", path: "/admin/payments", test: [expectStatus(401)] },
    ]),
  ],
};

const environment = {
  name: "Koduvai Runners — local",
  values: [
    { key: "baseUrl", value: "http://localhost:3000", enabled: true },
    { key: "adminEmail", value: "admin@example.org", enabled: true },
    { key: "adminPassword", value: "", type: "secret", enabled: true },
  ],
};

mkdirSync(new URL("../docs/postman/", import.meta.url), { recursive: true });
writeFileSync(new URL("../docs/postman/Koduvai-Runners.postman_collection.json", import.meta.url), json(collection) + "\n");
writeFileSync(new URL("../docs/postman/Koduvai-Runners.local.postman_environment.json", import.meta.url), json(environment) + "\n");
console.log("✓ docs/postman/ written");
