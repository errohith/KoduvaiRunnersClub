"use client";
import { useActionState } from "react";
import { loginAction } from "@/server/admin/auth-actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>}
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <button className="btn-dark w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
