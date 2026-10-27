import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhone } from "@/lib/phone";
import { contactSchema, membershipApplicationSchema, campaignSchema } from "@/validation/schemas";

const base = { planId: "8b0f2c2e-1c55-4a2b-9a51-6a2d8e1f0b11", fullName: "Asha K", email: " Asha@Example.COM ", phone: "98765 43210", city: "Koduvai", experienceLevel: "Walker", acceptTerms: true, acceptPrivacy: true, acceptDeclaration: true };

describe("normalisation", () => {
  it("normalises Indian mobile numbers to E.164", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("+91-98765-43210")).toBe("+919876543210");
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
    expect(normalizePhone("12345")).toBeNull();
  });
  it("lower-cases emails", () => expect(normalizeEmail(" A@B.Com ")).toBe("a@b.com"));
});

describe("membership application schema", () => {
  it("accepts a valid application and normalises contact fields", () => {
    const r = membershipApplicationSchema.parse(base);
    expect(r.email).toBe("asha@example.com");
    expect(r.phone).toBe("+919876543210");
    expect(r.consentWhatsapp).toBe(false);
    expect(r.consentMarketingEmail).toBe(false);
  });
  it("requires terms, privacy and declaration", () => {
    const r = membershipApplicationSchema.safeParse({ ...base, acceptTerms: false, acceptPrivacy: undefined });
    expect(r.success).toBe(false);
    const fields = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["acceptTerms", "acceptPrivacy"]));
  });
  it("rejects invalid email/phone and half-filled emergency contacts", () => {
    expect(membershipApplicationSchema.safeParse({ ...base, email: "nope" }).success).toBe(false);
    expect(membershipApplicationSchema.safeParse({ ...base, phone: "123" }).success).toBe(false);
    expect(membershipApplicationSchema.safeParse({ ...base, emergencyName: "Kin" }).success).toBe(false);
  });
  it("rejects bots filling the honeypot", () => {
    expect(membershipApplicationSchema.safeParse({ ...base, website: "http://spam" }).success).toBe(false);
  });
  it("contact form requires a meaningful message", () => {
    expect(contactSchema.safeParse({ name: "A B", email: "a@b.co", subject: "Hi", message: "short" }).success).toBe(false);
  });
});

describe("campaign schema", () => {
  const c = { title: "Monsoon runs", bodyText: "Hello {{name}}", category: "PROMOTIONAL", audience: { type: "ALL_ACTIVE_MEMBERS" } };
  it("requires a subject for email", () => expect(campaignSchema.safeParse({ ...c, channels: ["EMAIL"] }).success).toBe(false));
  it("requires an approved template for WhatsApp", () => {
    expect(campaignSchema.safeParse({ ...c, channels: ["WHATSAPP"] }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...c, channels: ["WHATSAPP"], whatsappTemplateName: "club_announcement" }).success).toBe(true);
  });
});
