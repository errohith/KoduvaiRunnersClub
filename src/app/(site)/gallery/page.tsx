import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/time";
import { EmptyState, PageHeader, TrackArt } from "@/components/ui";

export const metadata: Metadata = { title: "Gallery", description: "Photos from club runs, races and community activities." };

export default async function GalleryPage() {
  const albums = await prisma.galleryAlbum.findMany({
    where: { isPublished: true },
    orderBy: [{ takenOn: "desc" }, { createdAt: "desc" }],
    include: { cover: true, media: { take: 1, orderBy: { sortOrder: "asc" } }, _count: { select: { media: true } } },
  });
  return (
    <>
      <PageHeader eyebrow="Gallery" title="Moments on the move" subtitle="Club runs, race days and community activities." />
      <div className="container-page py-10">
        {albums.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((a) => {
              const img = a.cover ?? a.media[0];
              return (
                <article key={a.id} className="card group relative overflow-hidden">
                  <div className="aspect-[4/3] overflow-hidden">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.url} alt={img.altText} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                    ) : (
                      <TrackArt className="h-full w-full" />
                    )}
                  </div>
                  <div className="p-5">
                    <h2 className="font-display text-xl font-bold uppercase"><Link href={`/gallery/${a.slug}`} className="after:absolute after:inset-0">{a.title}</Link></h2>
                    <p className="text-sm text-slate-600">{a.takenOn ? formatDate(a.takenOn) + " · " : ""}{a._count.media} photos</p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Photos coming soon">Albums from our runs and races will appear here.</EmptyState>
        )}
      </div>
    </>
  );
}
