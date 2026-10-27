import Link from "next/link";
import type { SiteSettings } from "@/server/services/settings";

const SOCIAL_LABELS: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", x: "X (Twitter)", youtube: "YouTube", strava: "Strava club" };

export function SiteFooter({ settings, links }: { settings: SiteSettings; links: { label: string; href: string }[] }) {
  const { branding, contact, social } = settings;
  const socials = Object.entries(social).filter(([, v]) => v);
  return (
    <footer className="mt-20 bg-brand-ink text-slate-300">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="font-display text-2xl font-bold uppercase text-white">{branding.clubName}</p>
          <p className="mt-2 max-w-sm text-sm">{branding.footerText}</p>
          <Link href="/join" className="btn-primary mt-5">
            Become a member
          </Link>
        </div>
        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-wider text-white">Contact</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {contact.address && <li>{contact.address}</li>}
            {contact.email && (
              <li>
                <a className="hover:text-white" href={`mailto:${contact.email}`}>{contact.email}</a>
              </li>
            )}
            {contact.phone && (
              <li>
                <a className="hover:text-white" href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</a>
              </li>
            )}
            <li>
              <Link className="hover:text-white" href="/contact">Send us a message →</Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-wider text-white">Club</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {links.map((l) => (
              <li key={l.href}>
                <Link className="hover:text-white" href={l.href}>{l.label}</Link>
              </li>
            ))}
            {socials.map(([k, v]) => (
              <li key={k}>
                <a className="hover:text-white" href={v} target="_blank" rel="noopener noreferrer">{SOCIAL_LABELS[k] ?? k}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-5 text-xs text-slate-400">© {new Date().getFullYear()} {branding.clubName}. All rights reserved.</p>
      </div>
    </footer>
  );
}
