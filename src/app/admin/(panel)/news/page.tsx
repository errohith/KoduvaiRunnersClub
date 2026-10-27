import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/time";
import { AdminPage, Table } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { StatusBadge } from "@/components/ui";
import { deleteNewsAction } from "@/server/admin/content-actions";

export default async function NewsAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePagePermission("content.manage");
  const posts = await prisma.newsPost.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <AdminPage title="News & updates" flash={await searchParams} actions={<Link href="/admin/news/new" className="btn-primary btn-sm">New post</Link>}>
      <Table head={["Title", "Category", "Status", "Published", ""]} empty={!posts.length}>
        {posts.map((p) => (
          <tr key={p.id}>
            <td><Link href={`/admin/news/${p.id}`} className="font-medium hover:underline">{p.title}</Link></td>
            <td>{p.category}</td>
            <td><StatusBadge status={p.status} /></td>
            <td>{formatDate(p.publishedAt)}</td>
            <td><form action={deleteNewsAction}><input type="hidden" name="id" value={p.id} /><SubmitButton className="btn-ghost btn-sm text-red-700" confirm="Delete this post?">Delete</SubmitButton></form></td>
          </tr>
        ))}
      </Table>
    </AdminPage>
  );
}
