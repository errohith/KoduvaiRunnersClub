import type { NavigationLink } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { AdminPage, Panel } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { saveNavAction } from "@/server/admin/content-actions";

function Row({ l, location }: { l?: NavigationLink; location: "HEADER" | "FOOTER" }) {
  return (
    <form action={saveNavAction} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_80px_auto_auto]">
      {l && <input type="hidden" name="id" value={l.id} />}
      <input type="hidden" name="location" value={location} />
      <input name="label" defaultValue={l?.label} placeholder="Label" className="input" aria-label="Label" required />
      <input name="href" defaultValue={l?.href} placeholder="/page or https://…" className="input" aria-label="Link" required />
      <input name="sortOrder" type="number" defaultValue={l?.sortOrder ?? 0} className="input" aria-label="Order" />
      <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="isActive" defaultChecked={l?.isActive ?? true} className="h-4 w-4 rounded" /> Show</label>
      <div className="flex gap-1">
        <SubmitButton className="btn-dark btn-sm">{l ? "Save" : "Add"}</SubmitButton>
        {l && <SubmitButton name="delete" value="1" className="btn-ghost btn-sm text-red-700" confirm="Remove this link?">Remove</SubmitButton>}
      </div>
    </form>
  );
}

export default async function Navigation({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePagePermission("content.manage");
  const links = await prisma.navigationLink.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <AdminPage title="Navigation" description="Header menu and footer links." flash={await searchParams}>
      {(["HEADER", "FOOTER"] as const).map((loc) => (
        <Panel key={loc} title={loc === "HEADER" ? "Header menu" : "Footer links"}>
          <div className="space-y-2">
            {links.filter((l) => l.location === loc).map((l) => <Row key={l.id} l={l} location={loc} />)}
            <div className="border-t border-slate-100 pt-3"><Row location={loc} /></div>
          </div>
        </Panel>
      ))}
    </AdminPage>
  );
}
