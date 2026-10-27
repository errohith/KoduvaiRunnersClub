import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getPage, section, type SectionItem } from "@/server/services/content";
import { Markdown } from "@/components/Markdown";
import { PageHeader, SectionHeading } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const p = await getPage("about");
  return { title: p?.title ?? "About Us", description: p?.metaDescription ?? undefined };
}

export default async function AboutPage() {
  const [page, committee] = await Promise.all([
    getPage("about"),
    prisma.committeeMember.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { photo: true } }),
  ]);
  const story = section(page, "story");
  const mission = section(page, "mission");
  const vision = section(page, "vision");
  const values = section(page, "values");
  return (
    <>
      <PageHeader eyebrow="About us" title={page?.title ?? "About Us"} subtitle={page?.metaDescription} />
      <div className="container-page space-y-16 py-14">
        {story && (
          <section className="grid gap-8 lg:grid-cols-3">
            <h2 className="text-3xl font-bold uppercase">{story.title}</h2>
            <Markdown className="lg:col-span-2">{story.body}</Markdown>
          </section>
        )}
        {(mission || vision) && (
          <section className="grid gap-6 md:grid-cols-2">
            {[mission, vision].filter(Boolean).map((s) => (
              <div key={s!.key} className="card border-l-4 border-l-brand p-6">
                <p className="eyebrow">{s!.title}</p>
                <Markdown className="mt-2 prose-p:text-lg">{s!.body}</Markdown>
              </div>
            ))}
          </section>
        )}
        {values && (
          <section>
            <SectionHeading eyebrow="What we stand for" title={values.title ?? "Our values"} />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {(values.items as SectionItem[]).map((v) => (
                <div key={v.label} className="card p-6">
                  <h3 className="font-display text-xl font-bold uppercase">{v.label}</h3>
                  {v.detail && <p className="mt-2 text-sm text-slate-600">{v.detail}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
        <section>
          <SectionHeading eyebrow="Leadership" title="Committee" subtitle="The volunteers who keep the club running." />
          {committee.length ? (
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {committee.map((m) => (
                <li key={m.id} className="card overflow-hidden">
                  {m.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo.url} alt={m.photo.altText || m.name} className="aspect-square w-full object-cover" loading="lazy" />
                  ) : (
                    <div aria-hidden className="grid aspect-square place-items-center bg-brand-ink font-display text-6xl font-bold text-brand">{m.name.charAt(0)}</div>
                  )}
                  <div className="p-4">
                    <p className="font-semibold text-brand-ink">{m.name}</p>
                    <p className="text-sm text-brand">{m.role}</p>
                    {m.bio && <p className="mt-2 text-sm text-slate-600">{m.bio}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-slate-600">Committee details will be published soon.</p>
          )}
        </section>
      </div>
    </>
  );
}
