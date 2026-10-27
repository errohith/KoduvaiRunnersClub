"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Alert } from "../ui";
import { CheckboxField, Fieldset, SelectField, TextField } from "./fields";
import { formToObject, useApiForm } from "./useApiForm";

type Plan = { id: string; code: string; name: string; feeLabel: string; free: boolean; requiresStudentVerification: boolean; description: string };
const EXPERIENCE = ["New to running", "Beginner (up to 5K)", "Intermediate (10K–21K)", "Advanced (marathon+)", "Walker"];
const INTERESTS = ["Weekend long runs", "Weekday training", "Trail running", "Marathons", "Social runs", "Volunteering", "Coaching"];

export function MembershipForm({ plans, initialPlan, requireDob, requireEmergency }: { plans: Plan[]; initialPlan?: string; requireDob: boolean; requireEmergency: boolean }) {
  const router = useRouter();
  const [planId, setPlanId] = useState(plans.find((p) => p.code === initialPlan)?.id ?? "");
  const plan = useMemo(() => plans.find((p) => p.id === planId), [plans, planId]);
  const { submit, submitting, errors, formError } = useApiForm<{ referenceNo: string }>("/api/v1/membership-applications");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = formToObject(e.currentTarget);
    const fd = new FormData(e.currentTarget);
    const data = await submit({
      ...f,
      interests: fd.getAll("interests"),
      acceptTerms: f.acceptTerms === "on",
      acceptPrivacy: f.acceptPrivacy === "on",
      acceptDeclaration: f.acceptDeclaration === "on",
      consentWhatsapp: f.consentWhatsapp === "on",
      consentMarketingEmail: f.consentMarketingEmail === "on",
    });
    if (data) router.push(`/registration/confirmation?type=membership&ref=${encodeURIComponent(data.referenceNo)}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError && (
        <div tabIndex={-1} data-form-error>
          <Alert tone="error" title="We couldn't submit your application">{formError}</Alert>
        </div>
      )}

      <fieldset className="card p-5 sm:p-6">
        <legend className="sr-only">Membership type</legend>
        <h2 aria-hidden className="font-display text-xl font-bold uppercase">1. Membership type</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-describedby={errors.planId ? "planId-error" : undefined}>
          {plans.map((p) => (
            <label key={p.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${planId === p.id ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-slate-200 hover:border-slate-400"}`}>
              <input type="radio" name="planId" value={p.id} checked={planId === p.id} onChange={() => setPlanId(p.id)} className="mt-1 h-4 w-4 text-brand focus:ring-brand" />
              <span>
                <span className="flex flex-wrap items-center gap-2 font-semibold text-brand-ink">
                  {p.name}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${p.free ? "bg-emerald-100 text-emerald-800" : "bg-brand/10 text-brand-dark"}`}>{p.feeLabel}</span>
                </span>
                <span className="mt-0.5 block text-xs text-slate-600">{p.description}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.planId && <p id="planId-error" className="field-error">{errors.planId}</p>}
      </fieldset>

      <Fieldset legend="2. About you">
        <TextField name="fullName" label="Full name" required autoComplete="name" error={errors.fullName} />
        <TextField name="email" type="email" label="Email address" required autoComplete="email" error={errors.email} />
        <TextField name="phone" type="tel" label="Mobile number" required autoComplete="tel" placeholder="+91 98765 43210" help="Include your country code. Indian numbers can omit +91." error={errors.phone} />
        <TextField name="dateOfBirth" type="date" label="Date of birth" required={requireDob} error={errors.dateOfBirth} help={requireDob ? undefined : "Optional"} />
        <TextField name="city" label="City / town" required autoComplete="address-level2" error={errors.city} />
        <TextField name="address" label="Address" autoComplete="street-address" error={errors.address} help="Optional" />
      </Fieldset>

      {plan?.requiresStudentVerification && (
        <Fieldset legend="Student verification" description="Required for student membership. We may ask to see your student ID.">
          <TextField name="studentInstitution" label="School / college / university" required error={errors.studentInstitution} />
          <TextField name="studentIdNumber" label="Student ID number" required error={errors.studentIdNumber} />
        </Fieldset>
      )}

      <Fieldset legend="3. Your running">
        <SelectField name="experienceLevel" label="Running experience" required placeholder="Choose…" options={EXPERIENCE.map((v) => ({ value: v, label: v }))} error={errors.experienceLevel} />
        <TextField name="referralSource" label="How did you hear about us?" error={errors.referralSource} help="Optional" />
        <div className="sm:col-span-2">
          <p className="label">Interests <span className="font-normal text-slate-600">(optional)</span></p>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => (
              <label key={i} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                <input type="checkbox" name="interests" value={i} className="h-4 w-4 rounded text-brand focus:ring-brand" />
                {i}
              </label>
            ))}
          </div>
        </div>
      </Fieldset>

      <Fieldset legend="4. Emergency contact" description="Only used if something happens during a club activity. Visible to authorised club officers only.">
        <TextField name="emergencyName" label="Contact name" required={requireEmergency} error={errors.emergencyName} />
        <TextField name="emergencyPhone" type="tel" label="Contact phone" required={requireEmergency} error={errors.emergencyPhone} />
      </Fieldset>

      <fieldset className="card space-y-4 p-5 sm:p-6">
        <legend className="sr-only">Agreements and communication preferences</legend>
        <h2 aria-hidden className="font-display text-xl font-bold uppercase">5. Agreements</h2>
        <CheckboxField name="acceptTerms" required error={errors.acceptTerms} label={<>I accept the <Link href="/terms" target="_blank" className="font-medium text-brand underline">membership terms</Link>.</>} />
        <CheckboxField name="acceptPrivacy" required error={errors.acceptPrivacy} label={<>I have read the <Link href="/privacy" target="_blank" className="font-medium text-brand underline">privacy policy</Link>.</>} />
        <CheckboxField name="acceptDeclaration" required error={errors.acceptDeclaration} label="I confirm the information above is accurate and that I am responsible for ensuring I am fit to take part in club activities." />
        <div className="border-t border-slate-100 pt-4">
          <p className="text-sm font-medium text-slate-800">Optional communications</p>
          <p className="help mb-3">Service emails about your application are always sent. These are separate and optional — you can opt out any time.</p>
          <div className="space-y-3">
            <CheckboxField name="consentWhatsapp" label="Send me club updates and confirmations on WhatsApp (reply STOP to opt out)." />
            <CheckboxField name="consentMarketingEmail" label="Email me club news and announcements." />
          </div>
        </div>
      </fieldset>

      {/* Honeypot for bots — hidden from people and assistive tech. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="flex flex-col-reverse items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="text-sm text-slate-600">
          {plan && !plan.free ? `Fee: ${plan.feeLabel}. Payment details follow once your application is approved.` : "Fields marked * are required."}
        </p>
        <button type="submit" className="btn-primary px-8 py-3 text-base" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit application"}
        </button>
      </div>
      {Object.keys(errors).length > 0 && <p className="sr-only" role="alert">There are {Object.keys(errors).length} errors in the form.</p>}
    </form>
  );
}
