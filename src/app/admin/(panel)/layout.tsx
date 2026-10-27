import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth/session";
import { logoutAction } from "@/server/admin/auth-actions";
import { AdminNav, type NavGroup } from "@/components/admin/AdminNav";
import type { Permission } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  const [pending, newMessages] = await Promise.all([
    can(user, "members.view") ? prisma.membershipApplication.count({ where: { status: "PENDING" } }) : 0,
    can(user, "contact.view") ? prisma.contactMessage.count({ where: { status: "NEW" } }) : 0,
  ]);
  const item = (perm: Permission, href: string, label: string, badge?: number) => (can(user, perm) ? [{ href, label, badge }] : []);
  const groups: NavGroup[] = [
    { label: "Overview", items: [...item("dashboard.view", "/admin", "Dashboard"), ...item("reports.view", "/admin/reports", "Reports")] },
    { label: "Membership", items: [...item("members.view", "/admin/applications", "Applications", pending), ...item("members.view", "/admin/members", "Members"), ...item("plans.manage", "/admin/plans", "Plans & fees")] },
    { label: "Events", items: [...item("events.view", "/admin/events", "Events & marathons")] },
    { label: "Money", items: [...item("payments.view", "/admin/payments", "Payments")] },
    { label: "Communications", items: [...item("comms.view", "/admin/announcements", "Announcements"), ...item("templates.manage", "/admin/templates", "Templates"), ...item("comms.view", "/admin/deliveries", "Delivery log"), ...item("contact.view", "/admin/messages", "Contact messages", newMessages)] },
    {
      label: "Website",
      items: [
        ...item("settings.manage", "/admin/settings", "Branding & settings"),
        ...item("content.manage", "/admin/pages", "Pages"),
        ...item("content.manage", "/admin/navigation", "Navigation"),
        ...item("content.manage", "/admin/news", "News"),
        ...item("media.manage", "/admin/media", "Media & gallery"),
        ...item("content.manage", "/admin/people", "Committee & testimonials"),
      ],
    },
    { label: "System", items: [...item("users.manage", "/admin/users", "Users & roles"), ...item("audit.view", "/admin/audit", "Audit log")] },
  ].filter((g) => g.items.length);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-4 px-4">
          <Link href="/admin" className="text-sm font-bold text-slate-900">Club Admin</Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="hidden text-slate-500 hover:text-slate-900 sm:inline" target="_blank">View site ↗</Link>
            <Link href="/admin/account" className="text-slate-700 hover:text-slate-900">{user.name}</Link>
            <form action={logoutAction}><button className="btn-outline btn-sm">Sign out</button></form>
          </div>
        </div>
      </header>
      <div className="lg:grid lg:grid-cols-[230px_1fr]">
        <aside className="border-b border-slate-200 p-3 lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <AdminNav groups={groups} />
        </aside>
        <main id="main" className="min-w-0 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
