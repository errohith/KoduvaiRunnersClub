"use client";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type Common = { name: string; label: ReactNode; error?: string; help?: ReactNode; required?: boolean };

function describedBy(name: string, error?: string, help?: ReactNode) {
  return [error ? `${name}-error` : null, help ? `${name}-help` : null].filter(Boolean).join(" ") || undefined;
}

function Meta({ name, error, help }: { name: string; error?: string; help?: ReactNode }) {
  return (
    <>
      {help && !error && <p id={`${name}-help`} className="help">{help}</p>}
      {error && <p id={`${name}-error`} className="field-error">{error}</p>}
    </>
  );
}

const Req = () => <span className="text-brand" aria-hidden> *</span>;

export function TextField({ name, label, error, help, required, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}{required && <Req />}</label>
      <input id={name} name={name} required={required} aria-invalid={!!error} aria-describedby={describedBy(name, error, help)} className="input" {...rest} />
      <Meta name={name} error={error} help={help} />
    </div>
  );
}

export function TextArea({ name, label, error, help, required, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}{required && <Req />}</label>
      <textarea id={name} name={name} required={required} rows={4} aria-invalid={!!error} aria-describedby={describedBy(name, error, help)} className="input" {...rest} />
      <Meta name={name} error={error} help={help} />
    </div>
  );
}

export function SelectField({ name, label, error, help, required, options, placeholder, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}{required && <Req />}</label>
      <select id={name} name={name} required={required} aria-invalid={!!error} aria-describedby={describedBy(name, error, help)} className="input" {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <Meta name={name} error={error} help={help} />
    </div>
  );
}

export function CheckboxField({ name, label, error, help, required, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <input id={name} name={name} type="checkbox" required={required} aria-invalid={!!error} aria-describedby={describedBy(name, error, help)} className="mt-0.5 h-5 w-5 flex-none rounded border-slate-300 text-brand focus:ring-brand" {...rest} />
        <label htmlFor={name} className="text-sm text-slate-700">{label}{required && <Req />}</label>
      </div>
      <div className="pl-8"><Meta name={name} error={error} help={help} /></div>
    </div>
  );
}

export function Fieldset({ legend, description, children }: { legend: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="card p-5 sm:p-6">
      <legend className="sr-only">{legend}</legend>
      <h2 aria-hidden className="font-display text-xl font-bold uppercase">{legend}</h2>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
