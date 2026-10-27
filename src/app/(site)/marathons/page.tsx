import type { Metadata } from "next";
import { listPublicEvents } from "@/server/services/events";
import { EventCard } from "@/components/cards";
import { EmptyState, PageHeader, SectionHeading } from "@/components/ui";

export const metadata: Metadata = { title: "Marathons", description: "Club marathons, half marathons and road races — distances, routes and registration." };

export default async function MarathonsPage() {
  const [upcoming, past] = await Promise.all([listPublicEvents({ type: "MARATHON", when: "upcoming" }), listPublicEvents({ type: "MARATHON", when: "past" })]);
  return (
    <>
      <PageHeader eyebrow="Race days" title="Marathons & races" subtitle="Chip-timed road races organised by the club — from 5K fun runs to the half marathon." />
      <div className="container-page space-y-14 py-12">
        <section>
          <SectionHeading title="Upcoming races" />
          {upcoming.length ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
          ) : (
            <div className="mt-6"><EmptyState title="No races announced yet">Our next race will be announced here first.</EmptyState></div>
          )}
        </section>
        {past.length > 0 && (
          <section>
            <SectionHeading title="Past races" />
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{past.slice(0, 6).map((e) => <EventCard key={e.id} event={e} />)}</div>
          </section>
        )}
      </div>
    </>
  );
}
