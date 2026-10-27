import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type Branding = {
  clubName: string;
  tagline: string;
  logoUrl: string;
  heroImageUrl: string;
  brandColor: string;
  brandDarkColor: string;
  inkColor: string;
  accentColor: string;
  footerText: string;
};
export type Contact = { email: string; phone: string; whatsapp: string; address: string; mapEmbedUrl: string; meetingPoint: string; hours: string };
export type Social = { instagram: string; facebook: string; x: string; youtube: string; strava: string };
export type MembershipSettings = {
  applicationsOpen: boolean;
  requireApproval: boolean;
  requireDateOfBirth: boolean;
  requireEmergencyContact: boolean;
  currency: string;
  renewalsEnabled: boolean;
  renewalReminderDays: number;
};
export type Seo = { defaultTitle: string; defaultDescription: string };

export type SiteSettings = { branding: Branding; contact: Contact; social: Social; membership: MembershipSettings; seo: Seo };

export const DEFAULT_SETTINGS: SiteSettings = {
  branding: {
    clubName: "Koduvai Runners",
    tagline: "Run together. Grow together.",
    logoUrl: "",
    heroImageUrl: "",
    brandColor: "#C2410C",
    brandDarkColor: "#9A3412",
    inkColor: "#14213D",
    accentColor: "#F2A541",
    footerText: "A community running club for every pace.",
  },
  contact: { email: "", phone: "", whatsapp: "", address: "Koduvai, Tiruppur District, Tamil Nadu", mapEmbedUrl: "", meetingPoint: "", hours: "" },
  social: { instagram: "", facebook: "", x: "", youtube: "", strava: "" },
  membership: {
    applicationsOpen: true,
    requireApproval: true,
    requireDateOfBirth: false,
    requireEmergencyContact: true,
    currency: "INR",
    renewalsEnabled: false,
    renewalReminderDays: 14,
  },
  seo: { defaultTitle: "Koduvai Runners — community running club", defaultDescription: "Join Koduvai Runners for group runs, training, races and marathons." },
};

export async function loadSettings(): Promise<SiteSettings> {
  const rows = await prisma.websiteSetting.findMany();
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value as Record<string, unknown>]));
  const merged = {} as Record<keyof SiteSettings, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SiteSettings)[]) {
    merged[key] = { ...DEFAULT_SETTINGS[key], ...(byKey[key] ?? {}) };
  }
  return merged as SiteSettings;
}

/** Request-scoped cache for server components. */
export const getSettings = cache(loadSettings);

export async function saveSettingsGroup<K extends keyof SiteSettings>(key: K, value: SiteSettings[K], actorId: string) {
  await prisma.websiteSetting.upsert({
    where: { key },
    create: { key, value: value as unknown as Prisma.InputJsonValue, updatedById: actorId },
    update: { value: value as unknown as Prisma.InputJsonValue, updatedById: actorId },
  });
}

export function hexToRgbTriplet(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "0 0 0";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
