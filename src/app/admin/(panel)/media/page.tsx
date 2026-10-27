import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { config } from "@/config/env";
import { AdminPage, Check, Input, Panel, Select } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { saveAlbumAction, updateMediaAction, uploadMediaAction } from "@/server/admin/content-actions";

export default async function MediaAdmin({ searchParams }: { searchParams: Promise<{ album?: string; ok?: string; error?: string }> }) {
  await requirePagePermission("media.manage");
  const sp = await searchParams;
  const [albums, media] = await Promise.all([
    prisma.galleryAlbum.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { media: true } } } }),
    prisma.mediaAsset.findMany({ where: sp.album ? { albumId: sp.album } : {}, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 120 }),
  ]);
  const albumOptions: [string, string][] = [["", "No album (site images)"], ...albums.map((a) => [a.id, a.title] as [string, string])];
  const back = sp.album ? `/admin/media?album=${sp.album}` : "/admin/media";
  return (
    <AdminPage title="Media & gallery" description={`JPEG, PNG or WebP up to ${config.UPLOAD_MAX_MB} MB. Files are checked by content, not just extension.`} flash={sp}>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Upload images">
          <form action={uploadMediaAction} className="space-y-3">
            <input type="hidden" name="back" value={back} />
            <input type="file" name="files" accept="image/jpeg,image/png,image/webp" multiple required className="block w-full text-sm" aria-label="Images" />
            <Input name="altText" label="Alt text (describe the photo)" help="Required for accessibility. You can edit per image afterwards." required />
            <Select name="albumId" label="Album" defaultValue={sp.album} options={albumOptions} />
            <SubmitButton className="btn-primary btn-sm">Upload</SubmitButton>
          </form>
        </Panel>
        <Panel title="Albums">
          <ul className="mb-4 space-y-1 text-sm">
            <li><Link className={!sp.album ? "font-semibold" : "text-brand"} href="/admin/media">All images</Link></li>
            {albums.map((a) => <li key={a.id}><Link className={sp.album === a.id ? "font-semibold" : "text-brand"} href={`/admin/media?album=${a.id}`}>{a.title}</Link> <span className="text-slate-400">({a._count.media}{a.isPublished ? "" : ", hidden"})</span></li>)}
          </ul>
          <form action={saveAlbumAction} className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
            <Input name="title" label="New album title" required />
            <Input name="takenOn" label="Date" type="date" />
            <Input name="description" label="Description" className="sm:col-span-2" />
            <Check name="isPublished" label="Show in public gallery" defaultChecked />
            <div><SubmitButton className="btn-dark btn-sm">Create album</SubmitButton></div>
          </form>
        </Panel>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {media.map((m) => (
          <form key={m.id} action={updateMediaAction} className="rounded-xl border border-slate-200 bg-white p-3">
            <input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={back} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt={m.altText} className="aspect-[4/3] w-full rounded-lg object-cover" loading="lazy" />
            <input readOnly value={m.url} className="mt-2 w-full truncate rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-500" aria-label="Image URL" onFocus={undefined} />
            <div className="mt-2 space-y-2">
              <input name="altText" defaultValue={m.altText} placeholder="Alt text" className="input py-1.5 text-xs" aria-label="Alt text" />
              <input name="caption" defaultValue={m.caption ?? ""} placeholder="Caption" className="input py-1.5 text-xs" aria-label="Caption" />
              <div className="flex gap-2">
                <select name="albumId" defaultValue={m.albumId ?? ""} className="input py-1.5 text-xs" aria-label="Album">{albumOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <input name="sortOrder" type="number" defaultValue={m.sortOrder} className="input w-16 py-1.5 text-xs" aria-label="Order" />
              </div>
              <div className="flex gap-1">
                <SubmitButton className="btn-dark btn-sm">Save</SubmitButton>
                <SubmitButton name="delete" value="1" className="btn-ghost btn-sm text-red-700" confirm="Delete this image permanently?">Delete</SubmitButton>
              </div>
            </div>
          </form>
        ))}
      </div>
    </AdminPage>
  );
}
