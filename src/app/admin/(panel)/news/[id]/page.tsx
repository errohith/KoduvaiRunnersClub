import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { AdminPage } from "@/components/admin/kit";
import { NewsForm } from "@/components/admin/NewsForm";

export default async function EditPost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePagePermission("content.manage");
  const [post, media] = await Promise.all([prisma.newsPost.findUnique({ where: { id: (await params).id } }), prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 })]);
  if (!post) notFound();
  return <AdminPage title="Edit post" flash={await searchParams} actions={post.status === "PUBLISHED" && <a className="btn-outline btn-sm" target="_blank" href={`/news/${post.slug}`}>View ↗</a>}><NewsForm post={post} media={media} /></AdminPage>;
}
