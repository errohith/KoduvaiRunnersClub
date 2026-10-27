import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { AdminPage, Input, Panel, Table } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { Badge } from "@/components/ui";
import { createUserAction, resetPasswordAction, updateUserAction } from "@/server/admin/user-actions";

export default async function Users({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePagePermission("users.manage");
  const [users, roles] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { roles: true } }),
    prisma.role.findMany({ orderBy: { name: "asc" }, include: { permissions: { include: { permission: true } } } }),
  ]);
  return (
    <AdminPage title="Users & roles" description="Least privilege: give each volunteer only the roles they need." flash={await searchParams}>
      <Table head={["User", "Roles & status", "Last sign-in", "Password"]}>
        {users.map((u) => (
          <tr key={u.id}>
            <td><p className="font-medium">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p>{!u.isActive && <Badge tone="red">Inactive</Badge>}</td>
            <td>
              <form action={updateUserAction} className="space-y-2">
                <input type="hidden" name="id" value={u.id} />
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {roles.map((r) => (
                    <label key={r.id} className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="roles" value={r.id} defaultChecked={u.roles.some((ur) => ur.roleId === r.id)} className="h-3.5 w-3.5 rounded" />{r.name}</label>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="isActive" defaultChecked={u.isActive} className="h-3.5 w-3.5 rounded" />Active</label>
                  <SubmitButton className="btn-outline btn-sm">Save</SubmitButton>
                </div>
              </form>
            </td>
            <td className="whitespace-nowrap text-xs">{formatDateTime(u.lastLoginAt)}</td>
            <td>
              <form action={resetPasswordAction} className="flex gap-1">
                <input type="hidden" name="id" value={u.id} />
                <input name="password" type="password" autoComplete="new-password" placeholder="New password" className="input w-36 py-1 text-xs" aria-label={`New password for ${u.email}`} />
                <SubmitButton className="btn-ghost btn-sm" confirm="Reset this user's password?">Reset</SubmitButton>
              </form>
            </td>
          </tr>
        ))}
      </Table>
      <Panel title="Add a user">
        <form action={createUserAction} className="grid gap-3 sm:grid-cols-3">
          <Input name="name" label="Name" required />
          <Input name="email" label="Email" type="email" required />
          <Input name="password" label="Temporary password" type="password" required help="Min 12 characters, letters and numbers" />
          <fieldset className="sm:col-span-3">
            <legend className="label">Roles</legend>
            <div className="flex flex-wrap gap-4">
              {roles.map((r) => <label key={r.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="roles" value={r.id} className="h-4 w-4 rounded" />{r.name}</label>)}
            </div>
          </fieldset>
          <div><SubmitButton className="btn-primary btn-sm">Create user</SubmitButton></div>
        </form>
      </Panel>
      <Panel title="Role permissions">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <div key={r.id}>
              <p className="font-semibold">{r.name}</p>
              <p className="text-xs text-slate-500">{r.description}</p>
              <ul className="mt-2 flex flex-wrap gap-1">{r.permissions.map((p) => <li key={p.permissionId}><Badge>{p.permission.key}</Badge></li>)}</ul>
            </div>
          ))}
        </div>
      </Panel>
    </AdminPage>
  );
}
