import type { MediaAsset, NewsPost } from "@prisma/client";
import { saveNewsAction } from "@/server/admin/content-actions";
import { Input, Select, Textarea } from "./kit";
import { SubmitButton } from "./buttons";

export function NewsForm({ post, media }: { post?: NewsPost; media: MediaAsset[] }) {
  return (
    <form action={saveNewsAction} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      {post && <input type="hidden" name="id" value={post.id} />}
      <Input name="title" label="Title" defaultValue={post?.title} required className="sm:col-span-2" />
      <Input name="slug" label="URL slug" defaultValue={post?.slug} help="Blank = from title" />
      <Input name="category" label="Category" defaultValue={post?.category ?? "Announcement"} help="e.g. Announcement, Race report, Achievement" />
      <Textarea name="excerpt" label="Excerpt" defaultValue={post?.excerpt} rows={2} className="sm:col-span-2" />
      <Textarea name="body" label="Body (Markdown)" defaultValue={post?.body} rows={14} className="sm:col-span-2" required />
      <Select name="coverId" label="Cover image" defaultValue={post?.coverId} options={[["", "None"], ...media.map((m) => [m.id, m.altText || m.originalName] as [string, string])]} />
      <Select name="status" label="Status" defaultValue={post?.status ?? "DRAFT"} options={[["DRAFT", "Draft (hidden)"], ["PUBLISHED", "Published"]]} />
      <div className="sm:col-span-2"><SubmitButton className="btn-primary btn-sm">Save post</SubmitButton></div>
    </form>
  );
}
