import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Admin sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/admin");
  const { next } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Club admin</p>
        <h1 className="mt-1 font-sans text-2xl font-bold normal-case tracking-normal">Sign in</h1>
        <div className="mt-6"><LoginForm next={next} /></div>
      </div>
    </main>
  );
}
