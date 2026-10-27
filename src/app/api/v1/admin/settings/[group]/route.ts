import { z } from "zod";
import { api, ok, parseJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { badRequest } from "@/lib/errors";
import { safeUrl } from "@/lib/url";
import { DEFAULT_SETTINGS, loadSettings, saveSettingsGroup, type SiteSettings } from "@/server/services/settings";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const link = z.string().max(500).transform((v) => safeUrl(v) ?? "");
const schemas = {
  branding: z.object({ clubName: z.string().min(1).max(80), tagline: z.string().max(160), logoUrl: link, heroImageUrl: link, brandColor: hex, brandDarkColor: hex, inkColor: hex, accentColor: hex, footerText: z.string().max(300) }).partial(),
  contact: z.object({ email: z.string().max(200), phone: z.string().max(40), whatsapp: z.string().max(40), address: z.string().max(300), mapEmbedUrl: link, meetingPoint: z.string().max(200), hours: z.string().max(200) }).partial(),
  social: z.object({ instagram: link, facebook: link, x: link, youtube: link, strava: link }).partial(),
  membership: z.object({ applicationsOpen: z.boolean(), requireApproval: z.boolean(), requireDateOfBirth: z.boolean(), requireEmergencyContact: z.boolean(), currency: z.string().length(3).toUpperCase(), renewalsEnabled: z.boolean(), renewalReminderDays: z.number().int().min(0).max(365) }).partial(),
  seo: z.object({ defaultTitle: z.string().max(120), defaultDescription: z.string().max(300) }).partial(),
} as const;

export const GET = api<{ params: Promise<{ group: string }> }>(async (_req, { params }) => {
  await requirePermission("settings.manage");
  const group = (await params).group as keyof SiteSettings;
  if (!(group in DEFAULT_SETTINGS)) throw badRequest("Unknown settings group");
  return ok((await loadSettings())[group]);
});

export const PUT = api<{ params: Promise<{ group: string }> }>(async (req, { params }) => {
  const user = await requirePermission("settings.manage");
  const group = (await params).group as keyof typeof schemas;
  if (!(group in schemas)) throw badRequest("Unknown settings group");
  const patch = await parseJson(req, schemas[group]);
  const merged = { ...(await loadSettings())[group], ...patch };
  await saveSettingsGroup(group, merged as never, user.id);
  await audit({ actorId: user.id, action: `settings.${group}.updated`, entityType: "website_settings", entityId: group, metadata: { via: "api" } });
  return ok(merged);
});
