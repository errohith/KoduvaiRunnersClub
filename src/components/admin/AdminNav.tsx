"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavGroup = { label: string; items: { href: string; label: string; badge?: number }[] };

export function AdminNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  return (
    <>
      <button className="btn-outline btn-sm lg:hidden" aria-expanded={open} aria-controls="admin-nav" onClick={() => setOpen((o) => !o)}>Menu</button>
      <nav id="admin-nav" aria-label="Admin" className={`${open ? "block" : "hidden"} lg:block`}>
        {groups.map((g) => (
          <div key={g.label} className="mb-5">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.label}</p>
            <ul className="mt-1 space-y-0.5">
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} onClick={() => setOpen(false)} aria-current={active(i.href) ? "page" : undefined} className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${active(i.href) ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200/70"}`}>
                    {i.label}
                    {!!i.badge && <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{i.badge}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
