import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";

const load = (slug: string) => prisma.galleryAlbum.findFirst({ where: { slug, isPublished: true }, include: { media: { orderBy: { sortOrder: "asc" } } } });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = await load((await params).slug);
  return a ? { title: a.title, description: a.description ?? undefined } : {};
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const album = await load((await params).slug);
  if (!album) notFound();
  return (
    <>
      <PageHeader eyebrow="Gallery" title={album.title} subtitle={album.description} />
      <div className="container-page py-10">
        <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {album.media.map((m) => (
            <li key={m.id} className="mb-4 break-inside-avoid">
              <figure>
                <a href={m.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.altText} className="w-full rounded-xl" loading="lazy" />
                </a>
                {m.caption && <figcaption className="mt-1.5 text-sm text-slate-600">{m.caption}</figcaption>}
              </figure>
            </li>
          ))}
        </ul>
        <Link href="/gallery" className="mt-6 inline-block font-semibold text-brand hover:underline">← All albums</Link>
      </div>
    </>
  );
}
