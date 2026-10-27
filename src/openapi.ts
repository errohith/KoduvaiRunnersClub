/** OpenAPI 3.1 description of /api/v1. Served at /api/v1/openapi.json and written to docs/openapi.json. */
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const errors = {
  "400": { description: "Malformed request", ...json(ref("Error")) },
  "401": { description: "Not signed in", ...json(ref("Error")) },
  "403": { description: "Missing permission or cross-origin request", ...json(ref("Error")) },
  "404": { description: "Not found", ...json(ref("Error")) },
  "409": { description: "Conflict (duplicate, sold out, invalid state transition)", ...json(ref("Error")) },
  "422": { description: "Validation failed — `details` maps field → message", ...json(ref("Error")) },
  "429": { description: "Rate limited", ...json(ref("Error")) },
};
const pageParams = [
  { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
  { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
];
const idParam = (name = "id") => ({ name, in: "path", required: true, schema: { type: "string" } });
const admin = (perm: string) => ({ security: [{ session: [] }], "x-permission": perm });

export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Koduvai Runners API",
    version: "1.0.0",
    description:
      "Versioned REST API. Responses are `{ data }` (or `{ data, meta }` for paginated lists); errors are `{ error: { code, message, details? } }`. " +
      "Admin endpoints use the `kr_session` cookie set by /admin/login and enforce role permissions server-side (`x-permission`). " +
      "Unsafe methods from browsers must come from APP_URL (Origin check). Money is integer minor units (paise).",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: { session: { type: "apiKey", in: "cookie", name: "kr_session" }, cron: { type: "http", scheme: "bearer" } },
    schemas: {
      Error: { type: "object", properties: { error: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" }, details: { type: "object", additionalProperties: { type: "string" } } } } } },
      Plan: { type: "object", properties: { id: { type: "string", format: "uuid" }, code: { type: "string" }, name: { type: "string" }, description: { type: "string" }, feeMinor: { type: "integer" }, currency: { type: "string" }, isFree: { type: "boolean" }, benefits: { type: "array", items: { type: "string" } }, eligibility: { type: ["string", "null"] }, requiresStudentVerification: { type: "boolean" }, durationMonths: { type: ["integer", "null"] } } },
      MembershipApplicationInput: {
        type: "object",
        required: ["planId", "fullName", "email", "phone", "city", "experienceLevel", "acceptTerms", "acceptPrivacy", "acceptDeclaration"],
        properties: {
          planId: { type: "string", format: "uuid" }, fullName: { type: "string" }, email: { type: "string", format: "email" }, phone: { type: "string", description: "Any format; normalised to E.164 (default region IN)" },
          dateOfBirth: { type: "string", format: "date" }, city: { type: "string" }, address: { type: "string" },
          experienceLevel: { enum: ["New to running", "Beginner (up to 5K)", "Intermediate (10K–21K)", "Advanced (marathon+)", "Walker"] },
          interests: { type: "array", items: { type: "string" } }, emergencyName: { type: "string" }, emergencyPhone: { type: "string" },
          studentInstitution: { type: "string" }, studentIdNumber: { type: "string" }, referralSource: { type: "string" },
          acceptTerms: { const: true }, acceptPrivacy: { const: true }, acceptDeclaration: { const: true },
          consentWhatsapp: { type: "boolean" }, consentMarketingEmail: { type: "boolean" },
        },
      },
      MembershipApplicationResult: { type: "object", properties: { referenceNo: { type: "string", example: "KR-M-2026-000001" }, status: { enum: ["PENDING", "APPROVED", "ACTIVE"] }, planName: { type: "string" }, feeMinor: { type: "integer" }, currency: { type: "string" }, approvalRequired: { type: "boolean" }, paymentReference: { type: ["string", "null"] } } },
      EventRegistrationInput: {
        type: "object",
        required: ["eventId", "fullName", "email", "phone", "emergencyName", "emergencyPhone", "acceptTerms"],
        properties: {
          eventId: { type: "string", format: "uuid" }, categoryId: { type: "string", format: "uuid", description: "Required for participants" },
          participantType: { enum: ["PARTICIPANT", "VOLUNTEER"] }, fullName: { type: "string" }, email: { type: "string" }, phone: { type: "string" },
          dateOfBirth: { type: "string", format: "date" }, gender: { type: "string" }, emergencyName: { type: "string" }, emergencyPhone: { type: "string" },
          medicalDeclaration: { type: "boolean" }, medicalNotes: { type: "string" }, tshirtSize: { type: "string" }, accessibilityNeeds: { type: "string" },
          acceptTerms: { const: true }, acceptWaiver: { type: "boolean" }, consentWhatsapp: { type: "boolean" }, consentMarketingEmail: { type: "boolean" },
          customFields: { type: "object", additionalProperties: { type: "string" } },
        },
      },
      EventRegistrationResult: { type: "object", properties: { registrationNo: { type: "string" }, status: { enum: ["CONFIRMED", "PENDING_PAYMENT", "WAITLISTED"] }, feeMinor: { type: "integer" }, currency: { type: "string" }, eventTitle: { type: "string" }, category: { type: "string" }, paymentReference: { type: ["string", "null"] } } },
      Campaign: { type: "object", required: ["title", "bodyText", "channels", "category", "audience"], properties: { title: { type: "string" }, subject: { type: "string" }, bodyText: { type: "string" }, bodyHtml: { type: "string" }, whatsappTemplateName: { type: "string" }, whatsappLanguage: { type: "string" }, channels: { type: "array", items: { enum: ["EMAIL", "WHATSAPP"] } }, category: { enum: ["OPERATIONAL", "PROMOTIONAL"] }, audience: { type: "object", properties: { type: { enum: ["ALL_ACTIVE_MEMBERS", "ALL_APPROVED_OR_ACTIVE", "PLAN", "EVENT_PARTICIPANTS", "EVENT_VOLUNTEERS"] }, planId: { type: "string" }, eventId: { type: "string" } } }, scheduledAt: { type: "string", format: "date-time" } } },
    },
  },
  paths: {
    "/health": { get: { summary: "Liveness + database check", responses: { "200": { description: "OK" }, "503": { description: "Database unreachable" } } } },
    "/membership-plans": { get: { tags: ["Membership"], summary: "Active membership plans", responses: { "200": { description: "Plans", ...json({ type: "object", properties: { data: { type: "array", items: ref("Plan") } } }) } } } },
    "/membership-applications": { post: { tags: ["Membership"], summary: "Submit a membership application (rate limited 5/hour/IP)", requestBody: json(ref("MembershipApplicationInput")), responses: { "201": { description: "Created", ...json({ type: "object", properties: { data: ref("MembershipApplicationResult") } }) }, ...errors } } },
    "/membership-applications/status": { post: { tags: ["Membership"], summary: "Look up an application by reference + email", requestBody: json({ type: "object", required: ["referenceNo", "email"], properties: { referenceNo: { type: "string" }, email: { type: "string" } } }), responses: { "200": { description: "Status" }, ...errors } } },
    "/events": { get: { tags: ["Events"], summary: "Search public events", parameters: [{ name: "q", in: "query", schema: { type: "string" } }, { name: "type", in: "query", schema: { enum: ["CLUB_RUN", "MARATHON", "TRAINING", "SOCIAL", "VOLUNTEER", "OTHER"] } }, { name: "when", in: "query", schema: { enum: ["upcoming", "past"] } }, { name: "city", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Events with categories, fees and spots left" } } } },
    "/events/{slug}": { get: { tags: ["Events"], summary: "Event details incl. categories and custom fields", parameters: [idParam("slug")], responses: { "200": { description: "Event" }, ...errors } } },
    "/event-registrations": { post: { tags: ["Events"], summary: "Register for an event (capacity-safe; waitlists when enabled)", requestBody: json(ref("EventRegistrationInput")), responses: { "201": { description: "Registered", ...json({ type: "object", properties: { data: ref("EventRegistrationResult") } }) }, ...errors } } },
    "/contact": { post: { tags: ["Website"], summary: "Send a contact-form message", requestBody: json({ type: "object", required: ["name", "email", "subject", "message"], properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, subject: { type: "string" }, message: { type: "string" } } }), responses: { "201": { description: "Received" }, ...errors } } },
    "/content/settings": { get: { tags: ["Website"], summary: "Public branding, contact and social settings", responses: { "200": { description: "Settings" } } } },
    "/content/pages/{slug}": { get: { tags: ["Website"], summary: "A CMS page with its sections", parameters: [idParam("slug")], responses: { "200": { description: "Page" }, ...errors } } },
    "/payments/{reference}": { get: { tags: ["Payments"], summary: "Payment status (non-personal fields only)", parameters: [idParam("reference")], responses: { "200": { description: "Payment" }, ...errors } } },
    "/payments/{reference}/checkout": { post: { tags: ["Payments"], summary: "Create/reuse a provider checkout. 503 `payments_disabled` until payments are enabled.", parameters: [idParam("reference")], responses: { "200": { description: "{ checkoutUrl }" }, "503": { description: "Payments disabled", ...json(ref("Error")) }, ...errors } } },
    "/webhooks/payments/{provider}": { post: { tags: ["Webhooks"], summary: "Payment provider webhook. Signature verified on the raw body; idempotent per provider event id.", parameters: [idParam("provider")], responses: { "200": { description: "Processed or duplicate" }, "401": { description: "Bad signature" }, "404": { description: "Provider not configured" }, "500": { description: "Processing failed — provider should retry" } } } },
    "/webhooks/whatsapp": {
      get: { tags: ["Webhooks"], summary: "Meta webhook verification handshake (hub.challenge)", responses: { "200": { description: "Challenge echoed" }, "403": { description: "Bad verify token" } } },
      post: { tags: ["Webhooks"], summary: "WhatsApp delivery statuses and STOP/START opt-out keywords (X-Hub-Signature-256)", responses: { "200": { description: "OK" }, "401": { description: "Bad signature" } } },
    },
    "/webhooks/email": { post: { tags: ["Webhooks"], summary: "Provider-neutral email delivery callback (header x-webhook-secret)", requestBody: json({ type: "object", properties: { events: { type: "array", items: { type: "object", properties: { providerMessageId: { type: "string" }, status: { enum: ["sent", "delivered", "failed"] }, error: { type: "string" } } } } } }), responses: { "200": { description: "OK" }, "401": { description: "Bad secret" } } } },
    "/internal/cron": { post: { tags: ["Operations"], summary: "Run one scheduler tick (serverless alternative to the worker)", security: [{ cron: [] }], responses: { "200": { description: "Tick result" }, "401": { description: "Bad token" } } } },
    "/auth/login": { post: { tags: ["Auth"], summary: "Admin sign-in for API clients. Sets the httpOnly kr_session cookie (rate limited).", requestBody: json({ type: "object", required: ["email", "password"], properties: { email: { type: "string" }, password: { type: "string" } } }), responses: { "200": { description: "Signed in" }, "401": { description: "Incorrect email or password", ...json(ref("Error")) }, "429": { description: "Rate limited" } } } },
    "/auth/me": { get: { tags: ["Auth"], security: [{ session: [] }], summary: "Current admin user, roles and permissions", responses: { "200": { description: "User" }, "401": { description: "Not signed in" } } } },
    "/auth/logout": { post: { tags: ["Auth"], security: [{ session: [] }], summary: "Sign out (deletes the session)", responses: { "200": { description: "Signed out" } } } },
    "/admin/membership-applications/{id}": { delete: { tags: ["Admin"], ...admin("members.delete"), summary: "Delete a member. Unpaid → permanently deleted; paid → anonymised (payments kept).", parameters: [idParam(), { name: "confirm", in: "query", required: true, description: "The application reference number, e.g. KR-M-2026-000001", schema: { type: "string" } }], responses: { "200": { description: "{ mode: delete | anonymise }" }, ...errors } } },
    "/admin/membership-applications": { get: { tags: ["Admin"], ...admin("members.view"), summary: "List applications", parameters: [...pageParams, { name: "status", in: "query", schema: { type: "string" } }, { name: "planId", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Paginated" }, ...errors } } },
    "/admin/membership-applications/{id}/decision": { post: { tags: ["Admin"], ...admin("members.manage"), summary: "Approve or reject (note required to reject)", parameters: [idParam()], requestBody: json({ type: "object", required: ["decision"], properties: { decision: { enum: ["approve", "reject"] }, note: { type: "string" } } }), responses: { "200": { description: "New status" }, ...errors } } },
    "/admin/memberships": { get: { tags: ["Admin"], ...admin("members.view"), summary: "List memberships", parameters: pageParams, responses: { "200": { description: "Paginated" }, ...errors } } },
    "/admin/membership-plans": {
      get: { tags: ["Admin"], ...admin("plans.manage"), summary: "All plans", responses: { "200": { description: "Plans" }, ...errors } },
      post: { tags: ["Admin"], ...admin("plans.manage"), summary: "Create a plan", responses: { "201": { description: "Created" }, ...errors } },
    },
    "/admin/membership-plans/{id}": { put: { tags: ["Admin"], ...admin("plans.manage"), summary: "Update a plan (fee, benefits, status, order…)", parameters: [idParam()], responses: { "200": { description: "Updated" }, ...errors } } },
    "/admin/events": {
      get: { tags: ["Admin"], ...admin("events.view"), summary: "All events", responses: { "200": { description: "Events" }, ...errors } },
      post: { tags: ["Admin"], ...admin("events.manage"), summary: "Create an event (as DRAFT)", requestBody: json({ type: "object", required: ["title", "summary", "startsAt", "venueName", "city"], properties: { title: { type: "string" }, slug: { type: "string" }, summary: { type: "string" }, description: { type: "string" }, type: { enum: ["CLUB_RUN", "MARATHON", "TRAINING", "SOCIAL", "VOLUNTEER", "OTHER"] }, startsAt: { type: "string", format: "date-time" }, endsAt: { type: "string", format: "date-time" }, venueName: { type: "string" }, city: { type: "string" }, registrationEnabled: { type: "boolean" }, registrationClosesAt: { type: "string", format: "date-time" }, capacity: { type: ["integer", "null"] }, waitlistEnabled: { type: "boolean" }, volunteersEnabled: { type: "boolean" } } }), responses: { "201": { description: "Created" }, ...errors } },
    },
    "/admin/events/{id}": {
      get: { tags: ["Admin"], ...admin("events.view"), summary: "Event with categories and custom fields", parameters: [idParam()], responses: { "200": { description: "Event" }, ...errors } },
      delete: { tags: ["Admin"], ...admin("events.delete"), summary: "Permanently delete an event and its (unpaid) registrations. 409 if any registration has a received payment.", parameters: [idParam(), { name: "confirm", in: "query", required: true, description: "The event slug", schema: { type: "string" } }], responses: { "200": { description: "Deleted" }, ...errors } },
    },
    "/admin/events/{id}/categories": { post: { tags: ["Admin"], ...admin("events.manage"), summary: "Add a distance/category", parameters: [idParam()], requestBody: json({ type: "object", required: ["name", "feeMinor"], properties: { name: { type: "string" }, distanceKm: { type: "number" }, feeMinor: { type: "integer" }, capacity: { type: ["integer", "null"] }, minAge: { type: "integer" }, maxAge: { type: "integer" }, startTime: { type: "string", example: "06:00" } } }), responses: { "201": { description: "Created" }, ...errors } } },
    "/admin/event-registrations/{id}": { delete: { tags: ["Admin"], ...admin("events.delete"), summary: "Delete a registration. Unpaid → deleted (place released, waitlist promoted); paid → anonymised.", parameters: [idParam(), { name: "confirm", in: "query", required: true, description: "The registration number", schema: { type: "string" } }], responses: { "200": { description: "{ mode }" }, ...errors } } },
    "/admin/events/{id}/status": { post: { tags: ["Admin"], ...admin("events.manage"), summary: "Publish / unpublish / cancel / complete", parameters: [idParam()], requestBody: json({ type: "object", required: ["status"], properties: { status: { enum: ["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"] }, reason: { type: "string" } } }), responses: { "200": { description: "OK" }, ...errors } } },
    "/admin/events/{id}/registrations": { get: { tags: ["Admin"], ...admin("registrations.view"), summary: "Registrations (restricted fields need registrations.restricted)", parameters: [idParam(), ...pageParams], responses: { "200": { description: "Paginated" }, ...errors } } },
    "/admin/announcements": {
      get: { tags: ["Admin"], ...admin("comms.view"), summary: "List announcements", responses: { "200": { description: "Campaigns" }, ...errors } },
      post: { tags: ["Admin"], ...admin("comms.send"), summary: "Create (and optionally schedule) an announcement", requestBody: json(ref("Campaign")), responses: { "201": { description: "Created" }, ...errors } },
    },
    "/admin/announcements/{id}/send": { post: { tags: ["Admin"], ...admin("comms.send"), summary: "Queue for immediate background dispatch", parameters: [idParam()], responses: { "202": { description: "Queued" }, ...errors } } },
    "/admin/payments": { get: { tags: ["Admin"], ...admin("payments.view"), summary: "List payments", parameters: [...pageParams, { name: "status", in: "query", schema: { type: "string" } }, { name: "purpose", in: "query", schema: { enum: ["MEMBERSHIP", "EVENT_REGISTRATION"] } }], responses: { "200": { description: "Paginated" }, ...errors } } },
    "/admin/settings/{group}": {
      get: { tags: ["Admin"], ...admin("settings.manage"), summary: "Read a settings group (branding, contact, social, membership, seo)", parameters: [idParam("group")], responses: { "200": { description: "Settings" }, ...errors } },
      put: { tags: ["Admin"], ...admin("settings.manage"), summary: "Patch a settings group", parameters: [idParam("group")], responses: { "200": { description: "Merged settings" }, ...errors } },
    },
    "/admin/reports/summary": { get: { tags: ["Admin"], ...admin("reports.view"), summary: "Aggregated counts and revenue", responses: { "200": { description: "Summary" }, ...errors } } },
    "/admin/exports/{kind}": { get: { tags: ["Admin"], security: [{ session: [] }], summary: "CSV export: applications | members | registrations (?eventId=) | payments | contacts", parameters: [idParam("kind")], responses: { "200": { description: "text/csv" }, ...errors } } },
  },
} as const;
