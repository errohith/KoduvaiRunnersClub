import Link from "next/link";
import type { ReactNode } from "react";

export function SectionHeading({ eyebrow, title, subtitle, center }: { eyebrow?: string; title: string; subtitle?: string | null; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-2 text-3xl font-bold uppercase sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-base text-slate-600 sm:text-lg">{subtitle}</p>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string | null; children?: ReactNode }) {
  return (
    <header className="stripe-track bg-brand-ink text-white">
      <div className="container-page py-12 sm:py-16">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-accent">{eyebrow}</p>}
        <h1 className="mt-2 font-display text-4xl font-extrabold uppercase text-white sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-base text-slate-200 sm:text-lg">{subtitle}</p>}
        {children}
      </div>
    </header>
  );
}

const TONES = {
  gray: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-red-100 text-red-800",
  blue: "bg-sky-100 text-sky-800",
  brand: "bg-brand/10 text-brand-dark",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

const STATUS_TONE: Record<string, Tone> = {
  PENDING: "amber", APPROVED: "blue", ACTIVE: "green", REJECTED: "red", CANCELLED: "gray", EXPIRED: "gray", SUSPENDED: "red",
  CONFIRMED: "green", PENDING_PAYMENT: "amber", WAITLISTED: "blue",
  INITIATED: "blue", SUCCEEDED: "green", FAILED: "red", REFUNDED: "gray", PARTIALLY_REFUNDED: "gray",
  QUEUED: "amber", SENDING: "blue", SENT: "green", DELIVERED: "green", READ: "green", SKIPPED: "gray",
  DRAFT: "gray", PUBLISHED: "green", SCHEDULED: "blue", COMPLETED: "gray", NEW: "amber", ARCHIVED: "gray",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "success" | "warning" | "error"; title?: string; children?: ReactNode }) {
  const cls = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-semibold text-brand-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-600">{children}</div>}
      {action && (
        <Link href={action.href} className="btn-primary mt-4">
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** Decorative fallback when the club has not uploaded a photo yet. */
export function TrackArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 240" className={className} role="img" aria-label="" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="240" fill="rgb(var(--ink))" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <ellipse key={i} cx="200" cy="300" rx={120 + i * 34} ry={150 + i * 26} fill="none" stroke={i === 2 ? "rgb(var(--brand))" : "rgb(255 255 255 / 0.12)"} strokeWidth={i === 2 ? 6 : 3} />
      ))}
      <circle cx="320" cy="60" r="26" fill="rgb(var(--accent))" opacity="0.9" />
    </svg>
  );
}
