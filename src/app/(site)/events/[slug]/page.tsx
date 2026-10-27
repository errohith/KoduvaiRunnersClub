import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { registrationWindow, spotsLeft } from "@/server/services/events";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, formatTime } from "@/lib/time";
import { Markdown } from "@/components/Markdown";
import { Alert, Badge, TrackArt } from "@/components/ui";
import { eventTypeLabel, priceRange } from "@/components/cards";
import { EventRegistrationForm } from "@/components/forms/EventRegistrationForm";

async function load(slug: string) {
  return prisma.event.findFirst({
    where: { slug, status: { in: ["PUBLISHED", "COMPLETED", "CANCELLED"] } },
    include: { categories: { where: { isActive: true }, orderBy: { sortOrder: "asc" } }, customFields: { orderBy: { sortOrder: "asc" } }, cover: true },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = await load((await params).slug);
  return e ? { title: e.title, description: e.summary, openGraph: { title: e.title, description: e.summary, images: e.cover ? [e.cover.url] : undefined } } : {};
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const e = await load((await params).slug);
  if (!e) notFound();
  const window = registrationWindow(e);
  const eventLeft = spotsLeft(e.capacity, e.registeredCount);
  const schedule = (e.schedule as { time: string; label: string }[]) ?? [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: e.title,
    description: e.summary,
    startDate: e.startsAt.toISOString(),
    endDate: e.endsAt?.toISOString(),
    eventStatus: e.status === "CANCELLED" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: e.venueName, address: e.venueAddress ?? e.city },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="relative overflow-hidden bg-brand-ink text-white">
        <div className="absolute inset-0 opacity-40">
          {e.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.cover.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <TrackArt className="h-full w-full" />
          )}
        </div>
        <div className="container-page relative py-14 sm:py-20">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-300"><Link href="/events" className="hover:text-white">Events</Link> / {eventTypeLabel(e.type)}</nav>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold uppercase text-white sm:text-6xl">{e.title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-200">{e.summary}</p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span><strong className="text-brand-accent">When:</strong> {formatDateTime(e.startsAt)}</span>
            <span><strong className="text-brand-accent">Where:</strong> {e.venueName}, {e.city}</span>
            {priceRange(e.categories, e.currency) && <span><strong className="text-brand-accent">Entry:</strong> {priceRange(e.categories, e.currency)}</span>}
          </div>
          {window === "open" && <a href="#register" className="btn-primary mt-8 px-7 py-3 text-base">Register now</a>}
        </div>
      </header>

      <div className="container-page grid gap-10 py-12 lg:grid-cols-3">
        <div className="min-w-0 space-y-10 lg:col-span-2">
          {e.status === "CANCELLED" && <Alert tone="error" title="This event has been cancelled">{e.cancelledReason}</Alert>}
          <section><Markdown>{e.description}</Markdown></section>

          {e.categories.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold uppercase">Distances & fees</h2>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="table min-w-[520px]">
                  <thead><tr><th scope="col">Category</th><th scope="col">Start</th><th scope="col">Eligibility</th><th scope="col">Fee</th><th scope="col">Availability</th></tr></thead>
                  <tbody>
                    {e.categories.map((c) => {
                      const left = spotsLeft(c.capacity, c.registeredCount);
                      return (
                        <tr key={c.id}>
                          <th scope="row" className="px-3 py-2.5 font-semibold text-brand-ink">{c.name}</th>
                          <td>{c.startTime ?? "—"}</td>
                          <td>{c.minAge ? `${c.minAge}+${c.maxAge ? ` to ${c.maxAge}` : ""}` : "All ages"}</td>
                          <td className="font-semibold">{formatMoney(c.feeMinor, e.currency)}</td>
                          <td>{left === null ? "Open" : left === 0 ? <Badge tone="red">Full</Badge> : `${left} left`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {e.routeDescription && (
            <section>
              <h2 className="text-2xl font-bold uppercase">Route</h2>
              <p className="mt-3 text-slate-700">{e.routeDescription}</p>
              {e.routeMapUrl && <a href={e.routeMapUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-brand hover:underline">View route map →</a>}
            </section>
          )}

          {schedule.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold uppercase">Schedule</h2>
              <ol className="mt-4 border-l-2 border-brand/30 pl-5">
                {schedule.map((s) => (
                  <li key={s.time + s.label} className="relative pb-4 last:pb-0">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-brand" aria-hidden />
                    <span className="font-display text-lg font-bold text-brand-ink">{s.time}</span> <span className="text-slate-700">— {s.label}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(e.eligibility || e.terms || e.cancellationPolicy) && (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold uppercase">Rules & policies</h2>
              {e.eligibility && <div><h3 className="font-sans text-base font-semibold">Eligibility</h3><p className="text-slate-700">{e.eligibility}</p></div>}
              {e.terms && <div><h3 className="font-sans text-base font-semibold">Terms</h3><p className="text-slate-700">{e.terms}</p></div>}
              {e.cancellationPolicy && <div><h3 className="font-sans text-base font-semibold">Cancellation policy</h3><p className="text-slate-700">{e.cancellationPolicy}</p></div>}
            </section>
          )}

          <section id="register" className="scroll-mt-24">
            <h2 className="text-3xl font-bold uppercase">Registration</h2>
            <div className="mt-4">
              {window === "open" ? (
                <EventRegistrationForm
                  event={{
                    id: e.id,
                    waitlistEnabled: e.waitlistEnabled,
                    volunteersEnabled: e.volunteersEnabled,
                    collectDateOfBirth: e.collectDateOfBirth,
                    collectGender: e.collectGender,
                    collectTshirtSize: e.collectTshirtSize,
                    tshirtSizes: e.tshirtSizes,
                    waiverText: e.waiverText,
                    medicalDeclarationText: e.medicalDeclarationText,
                    terms: e.terms,
                    categories: e.categories.map((c) => {
                      const left = spotsLeft(c.capacity, c.registeredCount);
                      return {
                        id: c.id,
                        name: c.name,
                        feeLabel: formatMoney(c.feeMinor, e.currency),
                        full: left === 0 || eventLeft === 0,
                        spotsLeft: eventLeft !== null && (left === null || eventLeft < left) ? eventLeft : left,
                        ageNote: c.minAge || c.maxAge ? `Age ${c.minAge ?? 0}${c.maxAge ? `–${c.maxAge}` : "+"} on race day` : null,
                      };
                    }),
                    customFields: e.customFields.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options, required: f.required, helpText: f.helpText })),
                  }}
                />
              ) : (
                <Alert tone={window === "cancelled" ? "error" : "info"}>
                  {{ not_open_yet: `Registration opens ${formatDateTime(e.registrationOpensAt)}.`, closed: "Registration has closed.", disabled: "Online registration is not available for this event.", cancelled: "This event has been cancelled.", past: "This event has taken place.", open: "" }[window]}
                </Alert>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h2 className="font-display text-xl font-bold uppercase">Key details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-slate-600">Date</dt><dd className="font-medium">{formatDate(e.startsAt, { dateStyle: "full" })}</dd></div>
              <div><dt className="text-slate-600">Time</dt><dd className="font-medium">{formatTime(e.startsAt)}{e.endsAt ? ` – ${formatTime(e.endsAt)}` : ""}</dd></div>
              <div><dt className="text-slate-600">Venue</dt><dd className="font-medium">{e.venueName}{e.venueAddress && <span className="block font-normal text-slate-600">{e.venueAddress}</span>}</dd></div>
              {e.capacity !== null && <div><dt className="text-slate-600">Capacity</dt><dd className="font-medium">{e.capacity} runners{eventLeft !== null && window === "open" ? ` · ${eventLeft} places left` : ""}</dd></div>}
              {e.registrationClosesAt && <div><dt className="text-slate-600">Registration closes</dt><dd className="font-medium">{formatDateTime(e.registrationClosesAt)}</dd></div>}
            </dl>
            {e.mapUrl && <a href={e.mapUrl} target="_blank" rel="noopener noreferrer" className="btn-outline mt-5 w-full">Open in maps</a>}
          </div>
        </aside>
      </div>
    </>
  );
}
