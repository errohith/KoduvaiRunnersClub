"use client";
import { useActionState } from "react";
import { changePasswordAction } from "@/server/admin/auth-actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="max-w-sm space-y-3">
      {state?.error && <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Password changed. Other sessions were signed out.</p>}
      <div><label htmlFor="current" className="label">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required className="input" /></div>
      <div><label htmlFor="next" className="label">New password</label><input id="next" name="next" type="password" autoComplete="new-password" required minLength={12} className="input" /><p className="help">At least 12 characters with letters and numbers.</p></div>
      <button className="btn-dark btn-sm" disabled={pending}>{pending ? "Saving…" : "Change password"}</button>
    </form>
  );
}
