import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/server/services/content";
import { Markdown } from "@/components/Markdown";
import { PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/time";

// Generic CMS pages with a Markdown body (privacy, terms, refund policy, waiver, or any page an admin adds).
const RESERVED = new Set(["home", "about", "membership"]);

async function load(slug: string) {
  if (RESERVED.has(slug)) return null;
  const p = await getPage(slug);
  return p && p.isPublished && p.body ? p : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  return p ? { title: p.title, description: p.metaDescription ?? undefined } : {};
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = await load((await params).slug);
  if (!page) notFound();
  return (
    <>
      <PageHeader title={page.title} subtitle={`Last updated ${formatDate(page.updatedAt)}`} />
      <article className="container-page max-w-3xl py-12"><Markdown>{page.body}</Markdown></article>
    </>
  );
}
