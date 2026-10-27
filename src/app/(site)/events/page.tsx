import type { Metadata } from "next";
import Link from "next/link";
import { listPublicEvents } from "@/server/services/events";
import { EventCard } from "@/components/cards";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Events", description: "Upcoming and past club runs, training sessions and races." };

const TYPES = [
  ["", "All types"],
  ["CLUB_RUN", "Club runs"],
  ["MARATHON", "Marathons & races"],
  ["TRAINING", "Training"],
  ["SOCIAL", "Social"],
  ["VOLUNTEER", "Volunteering"],
] as const;

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; when?: string; city?: string }> }) {
  const sp = await searchParams;
  const when = sp.when === "past" ? "past" : "upcoming";
  const type = TYPES.some(([v]) => v === sp.type) ? sp.type : "";
  const events = await listPublicEvents({ q: sp.q?.slice(0, 80), type, when, city: sp.city?.slice(0, 60) });
  const tab = (w: string) => `/events?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(type ? { type } : {}), when: w })}`;

  return (
    <>
      <PageHeader eyebrow="Calendar" title="Events" subtitle="Find a group run, training session or race — and register in a couple of minutes." />
      <div className="container-page py-10">
        <form role="search" className="card grid gap-3 p-4 sm:grid-cols-[1fr_200px_auto]" method="get">
          <input type="hidden" name="when" value={when} />
          <div>
            <label htmlFor="q" className="sr-only">Search events</label>
            <input id="q" name="q" defaultValue={sp.q} placeholder="Search by name or venue…" className="input" />
          </div>
          <div>
            <label htmlFor="type" className="sr-only">Event type</label>
            <select id="type" name="type" defaultValue={type} className="input">
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <button className="btn-dark">Search</button>
        </form>

        <nav aria-label="Upcoming or past" className="mt-6 flex gap-2">
          {(["upcoming", "past"] as const).map((w) => (
            <Link key={w} href={tab(w)} aria-current={when === w ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-semibold ${when === w ? "bg-brand-ink text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-400"}`}>
              {w === "upcoming" ? "Upcoming" : "Past events"}
            </Link>
          ))}
        </nav>

        <p className="mt-4 text-sm text-slate-600" aria-live="polite">{events.length} {events.length === 1 ? "event" : "events"} found</p>
        {events.length ? (
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState title="No events match your search">Try a different search, or check past events.</EmptyState>
          </div>
        )}
      </div>
    </>
  );
}
