/** Shared Zod schemas — used by client forms (pre-validation) and server handlers (authoritative). */
import { z } from "zod";
import { normalizePhone, normalizeEmail } from "@/lib/phone";

export const emailField = z.string().trim().min(1, "Email is required").max(254).email("Enter a valid email address").transform(normalizeEmail);

export const phoneField = z
  .string()
  .trim()
  .min(1, "Mobile number is required")
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid mobile number with country code, e.g. +91 98765 43210" });
      return z.NEVER;
    }
    return n;
  });

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid phone number with country code" });
      return z.NEVER;
    }
    return n;
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .transform((v) => new Date(`${v}T00:00:00Z`))
  .refine((d) => !Number.isNaN(d.getTime()) && d < new Date() && d.getUTCFullYear() > 1900, "Enter a valid date of birth");

const mustAccept = (msg: string) => z.literal(true, { errorMap: () => ({ message: msg }) });

export const EXPERIENCE_LEVELS = ["New to running", "Beginner (up to 5K)", "Intermediate (10K–21K)", "Advanced (marathon+)", "Walker"] as const;
export const INTERESTS = ["Weekend long runs", "Weekday training", "Trail running", "Marathons", "Social runs", "Volunteering", "Coaching"] as const;

export const membershipApplicationSchema = z
  .object({
    planId: z.string().uuid("Choose a membership type"),
    fullName: z.string().trim().min(2, "Enter your full name").max(120),
    email: emailField,
    phone: phoneField,
    dateOfBirth: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .pipe(dateField.optional()),
    city: z.string().trim().min(2, "Enter your city").max(80),
    address: optionalText(300),
    experienceLevel: z.enum(EXPERIENCE_LEVELS, { errorMap: () => ({ message: "Choose your running experience" }) }),
    interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length).default([]),
    emergencyName: optionalText(120),
    emergencyPhone: optionalPhone,
    studentInstitution: optionalText(160),
    studentIdNumber: optionalText(60),
    referralSource: optionalText(120),
    acceptTerms: mustAccept("You must accept the membership terms"),
    acceptPrivacy: mustAccept("You must accept the privacy policy"),
    acceptDeclaration: mustAccept("Please confirm the declaration"),
    consentWhatsapp: z.boolean().default(false),
    consentMarketingEmail: z.boolean().default(false),
    website: z.string().max(0, "Leave this field empty").optional(), // honeypot
  })
  .refine((d) => !d.emergencyName === !d.emergencyPhone, {
    message: "Provide both emergency contact name and phone, or neither",
    path: ["emergencyPhone"],
  });
export type MembershipApplicationInput = z.infer<typeof membershipApplicationSchema>;

export const eventRegistrationSchema = z.object({
  eventId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  participantType: z.enum(["PARTICIPANT", "VOLUNTEER"]).default("PARTICIPANT"),
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  email: emailField,
  phone: phoneField,
  dateOfBirth: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(dateField.optional()),
  gender: optionalText(40),
  emergencyName: z.string().trim().min(2, "Emergency contact name is required").max(120),
  emergencyPhone: phoneField,
  medicalDeclaration: z.boolean().default(false),
  medicalNotes: optionalText(500),
  tshirtSize: optionalText(10),
  accessibilityNeeds: optionalText(500),
  acceptTerms: mustAccept("You must accept the event terms"),
  acceptWaiver: z.boolean().default(false),
  consentWhatsapp: z.boolean().default(false),
  consentMarketingEmail: z.boolean().default(false),
  customFields: z.record(z.string(), z.string().max(1000)).default({}),
  website: z.string().max(0).optional(),
});
export type EventRegistrationInput = z.infer<typeof eventRegistrationSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: emailField,
  phone: optionalText(30),
  subject: z.string().trim().min(2, "Enter a subject").max(160),
  message: z.string().trim().min(10, "Message is too short").max(4000),
  website: z.string().max(0).optional(),
});

export const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: optionalText(1000),
});

export const AUDIENCE_TYPES = ["ALL_ACTIVE_MEMBERS", "ALL_APPROVED_OR_ACTIVE", "PLAN", "EVENT_PARTICIPANTS", "EVENT_VOLUNTEERS"] as const;
export const audienceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ALL_ACTIVE_MEMBERS") }),
  z.object({ type: z.literal("ALL_APPROVED_OR_ACTIVE") }),
  z.object({ type: z.literal("PLAN"), planId: z.string().uuid() }),
  z.object({ type: z.literal("EVENT_PARTICIPANTS"), eventId: z.string().uuid() }),
  z.object({ type: z.literal("EVENT_VOLUNTEERS"), eventId: z.string().uuid() }),
]);
export type Audience = z.infer<typeof audienceSchema>;

export const campaignSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    subject: optionalText(200),
    bodyText: z.string().trim().min(1, "Message text is required").max(5000),
    bodyHtml: optionalText(50000),
    whatsappTemplateName: optionalText(120),
    whatsappLanguage: optionalText(20),
    channels: z.array(z.enum(["EMAIL", "WHATSAPP"])).min(1, "Choose at least one channel"),
    category: z.enum(["OPERATIONAL", "PROMOTIONAL"]),
    audience: audienceSchema,
    scheduledAt: z.coerce.date().optional(),
  })
  .refine((c) => !c.channels.includes("EMAIL") || !!c.subject, { message: "Email subject is required", path: ["subject"] })
  .refine((c) => !c.channels.includes("WHATSAPP") || !!c.whatsappTemplateName, {
    message: "WhatsApp requires an approved template name (WhatsApp policy for business-initiated messages)",
    path: ["whatsappTemplateName"],
  });
export type CampaignInput = z.infer<typeof campaignSchema>;

export const planSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(1).max(1000),
  feeMinor: z.number().int().min(0),
  currency: z.string().length(3).toUpperCase().default("INR"),
  benefits: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  eligibility: z.string().trim().max(500).nullable().optional(),
  requiresStudentVerification: z.boolean().default(false),
  requiresApproval: z.boolean().nullable().default(null),
  durationMonths: z.number().int().min(1).max(120).nullable().default(null),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const httpUrl = z.string().url().refine((u) => /^https?:\/\//.test(u), "Must be an http(s) link");

export const eventCreateSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z.string().trim().regex(/^[a-z0-9-]{3,80}$/, "lowercase letters, numbers and dashes").optional(),
  summary: z.string().trim().min(1).max(300),
  description: z.string().max(20000).default(""),
  type: z.enum(["CLUB_RUN", "MARATHON", "TRAINING", "SOCIAL", "VOLUNTEER", "OTHER"]).default("CLUB_RUN"),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  venueName: z.string().trim().min(1).max(160),
  venueAddress: z.string().max(300).optional(),
  city: z.string().trim().min(1).max(80),
  mapUrl: httpUrl.optional(),
  registrationEnabled: z.boolean().default(true),
  registrationOpensAt: z.coerce.date().optional(),
  registrationClosesAt: z.coerce.date().optional(),
  capacity: z.number().int().min(0).nullable().default(null),
  waitlistEnabled: z.boolean().default(false),
  volunteersEnabled: z.boolean().default(false),
  currency: z.string().length(3).toUpperCase().default("INR"),
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  distanceKm: z.number().positive().max(1000).optional(),
  feeMinor: z.number().int().min(0),
  capacity: z.number().int().min(0).nullable().default(null),
  minAge: z.number().int().min(0).max(120).optional(),
  maxAge: z.number().int().min(0).max(120).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sortOrder: z.number().int().default(0),
});
