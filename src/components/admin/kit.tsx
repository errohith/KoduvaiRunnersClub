import Link from "next/link";
import type { ReactNode } from "react";
import { Alert } from "../ui";

export function AdminPage({ title, description, actions, children, flash }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; flash?: { ok?: string; error?: string } }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl font-bold normal-case tracking-normal text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {flash?.ok && <Alert tone="success">{flash.ok}</Alert>}
      {flash?.error && <Alert tone="error">{flash.error}</Alert>}
      {children}
    </div>
  );
}

export function Panel({ title, actions, children, className = "" }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          {title && <h2 className="font-sans text-sm font-semibold normal-case tracking-normal text-slate-800">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400">{body}</Link>
  ) : (
    <div className="rounded-xl border border-slate-200 bg-white p-4">{body}</div>
  );
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="table">
        <thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {empty ? (
            <tr><td colSpan={head.length} className="py-10 text-center text-slate-500">Nothing here yet.</td></tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pages, base }: { page: number; pages: number; base: Record<string, string | undefined> }) {
  if (pages <= 1) return null;
  const href = (p: number) => "?" + new URLSearchParams({ ...Object.fromEntries(Object.entries(base).filter(([, v]) => v)) as Record<string, string>, page: String(p) });
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
      <span className="text-slate-500">Page {page} of {pages}</span>
      <div className="flex gap-2">
        {page > 1 && <Link className="btn-outline btn-sm" href={href(page - 1)}>Previous</Link>}
        {page < pages && <Link className="btn-outline btn-sm" href={href(page + 1)}>Next</Link>}
      </div>
    </nav>
  );
}

type FieldProps = { name: string; label: string; defaultValue?: string | number | null; type?: string; required?: boolean; help?: string; placeholder?: string; className?: string; step?: string; min?: number };
export function Input({ name, label, defaultValue, type = "text", required, help, placeholder, className = "", step, min }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">{label}{required && <span className="text-red-600"> *</span>}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} required={required} placeholder={placeholder} step={step} min={min} className="input" />
      {help && <p className="help">{help}</p>}
    </div>
  );
}

export function Textarea({ name, label, defaultValue, rows = 4, help, required, className = "", mono }: FieldProps & { rows?: number; mono?: boolean }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">{label}{required && <span className="text-red-600"> *</span>}</label>
      <textarea id={name} name={name} rows={rows} defaultValue={defaultValue ?? ""} required={required} className={`input ${mono ? "font-mono text-xs" : ""}`} />
      {help && <p className="help">{help}</p>}
    </div>
  );
}

export function Select({ name, label, defaultValue, options, help, className = "" }: { name: string; label: string; defaultValue?: string | null; options: [string, string][]; help?: string; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">{label}</label>
      <select id={name} name={name} defaultValue={defaultValue ?? ""} className="input">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {help && <p className="help">{help}</p>}
    </div>
  );
}

export function Check({ name, label, defaultChecked, help }: { name: string; label: string; defaultChecked?: boolean; help?: string }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-slate-800">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
        {label}
      </label>
      {help && <p className="help pl-6">{help}</p>}
    </div>
  );
}

export type Flash = { ok?: string; error?: string };

/** Plain anchor for file downloads (CSV exports) — client-side navigation would not trigger a download. */
export function DownloadLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} download className="btn-outline btn-sm">{children}</a>
  );
}
