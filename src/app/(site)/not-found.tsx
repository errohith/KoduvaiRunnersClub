import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <p className="font-display text-8xl font-extrabold text-brand">404</p>
      <h1 className="mt-2 text-3xl font-bold uppercase">Wrong turn</h1>
      <p className="mt-2 text-slate-600">This page isn&apos;t on the route map.</p>
      <Link href="/" className="btn-primary mt-6">Back to the start line</Link>
    </div>
  );
}
