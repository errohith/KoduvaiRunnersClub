import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { AdminPage } from "@/components/admin/kit";
import { EventForm } from "@/components/admin/EventForm";

export default async function NewEvent({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePagePermission("events.manage");
  const media = await prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <AdminPage title="New event" flash={await searchParams}>
      <EventForm media={media} />
    </AdminPage>
  );
}
