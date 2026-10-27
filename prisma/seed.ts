/**
 * Seed script — idempotent. `npm run db:seed` seeds essentials (roles, plans, settings, pages,
 * navigation, templates, bootstrap admin). `npm run db:seed -- --sample` also adds clearly
 * fictional sample events and a news post for local development. Remove sample data before launch.
 *
 * Existing rows are NOT overwritten (admins own the content once it exists), except roles'
 * permission sets, which always follow src/lib/auth/permissions.ts.
 */
import "dotenv/config";
import { PrismaClient, type Channel, type MessageCategory, type Prisma } from "@prisma/client";
import { PERMISSIONS, ROLES } from "../src/lib/auth/permissions";
import { hashPassword } from "../src/lib/auth/password";
import { DEFAULT_SETTINGS } from "../src/server/services/settings";

const prisma = new PrismaClient();
const withSample = process.argv.includes("--sample");

// ─── The five initial membership plans. Fees are INITIAL values in paise; admins can change them. ───
export const INITIAL_PLANS = [
  {
    code: "FOUNDING",
    name: "Founding Member",
    feeMinor: 1000_00,
    description: "For the runners who help build the club from day one.",
    benefits: ["Founding member recognition", "Voting rights at the general body", "Priority registration for club events", "Club running vest"],
    eligibility: "Open while founding memberships are available.",
  },
  {
    code: "GENERAL",
    name: "General Member",
    feeMinor: 500_00,
    description: "Full membership for runners and walkers of every pace.",
    benefits: ["All weekly group runs", "Member pricing on club events", "Training plans and coaching sessions", "Member WhatsApp updates (opt-in)"],
    eligibility: "Open to everyone aged 18 and above.",
  },
  {
    code: "STUDENT",
    name: "Student Member",
    feeMinor: 250_00,
    description: "Discounted membership for full-time students.",
    benefits: ["All weekly group runs", "Member pricing on club events", "Training plans and coaching sessions"],
    eligibility: "Full-time students. Institution and student ID required.",
    requiresStudentVerification: true,
  },
  {
    code: "VOLUNTEER",
    name: "Volunteer Member",
    feeMinor: 0,
    description: "For people who power race days and club runs as marshals, pacers and crew.",
    benefits: ["Volunteer roster access", "Volunteer recognition", "Free entry to volunteer briefings"],
    eligibility: "Commit to volunteering at club events.",
  },
  {
    code: "HONORARY",
    name: "Honorary Member",
    feeMinor: 0,
    description: "Conferred by the committee on people who have made an outstanding contribution.",
    benefits: ["Lifetime recognition", "Invitation to club events"],
    eligibility: "By committee invitation. Applications are reviewed individually.",
    requiresApproval: true,
  },
] as const;

type Tpl = { key: string; name: string; category?: MessageCategory; subject: string; text: string; waParams: string[] };

