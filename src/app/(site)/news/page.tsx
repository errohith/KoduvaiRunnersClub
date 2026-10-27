import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/time";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "News & Updates", description: "Club announcements, race reports and achievements." };

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const where = { status: "PUBLISHED" as const, publishedAt: { lte: new Date() } };
  const [posts, categories] = await Promise.all([
    prisma.newsPost.findMany({ where: { ...where, ...(category ? { category } : {}) }, orderBy: { publishedAt: "desc" }, include: { cover: true }, take: 50 }),
    prisma.newsPost.findMany({ where, distinct: ["category"], select: { category: true } }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Club news" title="News & updates" subtitle="Announcements, race reports, achievements and club activities." />
      <div className="container-page py-10">
        {categories.length > 1 && (
          <nav aria-label="News categories" className="mb-6 flex flex-wrap gap-2">
            <Link href="/news" aria-current={!category ? "page" : undefined} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${!category ? "bg-brand-ink text-white" : "bg-white ring-1 ring-slate-200"}`}>All</Link>
            {categories.map((c) => (
              <Link key={c.category} href={`/news?category=${encodeURIComponent(c.category)}`} aria-current={category === c.category ? "page" : undefined} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${category === c.category ? "bg-brand-ink text-white" : "bg-white ring-1 ring-slate-200"}`}>{c.category}</Link>
            ))}
          </nav>
        )}
        {posts.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((n) => (
              <article key={n.id} className="card relative overflow-hidden">
                {n.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.cover.url} alt={n.cover.altText} className="aspect-[16/9] w-full object-cover" loading="lazy" />
                )}
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand">{n.category} · <time dateTime={n.publishedAt?.toISOString()}>{formatDate(n.publishedAt)}</time></p>
                  <h2 className="mt-2 font-display text-2xl font-bold uppercase leading-tight">
                    <Link href={`/news/${n.slug}`} className="after:absolute after:inset-0">{n.title}</Link>
                  </h2>
                  {n.excerpt && <p className="mt-2 text-sm text-slate-600">{n.excerpt}</p>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No news yet">Check back soon.</EmptyState>
        )}
      </div>
    </>
  );
}
