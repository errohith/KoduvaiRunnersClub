import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { AdminPage } from "@/components/admin/kit";
import { NewsForm } from "@/components/admin/NewsForm";

export default async function NewPost({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePagePermission("content.manage");
  return <AdminPage title="New post" flash={await searchParams}><NewsForm media={await prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 })} /></AdminPage>;
}