const TEMPLATES: Tpl[] = [
  {
    key: "membership.application.received",
    name: "Membership application received",
    subject: "We received your {{clubName}} application ({{referenceNo}})",
    text: "Hi {{name}},\n\nThanks for applying to join {{clubName}} as a {{planName}}. Your reference number is {{referenceNo}}.\n\nWe will review your application and let you know the outcome. Keep this reference for any questions.\n\nSee you on the road!",
    waParams: ["name", "planName", "referenceNo"],
  },
  {
    key: "membership.application.admin_alert",
    name: "New application alert (admins)",
    subject: "New membership application: {{applicantName}} ({{planName}})",
    text: "A new membership application needs review.\n\nName: {{applicantName}}\nPlan: {{planName}} ({{fee}})\nReference: {{referenceNo}}\nEmail: {{applicantEmail}}\nPhone: {{applicantPhone}}\n\nReview: {{reviewUrl}}",
    waParams: ["applicantName", "planName", "referenceNo"],
  },
  {
    key: "membership.approved",
    name: "Membership approved — payment due",
    subject: "Your {{clubName}} application is approved — complete payment",
    text: "Hi {{name}},\n\nGood news — your {{planName}} application ({{referenceNo}}) has been approved.\n\nTo activate your membership, please complete the membership fee of {{fee}}. Payment reference: {{paymentReference}}.\nCheck your payment status: {{statusUrl}}\n\n{{note}}",
    waParams: ["name", "planName", "fee", "paymentReference"],
  },
  {
    key: "membership.rejected",
    name: "Membership not approved",
    subject: "Update on your {{clubName}} application ({{referenceNo}})",
    text: "Hi {{name}},\n\nThank you for your interest in {{clubName}}. We are unable to approve your {{planName}} application ({{referenceNo}}) at this time.\n\nReason: {{note}}\n\nYou are welcome to contact us if you have questions.",
    waParams: ["name", "referenceNo"],
  },
  {
    key: "membership.activated",
    name: "Membership active — welcome",
    subject: "Welcome to {{clubName}}! Membership {{membershipNo}}",
    text: "Hi {{name}},\n\nYour {{planName}} membership is now active. Your membership number is {{membershipNo}}.\n\nCheck the events page for upcoming group runs: {{appUrl}}/events\n\nWelcome to the club!",
    waParams: ["name", "planName", "membershipNo"],
  },
  {
    key: "event.registration.confirmed",
    name: "Event registration confirmed",
    subject: "You're registered: {{eventTitle}} ({{registrationNo}})",
    text: "Hi {{name}},\n\nYou're confirmed for {{eventTitle}} — {{category}}.\n\nDate: {{eventDate}}\nVenue: {{venue}}\nRegistration number: {{registrationNo}}\n\nEvent details: {{eventUrl}}",
    waParams: ["name", "eventTitle", "category", "eventDate", "registrationNo"],
  },
  {
    key: "event.registration.pending_payment",
    name: "Event registration — payment pending",
    subject: "Complete payment for {{eventTitle}} ({{registrationNo}})",
    text: "Hi {{name}},\n\nYour place in {{eventTitle}} — {{category}} is reserved. Your registration is confirmed once the entry fee of {{fee}} is paid.\n\nPayment reference: {{paymentReference}}\nPayment status: {{statusUrl}}",
    waParams: ["name", "eventTitle", "fee", "paymentReference"],
  },
  {
    key: "event.registration.waitlisted",
    name: "Event registration — waitlisted",
    subject: "You're on the waitlist for {{eventTitle}}",
    text: "Hi {{name}},\n\n{{eventTitle}} — {{category}} is currently full, so you have been added to the waitlist ({{registrationNo}}). We will notify you if a place opens up.",
    waParams: ["name", "eventTitle", "registrationNo"],
  },
  {
    key: "event.registration.promoted",
    name: "Waitlist — place available",
    subject: "A place opened up for {{eventTitle}}",
    text: "Hi {{name}},\n\nGood news — a place opened up and you have moved off the waitlist for {{eventTitle}} — {{category}} ({{registrationNo}}).\n\nIf an entry fee applies ({{fee}}), please complete payment: {{statusUrl}}",
    waParams: ["name", "eventTitle", "registrationNo"],
  },
  {
    key: "event.registration.cancelled",
    name: "Event registration cancelled",
    subject: "Registration cancelled: {{eventTitle}} ({{registrationNo}})",
    text: "Hi {{name}},\n\nYour registration {{registrationNo}} for {{eventTitle}} has been cancelled.\n\nReason: {{reason}}\n\nContact us if you think this is a mistake.",
    waParams: ["name", "eventTitle", "registrationNo"],
  },
  {
    key: "event.reminder",
    name: "Event reminder",
    subject: "Reminder: {{eventTitle}} is coming up",
    text: "Hi {{name}},\n\nA reminder that {{eventTitle}} ({{category}}) starts {{eventDate}} at {{venue}}.\n\nRegistration number: {{registrationNo}}\nDetails: {{eventUrl}}",
    waParams: ["name", "eventTitle", "eventDate", "venue"],
  },
  {
    key: "event.updated",
    name: "Event update / schedule change",
    subject: "Important update: {{eventTitle}}",
    text: "Hi {{name}},\n\nThere is an update for {{eventTitle}} ({{eventDate}}):\n\n{{message}}\n\nDetails: {{eventUrl}}",
    waParams: ["name", "eventTitle", "message"],
  },
  {
    key: "event.cancelled",
    name: "Event cancelled",
    subject: "Cancelled: {{eventTitle}}",
    text: "Hi {{name}},\n\nWe're sorry — {{eventTitle}} scheduled for {{eventDate}} has been cancelled.\n\nReason: {{reason}}\n\nIf you paid an entry fee, we will contact you about refunds according to the event's cancellation policy.",
    waParams: ["name", "eventTitle", "reason"],
  },
  {
    key: "contact.message.admin_alert",
    name: "Contact form message (admins)",
    subject: "Website message: {{subject}}",
    text: "New message from the website contact form.\n\nFrom: {{senderName}} <{{senderEmail}}>\nSubject: {{subject}}\n\n{{message}}\n\nReply from the admin panel: {{appUrl}}/admin/messages",
    waParams: ["senderName", "subject"],
  },
  {
    key: "payment.confirmed",
    name: "Payment received",
    subject: "Payment received ({{paymentReference}})",
    text: "Hi {{name}},\n\nWe have received your payment of {{amount}}. Payment reference: {{paymentReference}}.\n\nStatus: {{statusUrl}}",
    waParams: ["name", "amount", "paymentReference"],
  },
  {
    key: "payment.failed",
    name: "Payment failed",
    subject: "Payment not completed ({{paymentReference}})",
    text: "Hi {{name}},\n\nYour payment of {{amount}} did not go through. Your registration is still saved — you can try again here: {{statusUrl}}",
    waParams: ["name", "amount", "statusUrl"],
  },
  {
    key: "payment.refunded",
    name: "Refund processed",
    subject: "Refund processed ({{paymentReference}})",
    text: "Hi {{name}},\n\nA refund of {{amount}} has been recorded for payment {{paymentReference}}. Depending on your bank it may take several working days to appear.",
    waParams: ["name", "amount", "paymentReference"],
  },
];

