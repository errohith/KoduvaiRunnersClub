"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "../ui";
import { CheckboxField, Fieldset, SelectField, TextArea, TextField } from "./fields";
import { formToObject, useApiForm } from "./useApiForm";

export type RegEvent = {
  id: string;
  waitlistEnabled: boolean;
  volunteersEnabled: boolean;
  collectDateOfBirth: boolean;
  collectGender: boolean;
  collectTshirtSize: boolean;
  tshirtSizes: string[];
  waiverText: string | null;
  medicalDeclarationText: string | null;
  terms: string | null;
  categories: { id: string; name: string; feeLabel: string; full: boolean; spotsLeft: number | null; ageNote: string | null }[];
  customFields: { key: string; label: string; type: string; options: string[]; required: boolean; helpText: string | null }[];
};

export function EventRegistrationForm({ event }: { event: RegEvent }) {
  const router = useRouter();
  const [type, setType] = useState<"PARTICIPANT" | "VOLUNTEER">("PARTICIPANT");
  const [categoryId, setCategoryId] = useState(event.categories.length === 1 ? event.categories[0].id : "");
  const { submit, submitting, errors, formError } = useApiForm<{ registrationNo: string }>("/api/v1/event-registrations");
  const volunteer = type === "VOLUNTEER";
  const chosen = event.categories.find((c) => c.id === categoryId);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = formToObject(e.currentTarget);
    const customFields: Record<string, string> = {};
    for (const cf of event.customFields) customFields[cf.key] = cf.type === "CHECKBOX" ? (f[`cf_${cf.key}`] === "on" ? "true" : "") : (f[`cf_${cf.key}`] ?? "");
    const data = await submit({
      eventId: event.id,
      participantType: type,
      categoryId: volunteer ? undefined : categoryId || undefined,
      fullName: f.fullName,
      email: f.email,
      phone: f.phone,
      dateOfBirth: f.dateOfBirth,
      gender: f.gender,
      emergencyName: f.emergencyName,
      emergencyPhone: f.emergencyPhone,
      tshirtSize: f.tshirtSize,
      accessibilityNeeds: f.accessibilityNeeds,
      medicalNotes: f.medicalNotes,
      medicalDeclaration: f.medicalDeclaration === "on",
      acceptTerms: f.acceptTerms === "on",
      acceptWaiver: f.acceptWaiver === "on",
      consentWhatsapp: f.consentWhatsapp === "on",
      consentMarketingEmail: f.consentMarketingEmail === "on",
      customFields,
      website: f.website,
    });
    if (data) router.push(`/registration/confirmation?type=event&ref=${encodeURIComponent(data.registrationNo)}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError && (
        <div tabIndex={-1} data-form-error>
          <Alert tone="error" title="We couldn't complete your registration">{formError}</Alert>
        </div>
      )}

      {event.volunteersEnabled && (
        <div className="card flex flex-wrap gap-2 p-2" role="radiogroup" aria-label="Registration type">
          {(["PARTICIPANT", "VOLUNTEER"] as const).map((t) => (
            <label key={t} className={`flex-1 cursor-pointer rounded-xl px-4 py-2.5 text-center text-sm font-semibold ${type === t ? "bg-brand-ink text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <input type="radio" className="sr-only" name="participantType" value={t} checked={type === t} onChange={() => setType(t)} />
              {t === "PARTICIPANT" ? "I want to run" : "I want to volunteer"}
            </label>
          ))}
        </div>
      )}

      {!volunteer && (
        <fieldset className="card p-5 sm:p-6">
          <legend className="sr-only">Distance / category</legend>
          <h3 aria-hidden className="font-display text-xl font-bold uppercase">Choose your distance</h3>
          <div className="mt-4 grid gap-3">
            {event.categories.map((c) => (
              <label key={c.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 ${categoryId === c.id ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-slate-200 hover:border-slate-400"}`}>
                <span className="flex items-start gap-3">
                  <input type="radio" name="categoryId" value={c.id} checked={categoryId === c.id} onChange={() => setCategoryId(c.id)} className="mt-1 h-4 w-4 text-brand focus:ring-brand" />
                  <span>
                    <span className="block font-semibold text-brand-ink">{c.name}</span>
                    <span className="block text-xs text-slate-600">
                      {c.full ? (event.waitlistEnabled ? "Full — join the waitlist" : "Sold out") : c.spotsLeft !== null ? `${c.spotsLeft} places left` : "Places available"}
                      {c.ageNote ? ` · ${c.ageNote}` : ""}
                    </span>
                  </span>
                </span>
                <span className="font-display text-lg font-bold text-brand-ink">{c.feeLabel}</span>
              </label>
            ))}
          </div>
          {errors.categoryId && <p className="field-error">{errors.categoryId}</p>}
        </fieldset>
      )}

      <Fieldset legend="Your details">
        <TextField name="fullName" label="Full name" required autoComplete="name" error={errors.fullName} help="As it should appear on your bib." />
        <TextField name="email" type="email" label="Email" required autoComplete="email" error={errors.email} />
        <TextField name="phone" type="tel" label="Mobile number" required autoComplete="tel" placeholder="+91 98765 43210" error={errors.phone} />
        {(event.collectDateOfBirth || chosen?.ageNote) && <TextField name="dateOfBirth" type="date" label="Date of birth" required error={errors.dateOfBirth} help="Used to confirm age eligibility on race day." />}
        {event.collectGender && !volunteer && (
          <SelectField name="gender" label="Results category" required placeholder="Choose…" options={["Female", "Male", "Open / prefer not to say"].map((v) => ({ value: v, label: v }))} error={errors.gender} help="Used only for age-group results." />
        )}
        {event.collectTshirtSize && <SelectField name="tshirtSize" label="T-shirt size" required placeholder="Choose…" options={event.tshirtSizes.map((v) => ({ value: v, label: v }))} error={errors.tshirtSize} />}
      </Fieldset>

      <Fieldset legend="Emergency contact" description="Restricted to event officials and used only in an emergency.">
        <TextField name="emergencyName" label="Contact name" required error={errors.emergencyName} />
        <TextField name="emergencyPhone" type="tel" label="Contact phone" required error={errors.emergencyPhone} />
      </Fieldset>

      {(event.customFields.length > 0 || !volunteer) && (
        <Fieldset legend="A few more details">
          {event.customFields.map((cf) => {
            const name = `cf_${cf.key}`;
            const err = errors[`customFields.${cf.key}`];
            if (cf.type === "SELECT") return <SelectField key={cf.key} name={name} label={cf.label} required={cf.required} placeholder="Choose…" options={cf.options.map((o) => ({ value: o, label: o }))} error={err} help={cf.helpText} />;
            if (cf.type === "TEXTAREA") return <div key={cf.key} className="sm:col-span-2"><TextArea name={name} label={cf.label} required={cf.required} error={err} help={cf.helpText} /></div>;
            if (cf.type === "CHECKBOX") return <div key={cf.key} className="sm:col-span-2"><CheckboxField name={name} label={cf.label} required={cf.required} error={err} help={cf.helpText} /></div>;
            return <TextField key={cf.key} name={name} label={cf.label} required={cf.required} type={cf.type === "NUMBER" ? "number" : cf.type === "DATE" ? "date" : "text"} error={err} help={cf.helpText} />;
          })}
          <div className="sm:col-span-2">
            <TextArea name="accessibilityNeeds" label="Accessibility requirements" rows={2} error={errors.accessibilityNeeds} help="Optional — tell us anything that helps us support you on the day." />
          </div>
        </Fieldset>
      )}

      <fieldset className="card space-y-4 p-5 sm:p-6">
        <legend className="sr-only">Declarations</legend>
        <h3 aria-hidden className="font-display text-xl font-bold uppercase">Declarations</h3>
        {event.medicalDeclarationText && !volunteer && (
          <>
            <CheckboxField name="medicalDeclaration" required label={event.medicalDeclarationText} error={errors.medicalDeclaration} />
            <TextArea name="medicalNotes" label="Anything the medical team should know?" rows={2} help="Optional and confidential — e.g. allergies or a condition first-aiders should be aware of. Do not include detailed medical records." error={errors.medicalNotes} />
          </>
        )}
        {event.waiverText && <CheckboxField name="acceptWaiver" required label={<>I accept the liability waiver: <span className="text-slate-600">{event.waiverText}</span></>} error={errors.acceptWaiver} />}
        <CheckboxField name="acceptTerms" required error={errors.acceptTerms} label={<>I accept the event terms{event.terms ? " above" : ""} and the club <Link href="/waiver" target="_blank" className="font-medium text-brand underline">participation waiver</Link>.</>} />
        <div className="border-t border-slate-100 pt-4">
          <p className="text-sm font-medium text-slate-800">Optional communications</p>
          <p className="help mb-3">Your confirmation and essential event updates are always emailed.</p>
          <div className="space-y-3">
            <CheckboxField name="consentWhatsapp" label="Send me confirmations and race-day updates on WhatsApp." />
            <CheckboxField name="consentMarketingEmail" label="Email me news about future club events." />
          </div>
        </div>
      </fieldset>

      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="flex flex-col-reverse items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="text-sm text-slate-600">{chosen && !volunteer ? `Entry: ${chosen.feeLabel}` : "Fields marked * are required."}</p>
        <button type="submit" className="btn-primary px-8 py-3 text-base" disabled={submitting}>
          {submitting ? "Registering…" : chosen?.full && !volunteer ? "Join waitlist" : volunteer ? "Sign up to volunteer" : "Register"}
        </button>
      </div>
    </form>
  );
}
