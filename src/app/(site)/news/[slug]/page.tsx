import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/time";
import { Markdown } from "@/components/Markdown";
import { PageHeader } from "@/components/ui";

const load = (slug: string) => prisma.newsPost.findFirst({ where: { slug, status: "PUBLISHED", publishedAt: { lte: new Date() } }, include: { cover: true } });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  return p ? { title: p.title, description: p.excerpt ?? undefined } : {};
}

export default async function NewsPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = await load((await params).slug);
  if (!post) notFound();
  return (
    <>
      <PageHeader eyebrow={`${post.category} · ${formatDate(post.publishedAt)}`} title={post.title} subtitle={post.excerpt} />
      <article className="container-page max-w-3xl py-12">
        {post.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.cover.url} alt={post.cover.altText} className="mb-8 w-full rounded-2xl object-cover" />
        )}
        <Markdown className="prose-lg">{post.body}</Markdown>
        <Link href="/news" className="mt-10 inline-block font-semibold text-brand hover:underline">← All news</Link>
      </article>
    </>
  );
}
