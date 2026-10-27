import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { AdminPage, Check, Input, Panel, Select, Textarea } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { saveCommitteeAction, saveTestimonialAction } from "@/server/admin/content-actions";

export default async function People({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePagePermission("content.manage");
  const [committee, testimonials, media] = await Promise.all([
    prisma.committeeMember.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.testimonial.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  const photos: [string, string][] = [["", "No photo"], ...media.map((m) => [m.id, m.altText || m.originalName] as [string, string])];
  return (
    <AdminPage title="Committee & testimonials" description="Shown on the About and Home pages. Only publish quotes members have agreed to share." flash={await searchParams}>
      <Panel title="Committee & leadership">
        <div className="space-y-4">
          {[...committee, undefined].map((m, i) => (
            <form key={m?.id ?? `new${i}`} action={saveCommitteeAction} className={`grid gap-2 sm:grid-cols-6 ${m ? "" : "border-t border-slate-100 pt-4"}`}>
              {m && <input type="hidden" name="id" value={m.id} />}
              <Input name="name" label={m ? "Name" : "New member name"} defaultValue={m?.name} required />
              <Input name="role" label="Role" defaultValue={m?.role} required />
              <Select name="photoId" label="Photo" defaultValue={m?.photoId} options={photos} />
              <Input name="sortOrder" label="Order" type="number" defaultValue={m?.sortOrder ?? 0} />
              <Textarea name="bio" label="Short bio" defaultValue={m?.bio} rows={1} className="sm:col-span-2" />
              <div className="flex items-center gap-3 sm:col-span-6">
                <Check name="isActive" label="Show" defaultChecked={m?.isActive ?? true} />
                <SubmitButton className="btn-dark btn-sm">{m ? "Save" : "Add"}</SubmitButton>
                {m && <SubmitButton name="delete" value="1" className="btn-ghost btn-sm text-red-700" confirm="Remove?">Remove</SubmitButton>}
              </div>
            </form>
          ))}
        </div>
      </Panel>
      <Panel title="Testimonials">
        <div className="space-y-4">
          {[...testimonials, undefined].map((t, i) => (
            <form key={t?.id ?? `new${i}`} action={saveTestimonialAction} className={`grid gap-2 sm:grid-cols-4 ${t ? "" : "border-t border-slate-100 pt-4"}`}>
              {t && <input type="hidden" name="id" value={t.id} />}
              <Textarea name="quote" label={t ? "Quote" : "New quote"} defaultValue={t?.quote} rows={2} className="sm:col-span-2" required />
              <Input name="author" label="Member name" defaultValue={t?.author} required />
              <Input name="context" label="Context" defaultValue={t?.context} placeholder="Member since 2025" />
              <div className="flex items-center gap-3 sm:col-span-4">
                <Input name="sortOrder" label="Order" type="number" defaultValue={t?.sortOrder ?? 0} />
                <Check name="isActive" label="Show" defaultChecked={t?.isActive ?? true} />
                <SubmitButton className="btn-dark btn-sm">{t ? "Save" : "Add"}</SubmitButton>
                {t && <SubmitButton name="delete" value="1" className="btn-ghost btn-sm text-red-700" confirm="Remove?">Remove</SubmitButton>}
              </div>
            </form>
          ))}
        </div>
      </Panel>
    </AdminPage>
  );
}
