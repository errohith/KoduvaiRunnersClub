import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getSettings, hexToRgbTriplet } from "@/server/services/settings";
import { getNavigation } from "@/server/services/content";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: s.seo.defaultTitle, template: `%s · ${s.branding.clubName}` },
    description: s.seo.defaultDescription,
    openGraph: { siteName: s.branding.clubName, type: "website" },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, nav] = await Promise.all([getSettings(), getNavigation()]);
  const b = settings.branding;
  // Values are validated hex colours converted to "r g b" triplets — safe to inline.
  const vars = `:root{--brand:${hexToRgbTriplet(b.brandColor)};--brand-dark:${hexToRgbTriplet(b.brandDarkColor)};--ink:${hexToRgbTriplet(b.inkColor)};--accent:${hexToRgbTriplet(b.accentColor)}}`;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: vars }} />
      <SiteHeader clubName={b.clubName} logoUrl={b.logoUrl} links={nav.header.map((l) => ({ label: l.label, href: l.href }))} />
      <main id="main">{children}</main>
      <SiteFooter settings={settings} links={nav.footer.map((l) => ({ label: l.label, href: l.href }))} />
    </>
  );
}
