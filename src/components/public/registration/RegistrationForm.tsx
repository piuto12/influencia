"use client";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { submitRegistration, type RegisterState } from "@/modules/registration/actions";
import { CATEGORIES } from "@/modules/registration/categories";
import { contacts, edition, waLink } from "@/modules/events/site-content";
import { Field, inputCls } from "./Field";
import { PaymentPanel } from "./PaymentPanel";

const MESSAGES: Record<string, string> = {
  registration_closed: "Registration is currently closed.",
  deadline_passed: "The registration deadline has passed.",
  duplicate_registration: "This email is already registered for this edition. Use Registration Status to check it.",
  capacity_full: "All seats are currently taken. Please contact the team about the waiting list.",
  edition_not_found: "This edition could not be found.",
  unavailable: "We couldn’t complete your registration right now. Please try again in a few minutes or contact the team.",
  validation: "Please correct the highlighted fields.",
};

export function RegistrationForm() {
  const [state, action, pending] = useActionState<RegisterState, FormData>(submitRegistration, null);
  const [email, setEmail] = useState("");

  if (state?.ok) {
    const office = contacts[0];
    return (
      <div role="status" className="rounded-2xl border border-crimson/20 bg-white p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-crimson">Registration received</p>
        <h2 className="mt-2 font-serif text-3xl">Your reference</h2>
        <p className="mt-3 select-all font-display text-5xl tracking-wider text-crimson">{state.reference}</p>
        <p className="mt-4 text-charcoal/80">Keep this reference. Your seat is confirmed only after payment is verified and the organizers approve your registration.</p>
        <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/registration-status" className="text-crimson underline underline-offset-4">Check status</Link>
          <a href={waLink(office.wa, `Hello, I registered for ${edition.title} ${edition.editionLabel}. My reference is ${state.reference}.`)} target="_blank" rel="noopener noreferrer" className="text-crimson underline underline-offset-4">Message the office on WhatsApp</a>
        </div>
        <PaymentPanel reference={state.reference} contact={email} />
      </div>
    );
  }

  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  const e = (k: string) => fe[k];
  const sel = (k: string) => ({ id: k, name: k, className: inputCls, "aria-invalid": e(k) ? true : undefined, "aria-describedby": e(k) ? `${k}-err` : undefined });

  return (
    <form noValidate onSubmit={(ev) => {
      // Dispatch manually: a form `action` prop makes React reset every field after submit, wiping the user's input on validation errors.
      ev.preventDefault();
      const fd = new FormData(ev.currentTarget);
      setEmail(String(fd.get("email") ?? "").trim().toLowerCase());
      startTransition(() => action(fd));
    }} className="space-y-6" aria-busy={pending}>
      {state && !state.ok && <p role="alert" className="rounded-xl bg-crimson/10 p-4 text-crimson">{MESSAGES[state.code]}</p>}
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Full name" name="full_name" errors={e("full_name")}><input {...sel("full_name")} autoComplete="name" required /></Field>
        <Field label="Email" name="email" errors={e("email")}><input {...sel("email")} type="email" autoComplete="email" required /></Field>
        <Field label="Mobile number" name="mobile" errors={e("mobile")} hint="10-digit Indian number or with country code"><input {...sel("mobile")} type="tel" inputMode="tel" autoComplete="tel" required /></Field>
        <Field label="WhatsApp number" name="whatsapp" errors={e("whatsapp")} hint="Leave blank if same as mobile"><input {...sel("whatsapp")} type="tel" inputMode="tel" /></Field>
        <Field label="Organization / institution" name="organization" errors={e("organization")}><input {...sel("organization")} autoComplete="organization" required /></Field>
        <Field label="Designation" name="designation" errors={e("designation")}><input {...sel("designation")} autoComplete="organization-title" required /></Field>
        <Field label="Department / industry" name="department" errors={e("department")}><input {...sel("department")} required /></Field>
        <Field label="City" name="city" errors={e("city")}><input {...sel("city")} autoComplete="address-level2" required /></Field>
        <Field label="Participant category" name="category" errors={e("category")}>
          <select {...sel("category")} defaultValue="" required>
            <option value="" disabled>Select…</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Attended a previous Influencia?" name="previous_participation" errors={e("previous_participation")}>
          <select {...sel("previous_participation")} defaultValue="no"><option value="no">No</option><option value="yes">Yes</option></select>
        </Field>
      </div>

      {/* Honeypot: hidden from people and assistive tech */}
      <div aria-hidden className="absolute -left-[9999px]"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>

      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" className="mt-1 h-5 w-5 accent-crimson" required aria-describedby={e("consent") ? "consent-err" : undefined} />
          <span>I agree to the <Link href="/privacy" className="underline">Privacy Policy</Link> and <Link href="/terms" className="underline">Terms</Link>, and consent to being contacted about this event.</span>
        </label>
        {e("consent") && <p id="consent-err" role="alert" className="mt-1 text-sm text-crimson">{e("consent")![0]}</p>}
      </div>

      <button type="submit" disabled={pending} className="rounded-full bg-crimson px-8 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-maroon disabled:opacity-60">
        {pending ? "Submitting…" : "Submit registration"}
      </button>
    </form>
  );
}
