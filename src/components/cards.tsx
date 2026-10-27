import Link from "next/link";
import type { Event, EventCategory, MediaAsset, MembershipPlan } from "@prisma/client";
import { formatMoney } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/time";
import { TrackArt } from "./ui";
import { registrationWindow, spotsLeft } from "@/server/services/events";

const TYPE_LABEL: Record<string, string> = { CLUB_RUN: "Club run", MARATHON: "Marathon", TRAINING: "Training", SOCIAL: "Social", VOLUNTEER: "Volunteering", OTHER: "Event" };
export const eventTypeLabel = (t: string) => TYPE_LABEL[t] ?? t;

export function priceRange(categories: Pick<EventCategory, "feeMinor">[], currency: string) {
  if (!categories.length) return null;
  const fees = categories.map((c) => c.feeMinor);
  const min = Math.min(...fees);
  const max = Math.max(...fees);
  if (max === 0) return "Free";
  return min === max ? formatMoney(min, currency) : `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
}

export function EventCard({ event }: { event: Event & { categories: EventCategory[]; cover: MediaAsset | null } }) {
  const window = registrationWindow(event);
  const left = spotsLeft(event.capacity, event.registeredCount);
  const day = formatDate(event.startsAt, { day: "2-digit" });
  const month = formatDate(event.startsAt, { month: "short" });
  return (
    <article className="card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/9] overflow-hidden">
        {event.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.cover.url} alt={event.cover.altText} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <TrackArt className="h-full w-full" />
        )}
        <div className="absolute left-3 top-3 rounded-xl bg-white px-3 py-1.5 text-center shadow">
          <p className="font-display text-2xl font-bold leading-none text-brand-ink">{day}</p>
          <p className="text-[11px] font-bold uppercase text-brand">{month}</p>
        </div>
        <span className="absolute bottom-3 left-3 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-brand-ink shadow">{eventTypeLabel(event.type)}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl font-bold uppercase leading-tight">
          <Link href={`/events/${event.slug}`} className="after:absolute after:inset-0 focus:outline-none">
            <span className="relative">{event.title}</span>
          </Link>
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          {formatTime(event.startsAt)} · {event.venueName}, {event.city}
        </p>
        <p className="mt-3 line-clamp-2 text-sm text-slate-600">{event.summary}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs">
          {event.categories.slice(0, 4).map((c) => (
            <span key={c.id} className="rounded-full border border-slate-200 px-2 py-0.5 font-medium text-slate-600">
              {c.distanceKm ? `${Number(c.distanceKm)}K` : c.name}
            </span>
          ))}
          <span className="ml-auto font-semibold text-brand-ink">{priceRange(event.categories, event.currency)}</span>
        </div>
        <div className="mt-3 text-xs font-medium">
          {event.status === "CANCELLED" ? (
            <span className="text-red-600">Cancelled</span>
          ) : window === "open" ? (
            <span className="text-emerald-700">Registration open{left !== null ? ` · ${left} places left` : ""}</span>
          ) : window === "not_open_yet" ? (
            <span className="text-slate-600">Registration opens {formatDate(event.registrationOpensAt)}</span>
          ) : window === "past" ? (
            <span className="text-slate-600">Event completed</span>
          ) : (
            <span className="text-slate-600">Registration closed</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function PlanCard({ plan, featured }: { plan: MembershipPlan; featured?: boolean }) {
  const free = plan.feeMinor === 0;
  return (
    <article className={`card relative flex flex-col p-6 ${featured ? "border-brand ring-2 ring-brand" : ""}`}>
      {featured && <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">Most popular</span>}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-2xl font-bold uppercase">{plan.name}</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${free ? "bg-emerald-100 text-emerald-800" : "bg-brand/10 text-brand-dark"}`}>{free ? "Free" : "Paid"}</span>
      </div>
      <p className="mt-3">
        <span className="font-display text-4xl font-extrabold text-brand-ink">{free ? "₹0" : formatMoney(plan.feeMinor, plan.currency)}</span>
        {plan.durationMonths ? <span className="text-sm text-slate-600"> / {plan.durationMonths === 12 ? "year" : `${plan.durationMonths} months`}</span> : null}
      </p>
      <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
      <ul className="mt-5 space-y-2 text-sm">
        {plan.benefits.map((b) => (
          <li key={b} className="flex gap-2">
            <svg className="mt-0.5 h-4 w-4 flex-none text-brand" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
            </svg>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {plan.eligibility && <p className="mt-4 text-xs text-slate-600"><span className="font-semibold">Eligibility:</span> {plan.eligibility}</p>}
      <Link href={`/join?plan=${plan.code}`} className={`${featured ? "btn-primary" : "btn-outline"} mt-6`}>
        Apply as {plan.name.replace(/ Member$/, "")}
      </Link>
    </article>
  );
}
