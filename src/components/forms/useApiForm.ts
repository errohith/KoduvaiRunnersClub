"use client";
import { useState } from "react";

export type ApiErrorBody = { error?: { code: string; message: string; details?: Record<string, string> } };

/** Submits JSON to an API route and maps structured validation errors back to fields. */
export function useApiForm<TResult>(endpoint: string) {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<TResult | null>(null);

  async function submit(payload: unknown) {
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = (await res.json().catch(() => ({}))) as ApiErrorBody & { data?: TResult };
      if (!res.ok) {
        if (body.error?.details && typeof body.error.details === "object") setErrors(body.error.details);
        setFormError(body.error?.message ?? "Something went wrong. Please try again.");
        requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true], [data-form-error]")?.focus());
        return null;
      }
      setResult(body.data ?? null);
      return body.data ?? null;
    } catch {
      setFormError("Network error — check your connection and try again.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  return { submit, submitting, errors, setErrors, formError, result };
}

export function formToObject(form: HTMLFormElement) {
  const fd = new FormData(form);
  const out: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string") out[k] = v;
  });
  return out;
}
