"use client";
import { Alert } from "../ui";
import { TextArea, TextField } from "./fields";
import { formToObject, useApiForm } from "./useApiForm";

export function ContactForm() {
  const { submit, submitting, errors, formError, result } = useApiForm<{ id: string }>("/api/v1/contact");
  if (result) return <Alert tone="success" title="Message sent">Thanks for getting in touch — a club volunteer will reply soon.</Alert>;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await submit(formToObject(e.currentTarget));
      }}
    >
      {formError && <div tabIndex={-1} data-form-error><Alert tone="error">{formError}</Alert></div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Your name" required autoComplete="name" error={errors.name} />
        <TextField name="email" type="email" label="Email" required autoComplete="email" error={errors.email} />
        <TextField name="phone" type="tel" label="Phone" autoComplete="tel" error={errors.phone} help="Optional" />
        <TextField name="subject" label="Subject" required error={errors.subject} />
      </div>
      <TextArea name="message" label="Message" required rows={6} error={errors.message} />
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Sending…" : "Send message"}</button>
    </form>
  );
}
