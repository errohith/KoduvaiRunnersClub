import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPage, section, type SectionItem } from "@/server/services/content";
import { getSettings } from "@/server/services/settings";
import { EventCard, PlanCard } from "@/components/cards";
import { SectionHeading, TrackArt } from "@/components/ui";
import { formatDate } from "@/lib/time";

export default async function HomePage() {
  const now = new Date();
  const [page, settings, events, plans, news, testimonials] = await Promise.all([
    getPage("home"),
    getSettings(),
    prisma.event.findMany({
      where: { status: "PUBLISHED", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 3,
      include: { categories: { where: { isActive: true }, orderBy: { sortOrder: "asc" } }, cover: true },
    }),
    prisma.membershipPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.newsPost.findMany({ where: { status: "PUBLISHED", publishedAt: { lte: now } }, orderBy: { publishedAt: "desc" }, take: 3 }),
    prisma.testimonial.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 3 }),
  ]);
  const hero = section(page, "hero");
  const intro = section(page, "intro");
  const highlights = section(page, "highlights");
  const stats = section(page, "stats");
  const cta = section(page, "cta");
  const heroImage = hero?.image?.url || settings.branding.heroImageUrl;
  const paidPlans = plans.filter((p) => p.feeMinor > 0);
  const featuredId = paidPlans.find((p) => p.code === "GENERAL")?.id ?? paidPlans[0]?.id;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-ink text-white">
        <div className="absolute inset-0">
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImage} alt={hero?.image?.altText ?? ""} className="h-full w-full object-cover opacity-40" />
          ) : (
            <TrackArt className="h-full w-full opacity-70" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-ink via-brand-ink/80 to-transparent" />
        </div>
        <div className="container-page relative py-20 sm:py-28 lg:py-36">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">{settings.branding.tagline}</p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-extrabold uppercase leading-[0.95] text-white sm:text-6xl lg:text-7xl">
            {hero?.title ?? settings.branding.clubName}
          </h1>
          {hero?.subtitle && <p className="mt-6 max-w-xl text-lg text-slate-200">{hero.subtitle}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={hero?.ctaHref ?? "/join"} className="btn-primary px-7 py-3 text-base">
              {hero?.ctaLabel ?? "Join the club"}
            </Link>
            <Link href="/events" className="btn px-7 py-3 text-base text-white ring-1 ring-white/40 hover:bg-white/10">
              Upcoming events
            </Link>
          </div>
        </div>
      </section>

      {/* Intro + stats */}
      {(intro || stats) && (
        <section className="container-page grid gap-10 py-16 lg:grid-cols-5 lg:items-center">
          {intro && (
            <div className="lg:col-span-3">
              <p className="eyebrow">About the club</p>
              <h2 className="mt-2 text-3xl font-bold uppercase sm:text-4xl">{intro.title}</h2>
              {intro.body && <p className="mt-4 text-lg text-slate-600">{intro.body}</p>}
              <Link href="/about" className="mt-5 inline-block font-semibold text-brand hover:underline">
                Our story →
              </Link>
            </div>
          )}
          {stats && (stats.items as SectionItem[]).length > 0 && (
            <dl className="grid grid-cols-3 gap-3 lg:col-span-2">
              {(stats.items as SectionItem[]).map((s) => (
                <div key={s.label} className="card p-4 text-center">
                  <dt className="order-2 mt-1 text-xs font-medium text-slate-600">{s.label}</dt>
                  <dd className="font-display text-4xl font-extrabold text-brand">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}

      {/* Upcoming events */}
      <section className="bg-white py-16">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="On the calendar" title="Upcoming events" subtitle="Group runs, training sessions and race days." />
            <Link href="/events" className="btn-outline">All events</Link>
          </div>
          {events.length ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <p className="mt-8 text-slate-600">New events are announced soon — check back or follow us on social media.</p>
          )}
        </div>
      </section>

      {/* Highlights */}
      {highlights && (
        <section className="container-page py-16">
          <SectionHeading eyebrow="Why join" title={highlights.title ?? "Why runners join"} />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(highlights.items as SectionItem[]).map((h, i) => (
              <div key={h.label} className="card p-6">
                <span aria-hidden className="font-display text-3xl font-extrabold text-brand">0{i + 1}</span>
                <h3 className="mt-2 font-display text-xl font-bold uppercase">{h.label}</h3>
                {h.detail && <p className="mt-2 text-sm text-slate-600">{h.detail}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Membership */}
      <section className="bg-white py-16">
        <div className="container-page">
          <SectionHeading eyebrow="Membership" title="Find your fit" subtitle="Transparent fees, free options for volunteers and honorary members." center />
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {paidPlans.map((p) => (
              <PlanCard key={p.id} plan={p} featured={p.id === featuredId} />
            ))}
          </div>
          {plans.length > paidPlans.length && (
            <p className="mt-6 text-center text-sm text-slate-600">
              Also available: {plans.filter((p) => p.feeMinor === 0).map((p) => p.name).join(" and ")} (free).{" "}
              <Link href="/membership" className="font-semibold text-brand hover:underline">Compare all memberships →</Link>
            </p>
          )}
        </div>
      </section>

      {/* Testimonials — only shown when the club has added real quotes */}
      {testimonials.length > 0 && (
        <section className="container-page py-16">
          <SectionHeading eyebrow="From our runners" title="In their words" center />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.id} className="card p-6">
                <blockquote className="text-slate-700">“{t.quote}”</blockquote>
                <figcaption className="mt-4 text-sm font-semibold text-brand-ink">
                  {t.author}
                  {t.context && <span className="block font-normal text-slate-600">{t.context}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* News */}
      {news.length > 0 && (
        <section className="container-page py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="Club news" title="Latest updates" />
            <Link href="/news" className="btn-outline">All news</Link>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {news.map((n) => (
              <article key={n.id} className="card relative p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand">{n.category} · {formatDate(n.publishedAt)}</p>
                <h3 className="mt-2 font-display text-xl font-bold uppercase leading-tight">
                  <Link href={`/news/${n.slug}`} className="after:absolute after:inset-0">{n.title}</Link>
                </h3>
                {n.excerpt && <p className="mt-2 text-sm text-slate-600">{n.excerpt}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      {cta && (
        <section className="container-page pt-8">
          <div className="stripe-track overflow-hidden rounded-3xl bg-brand px-6 py-12 text-center text-white sm:px-12">
            <h2 className="font-display text-3xl font-extrabold uppercase text-white sm:text-4xl">{cta.title}</h2>
            {cta.subtitle && <p className="mx-auto mt-3 max-w-xl text-white/90">{cta.subtitle}</p>}
            <Link href={cta.ctaHref ?? "/membership"} className="btn mt-6 bg-white px-7 py-3 text-base text-brand-ink hover:bg-slate-100">
              {cta.ctaLabel ?? "Join now"}
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
