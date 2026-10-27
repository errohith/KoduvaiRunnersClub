import { notFound } from "next/navigation";
import type { ContentSection, MediaAsset } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { itemsToLines } from "@/server/services/content";
import { AdminPage, Check, Input, Panel, Select, Textarea } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { savePageAction, saveSectionAction } from "@/server/admin/content-actions";

function SectionForm({ pageId, s, media }: { pageId: string; s?: ContentSection; media: MediaAsset[] }) {
  return (
    <form action={saveSectionAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="pageId" value={pageId} />
      {s ? <input type="hidden" name="id" value={s.id} /> : <Input name="key" label="Section key" required help="e.g. sponsors" />}
      <Input name="title" label="Heading" defaultValue={s?.title} />
      <Input name="subtitle" label="Subheading" defaultValue={s?.subtitle} className="sm:col-span-2" />
      <Textarea name="body" label="Body (Markdown)" defaultValue={s?.body} rows={4} className="sm:col-span-2" />
      <Textarea name="items" label="List items — one per line: Label | Value | Detail" defaultValue={itemsToLines(s?.items)} rows={4} className="sm:col-span-2" mono help="Used for stats, highlights, values and FAQs (FAQ: Question | | Answer, or Question | Answer)." />
      <Select name="imageId" label="Image" defaultValue={s?.imageId} options={[["", "None"], ...media.map((m) => [m.id, m.altText || m.originalName] as [string, string])]} />
      <Input name="sortOrder" label="Order" type="number" defaultValue={s?.sortOrder ?? 0} />
      <Input name="ctaLabel" label="Button label" defaultValue={s?.ctaLabel} />
      <Input name="ctaHref" label="Button link" defaultValue={s?.ctaHref} placeholder="/join" />
      <Check name="isPublished" label="Visible" defaultChecked={s?.isPublished ?? true} />
      <div className="sm:col-span-2"><SubmitButton className="btn-dark btn-sm">{s ? "Save section" : "Add section"}</SubmitButton></div>
    </form>
  );
}

export default async function PageEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePagePermission("content.manage");
  const [page, media] = await Promise.all([
    prisma.websitePage.findUnique({ where: { id: (await params).id }, include: { sections: { orderBy: { sortOrder: "asc" } } } }),
    prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  if (!page) notFound();
  return (
    <AdminPage title={page.title} description={<>URL: <a className="text-brand" target="_blank" href={page.slug === "home" ? "/" : `/${page.slug}`}>/{page.slug === "home" ? "" : page.slug} ↗</a></>} flash={await searchParams}>
      <Panel title="Page">
        <form action={savePageAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={page.id} />
          <Input name="title" label="Title" defaultValue={page.title} required />
          <Input name="metaDescription" label="Meta description (SEO)" defaultValue={page.metaDescription} />
          <Textarea name="body" label="Body (Markdown — used by policy pages)" defaultValue={page.body} rows={page.body ? 14 : 4} className="sm:col-span-2" />
          <Check name="isPublished" label="Published" defaultChecked={page.isPublished} />
          <div className="sm:col-span-2"><SubmitButton className="btn-primary btn-sm">Save page</SubmitButton></div>
        </form>
      </Panel>
      {page.sections.map((s) => (
        <Panel key={s.id} title={`Section: ${s.key}`}>
          <SectionForm pageId={page.id} s={s} media={media} />
        </Panel>
      ))}
      <Panel title="Add a section"><SectionForm pageId={page.id} media={media} /></Panel>
    </AdminPage>
  );
}