async function seedAccess() {
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { key }, update: { description }, create: { key, description } });
  }
  const perms = await prisma.permission.findMany();
  const byKey = new Map(perms.map((p) => [p.key, p.id]));
  for (const [key, role] of Object.entries(ROLES)) {
    const r = await prisma.role.upsert({ where: { key }, update: { name: role.name, description: role.description }, create: { key, name: role.name, description: role.description } });
    await prisma.rolePermission.deleteMany({ where: { roleId: r.id } });
    await prisma.rolePermission.createMany({ data: role.permissions.map((p) => ({ roleId: r.id, permissionId: byKey.get(p)! })) });
  }
}

async function seedAdmin() {
  if (process.env.ADMIN_BOOTSTRAP_ENABLED !== "true") return;
  if ((await prisma.user.count()) > 0) return;
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
  if (!email || password.length < 12) throw new Error("ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD (min 12 chars) are required when ADMIN_BOOTSTRAP_ENABLED=true");
  const role = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
  await prisma.user.create({ data: { email, name: "Super Admin", passwordHash: await hashPassword(password), roles: { create: { roleId: role.id } } } });
  console.log(`  ✓ bootstrap Super Admin created: ${email} (set ADMIN_BOOTSTRAP_ENABLED=false now)`);
}

async function seedPlans() {
  for (const [i, p] of INITIAL_PLANS.entries()) {
    await prisma.membershipPlan.upsert({
      where: { code: p.code },
      update: {},
      create: {
        code: p.code,
        name: p.name,
        description: p.description,
        feeMinor: p.feeMinor,
        currency: "INR",
        benefits: [...p.benefits],
        eligibility: p.eligibility,
        requiresStudentVerification: "requiresStudentVerification" in p ? p.requiresStudentVerification : false,
        requiresApproval: "requiresApproval" in p ? p.requiresApproval : null,
        sortOrder: i,
      },
    });
  }
}

async function seedSettings() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.websiteSetting.upsert({ where: { key }, update: {}, create: { key, value: value as Prisma.InputJsonValue } });
  }
}

type SectionSeed = { key: string; title?: string; subtitle?: string; body?: string; items?: { label: string; value?: string; detail?: string }[]; ctaLabel?: string; ctaHref?: string };

