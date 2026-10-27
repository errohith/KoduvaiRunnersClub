import { getCurrentUser } from "@/lib/auth/session";
import { AdminPage, Panel } from "@/components/admin/kit";
import { PasswordForm } from "./PasswordForm";

export default async function Account() {
  const user = (await getCurrentUser())!;
  return (
    <AdminPage title="My account" description={`${user.email} · ${user.roles.join(", ")}`}>
      <Panel title="Change password"><PasswordForm /></Panel>
    </AdminPage>
  );
}
