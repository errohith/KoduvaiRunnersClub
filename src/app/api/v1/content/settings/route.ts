import { api, ok } from "@/lib/api";
import { loadSettings } from "@/server/services/settings";

export const GET = api(async () => {
  const s = await loadSettings();
  return ok({ branding: s.branding, contact: s.contact, social: s.social, membership: { applicationsOpen: s.membership.applicationsOpen, currency: s.membership.currency } });
});
