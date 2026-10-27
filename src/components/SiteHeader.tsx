"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = { label: string; href: string };

export function SiteHeader({ clubName, logoUrl, links }: { clubName: string; logoUrl: string; links: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-ink/95 text-white backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-brand-ink">
        Skip to content
      </a>
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-bold uppercase tracking-wide text-white">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-brand text-base">{clubName.charAt(0)}</span>
          )}
          <span>{clubName}</span>
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={`rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10 ${isActive(l.href) ? "text-brand-accent" : "text-slate-100"}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/join" className="btn-primary hidden sm:inline-flex">
            Join the club
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-white/10 lg:hidden">
          <ul className="container-page flex flex-col py-3">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className="block rounded-lg px-3 py-3 text-base font-medium hover:bg-white/10">
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 px-3">
              <Link href="/join" className="btn-primary w-full">
                Join the club
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