const PAGES: { slug: string; title: string; metaDescription: string; body?: string; sections?: SectionSeed[] }[] = [
  {
    slug: "home",
    title: "Home",
    metaDescription: "Koduvai Runners — a community running club for every pace. Group runs, training, races and marathons.",
    sections: [
      { key: "hero", title: "Every pace has a place.", subtitle: "Koduvai Runners is a community running club for walkers, first-timers and marathoners. Show up, run together, get better.", ctaLabel: "Join the club", ctaHref: "/join" },
      {
        key: "intro",
        title: "More than miles",
        body: "We meet before sunrise, run the roads and trails around Koduvai, and finish over filter coffee. Whether you're training for your first 5K or chasing a marathon PB, you'll find people running your pace.",
      },
      {
        key: "highlights",
        title: "Why runners join",
        items: [
          { label: "Group runs every week", detail: "Paced groups from easy jog to tempo, so nobody runs alone." },
          { label: "Structured training", detail: "Plans and coached sessions for 5K through marathon." },
          { label: "Race-day community", detail: "Travel together, cheer together, celebrate together." },
          { label: "Safe and welcoming", detail: "Marshalled routes, buddy system and a no-drop policy." },
        ],
      },
      { key: "stats", title: "The club in numbers", items: [{ label: "Weekly group runs", value: "3" }, { label: "Paced groups", value: "4" }, { label: "Membership types", value: "5" }] },
      { key: "cta", title: "Ready for your first run with us?", subtitle: "Pick a membership, fill in a two-minute form, and we'll see you at the start line.", ctaLabel: "See membership options", ctaHref: "/membership" },
    ],
  },
  {
    slug: "about",
    title: "About Us",
    metaDescription: "The story, mission and people behind Koduvai Runners.",
    sections: [
      { key: "story", title: "Our story", body: "Koduvai Runners started with a handful of neighbours who wanted company on early-morning runs. Edit this section in **Admin → Content → Pages** to tell your club's history." },
      { key: "mission", title: "Mission", body: "To make running accessible, safe and social for everyone in and around Koduvai." },
      { key: "vision", title: "Vision", body: "A healthier, more connected community where every resident has people to run with." },
      {
        key: "values",
        title: "Our values",
        items: [
          { label: "Inclusive", detail: "Every pace, age and background is welcome." },
          { label: "Safe", detail: "Marshalled routes, buddy system, emergency readiness." },
          { label: "Consistent", detail: "Small steps, every week." },
          { label: "Community first", detail: "We volunteer, give back and look out for each other." },
        ],
      },
    ],
  },
  {
    slug: "membership",
    title: "Membership",
    metaDescription: "Koduvai Runners membership types, fees, benefits and how to join.",
    sections: [
      { key: "intro", title: "Choose your membership", subtitle: "Simple, transparent fees. Free memberships for volunteers and honorary members." },
      {
        key: "faq",
        title: "Membership FAQs",
        items: [
          { label: "Do I need to be fast to join?", detail: "Not at all. We have paced groups for every level, including walkers." },
          { label: "How does approval work?", detail: "A committee member reviews each application, usually within a few days. You'll get an email (and WhatsApp, if you opt in) with the outcome." },
          { label: "How do I pay?", detail: "Once approved, you'll receive a payment reference. Online payment will be enabled soon; until then the club will share payment instructions." },
          { label: "Can I change my membership type later?", detail: "Yes — contact the club and we'll help you switch." },
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    metaDescription: "How Koduvai Runners collects, uses and protects your personal data.",
    body: `**Template — review with your committee and legal adviser before publishing.**

## What we collect
Name, contact details, date of birth (where required), emergency contact, running experience, and event-specific information such as T-shirt size. For events, a brief medical/safety declaration — we do not ask for detailed medical records.

## Why we collect it
To process memberships and event registrations, keep runners safe on event day, and send service messages about your registration.

## Communications
Service messages (confirmations, schedule changes, cancellations) are sent by email. WhatsApp messages and optional club announcements are only sent if you opt in, and you can opt out at any time by replying STOP on WhatsApp or using the unsubscribe link in emails.

## Who can see your data
Only authorised club officers, according to their role. Emergency contacts and medical notes are restricted to event managers.

## Retention
See our data retention policy: application and registration records are kept while needed for club administration and legal obligations, then deleted or anonymised.

## Your rights
Contact us to access, correct or delete your personal data.`,
  },
  {
    slug: "terms",
    title: "Terms & Conditions",
    metaDescription: "Membership and website terms for Koduvai Runners.",
    body: `**Template — review with your committee before publishing.**

1. Membership is subject to approval by the club committee.
2. Members agree to follow the club code of conduct, route safety instructions and marshal directions.
3. Membership fees are as published on the membership page at the time of application.
4. The club may suspend or cancel a membership for conduct that endangers others or breaches the code of conduct.
5. Participation in club activities is at your own risk; you are responsible for ensuring you are fit to run.`,
  },
  {
    slug: "refund-policy",
    title: "Refund Policy",
    metaDescription: "Refund policy for memberships and event registrations.",
    body: `**Template — review with your committee before publishing.**

- **Memberships:** fees are refundable if your application is not approved. Once a membership is active, fees are non-refundable.
- **Events:** each event lists its own cancellation policy. If the club cancels an event, entry fees will be refunded or transferred as announced.
- Refunds are made to the original payment method and may take several working days.`,
  },
  {
    slug: "waiver",
    title: "Event Waiver",
    metaDescription: "General participation waiver for Koduvai Runners events.",
    body: `**Template — review with your committee and legal adviser before publishing.**

By registering for a Koduvai Runners event I confirm that I am medically fit to take part, that I understand running involves physical exertion and risk of injury, and that I will follow the instructions of race officials and marshals. I consent to receive first aid if needed. Event-specific waivers shown on the registration form also apply.`,
  },
];

async function seedPages() {
  for (const p of PAGES) {
    const page = await prisma.websitePage.upsert({
      where: { slug: p.slug },
      update: {},
      create: { slug: p.slug, title: p.title, metaDescription: p.metaDescription, body: p.body ?? null },
    });
    for (const [i, s] of (p.sections ?? []).entries()) {
      await prisma.contentSection.upsert({
        where: { pageId_key: { pageId: page.id, key: s.key } },
        update: {},
        create: { pageId: page.id, key: s.key, title: s.title, subtitle: s.subtitle, body: s.body, items: s.items ?? [], ctaLabel: s.ctaLabel, ctaHref: s.ctaHref, sortOrder: i },
      });
    }
  }
}

async function seedNavigation() {
  if ((await prisma.navigationLink.count()) > 0) return;
  const header = [
    ["About", "/about"],
    ["Membership", "/membership"],
    ["Events", "/events"],
    ["Marathons", "/marathons"],
    ["News", "/news"],
    ["Gallery", "/gallery"],
    ["Contact", "/contact"],
  ];
  const footer = [
    ["Privacy Policy", "/privacy"],
    ["Terms & Conditions", "/terms"],
    ["Refund Policy", "/refund-policy"],
    ["Event Waiver", "/waiver"],
    ["Check application status", "/join/status"],
  ];
  await prisma.navigationLink.createMany({
    data: [
      ...header.map(([label, href], i) => ({ label, href, location: "HEADER" as const, sortOrder: i })),
      ...footer.map(([label, href], i) => ({ label, href, location: "FOOTER" as const, sortOrder: i })),
    ],
  });
}

async function seedTemplates() {
  for (const t of TEMPLATES) {
    for (const channel of ["EMAIL", "WHATSAPP"] as Channel[]) {
      await prisma.notificationTemplate.upsert({
        where: { key_channel: { key: t.key, channel } },
        update: {},
        create: {
          key: t.key,
          channel,
          name: t.name,
          category: t.category ?? "OPERATIONAL",
          subject: channel === "EMAIL" ? t.subject : null,
          bodyText: t.text,
          description:
            channel === "WHATSAPP"
              ? `Create and get this template approved in WhatsApp Manager, then enter its name here. Variables in order: ${t.waParams.map((p, i) => `{{${i + 1}}}=${p}`).join(", ")}.`
              : null,
          whatsappTemplateName: null, // set after Meta approval — until then WhatsApp sends are SKIPPED
          whatsappLanguage: channel === "WHATSAPP" ? "en" : null,
          whatsappParams: channel === "WHATSAPP" ? t.waParams : [],
        },
      });
    }
  }
}

async function seedSample() {
  // Anchor sample dates to 05:30 IST (00:00 UTC) so they look like real early-morning runs.
  const today = new Date();
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const day = 86_400_000;
  const existing = await prisma.event.count();
  if (existing > 0) return;
  await prisma.event.create({
    data: {
      slug: "sample-sunrise-half-marathon",
      title: "Sunrise Half Marathon (sample)",
      summary: "Our flagship road race through the villages around Koduvai — 5K, 10K and 21.1K.",
      description:
        "**Sample event created by the seed script — edit or delete it in Admin → Events.**\n\nA fast, flat, fully marshalled course with hydration every 2.5 km, timing chips, finisher medals and breakfast at the finish.",
      type: "MARATHON",
      status: "PUBLISHED",
      startsAt: new Date(now + 60 * day),
      venueName: "Koduvai Town Grounds",
      venueAddress: "Koduvai, Tiruppur District, Tamil Nadu",
      city: "Koduvai",
      routeDescription: "Out-and-back on the Koduvai–Avinashipalayam road. Flat, tarmac, closed to traffic for the first 2 hours.",
      eligibility: "21.1K: 18+ on race day. 10K: 16+. 5K: 10+ (under-18s need guardian consent).",
      terms: "Bibs are non-transferable. Follow marshal instructions at all times. Cut-off for 21.1K is 3h 30m.",
      waiverText: "I confirm I am fit to participate and accept the risks of running a road race.",
      medicalDeclarationText: "I declare I have no medical condition that makes it unsafe for me to run this distance, or I have medical clearance.",
      cancellationPolicy: "Cancellations up to 14 days before race day receive a 50% refund. No refunds after that.",
      schedule: [
        { time: "05:00", label: "Bib collection & bag drop" },
        { time: "05:45", label: "21.1K start" },
        { time: "06:15", label: "10K start" },
        { time: "06:30", label: "5K start" },
        { time: "09:30", label: "Prize ceremony" },
      ],
      registrationEnabled: true,
      registrationClosesAt: new Date(now + 50 * day),
      capacity: 500,
      waitlistEnabled: true,
      volunteersEnabled: true,
      collectDateOfBirth: true,
      collectGender: true,
      collectTshirtSize: true,
      tshirtSizes: ["XS", "S", "M", "L", "XL", "XXL"],
      categories: {
        create: [
          { name: "21.1K Half Marathon", distanceKm: "21.1", feeMinor: 900_00, capacity: 200, minAge: 18, startTime: "05:45", sortOrder: 0 },
          { name: "10K Run", distanceKm: "10", feeMinor: 600_00, capacity: 200, minAge: 16, startTime: "06:15", sortOrder: 1 },
          { name: "5K Fun Run", distanceKm: "5", feeMinor: 300_00, capacity: 100, minAge: 10, startTime: "06:30", sortOrder: 2 },
        ],
      },
      customFields: {
        create: [
          { key: "club", label: "Running club (if any)", type: "TEXT", sortOrder: 0 },
          { key: "first_race", label: "Is this your first race at this distance?", type: "SELECT", options: ["Yes", "No"], required: true, sortOrder: 1 },
        ],
      },
    },
  });
  await prisma.event.create({
    data: {
      slug: "sample-sunday-long-run",
      title: "Sunday Community Long Run (sample)",
      summary: "Free weekly long run with paced groups from 5K to 16K. Everyone welcome.",
      description: "**Sample event — edit or delete it in Admin → Events.**\n\nMeet at the temple junction. Pacers for 7:30, 6:30 and 5:45 min/km.",
      type: "CLUB_RUN",
      status: "PUBLISHED",
      startsAt: new Date(now + 5 * day),
      venueName: "Temple Junction",
      city: "Koduvai",
      registrationEnabled: true,
      capacity: 60,
      categories: {
        create: [
          { name: "Easy group (5K)", distanceKm: "5", feeMinor: 0, sortOrder: 0 },
          { name: "Steady group (10K)", distanceKm: "10", feeMinor: 0, sortOrder: 1 },
          { name: "Long group (16K)", distanceKm: "16", feeMinor: 0, sortOrder: 2 },
        ],
      },
    },
  });
  await prisma.newsPost.upsert({
    where: { slug: "welcome-to-our-new-website" },
    update: {},
    create: {
      slug: "welcome-to-our-new-website",
      title: "Welcome to our new website",
      excerpt: "Membership applications and event registrations are now online.",
      body: "You can now apply for membership and register for club events online. Online payments will be switched on soon — until then, approved applicants will receive payment instructions from the club.\n\n*Sample post — edit or delete in Admin → Content → News.*",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  console.log("  ✓ sample events and news created (remove before launch)");
}

async function main() {
  console.log("Seeding…");
  await seedAccess();
  await seedPlans();
  await seedSettings();
  await seedPages();
  await seedNavigation();
  await seedTemplates();
  await seedAdmin();
  if (withSample) await seedSample();
  console.log("Seed complete.");
}

if (process.argv[1]?.endsWith("seed.ts")) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

export { main as seed };
