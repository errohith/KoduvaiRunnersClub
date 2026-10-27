import { api, ok } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { getPage } from "@/server/services/content";

export const GET = api<{ params: Promise<{ slug: string }> }>(async (_req, { params }) => {
  const p = await getPage((await params).slug);
  if (!p || !p.isPublished) throw notFound("Page");
  return ok({ slug: p.slug, title: p.title, metaDescription: p.metaDescription, body: p.body, updatedAt: p.updatedAt, sections: p.sections.map((s) => ({ key: s.key, title: s.title, subtitle: s.subtitle, body: s.body, items: s.items, imageUrl: s.image?.url ?? null, ctaLabel: s.ctaLabel, ctaHref: s.ctaHref })) });
});
