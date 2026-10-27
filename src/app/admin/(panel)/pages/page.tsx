import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { AdminPage, Check, Input, Panel, Table, Textarea } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { Badge } from "@/components/ui";
import { savePageAction } from "@/server/admin/content-actions";

export default async function Pages({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePagePermission("content.manage");
  const pages = await prisma.websitePage.findMany({ orderBy: { slug: "asc" }, include: { _count: { select: { sections: true } } } });
  return (
    <AdminPage title="Website pages" description="Edit page text, headings, images and policies." flash={await searchParams}>
      <Table head={["Page", "URL", "Sections", "Status", "Updated"]}>
        {pages.map((p) => (
          <tr key={p.id}>
            <td><Link href={`/admin/pages/${p.id}`} className="font-medium hover:underline">{p.title}</Link></td>
            <td className="font-mono text-xs">/{p.slug === "home" ? "" : p.slug}</td>
            <td>{p._count.sections}</td>
            <td>{p.isPublished ? <Badge tone="green">Published</Badge> : <Badge>Hidden</Badge>}</td>
            <td className="text-xs">{formatDateTime(p.updatedAt)}</td>
          </tr>
        ))}
      </Table>
      <Panel title="Add a page">
        <form action={savePageAction} className="grid gap-3 sm:grid-cols-2">
          <Input name="title" label="Title" required />
          <Input name="slug" label="URL slug" help="e.g. code-of-conduct" />
          <Input name="metaDescription" label="Meta description" className="sm:col-span-2" />
          <Textarea name="body" label="Body (Markdown)" rows={6} className="sm:col-span-2" />
          <Check name="isPublished" label="Published" defaultChecked />
          <div className="sm:col-span-2"><SubmitButton className="btn-primary btn-sm">Create page</SubmitButton></div>
        </form>
      </Panel>
    </AdminPage>
  );
}
