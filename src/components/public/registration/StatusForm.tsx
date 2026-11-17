"use client";
import { startTransition, useActionState, useState } from "react";
import { checkStatus, type StatusState } from "@/modules/registration/actions";
import { Field, inputCls } from "./Field";
import { PaymentPanel } from "./PaymentPanel";
import { TicketPanel } from "./TicketPanel";

const LABEL: Record<string, string> = {
  submitted: "Submitted", payment_pending: "Awaiting payment", proof_submitted: "Payment proof submitted",
  under_verification: "Under verification", confirmed: "Confirmed", rejected: "Not approved",
  cancelled: "Cancelled", waitlisted: "Waitlisted",
};

export function StatusForm() {
  const [state, action, pending] = useActionState<StatusState, FormData>(checkStatus, null);
  const [contact, setContact] = useState("");
  return (
    <div className="space-y-8">
      <form onSubmit={(ev) => { ev.preventDefault(); const f = new FormData(ev.currentTarget); setContact(String(f.get("contact") ?? "").trim()); startTransition(() => action(f)); }} className="space-y-6" aria-busy={pending}>
        <Field label="Registration reference" name="reference"><input id="reference" name="reference" required placeholder="INF3-XXXXXX" className={inputCls} autoCapitalize="characters" /></Field>
        <Field label="Email or mobile number used to register" name="contact"><input id="contact" name="contact" required className={inputCls} autoComplete="off" /></Field>
        <button type="submit" disabled={pending} className="rounded-full bg-crimson px-8 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-white hover:bg-maroon disabled:opacity-60">{pending ? "Checking…" : "Check status"}</button>
      </form>
      <div role="status" aria-live="polite">
        {state && "error" in state && <p className="rounded-xl bg-crimson/10 p-4 text-crimson">{state.error === "rate_limited" ? "Too many attempts. Please wait a few minutes." : "Status lookup is temporarily unavailable."}</p>}
        {state && "found" in state && !state.found && <p className="rounded-xl bg-crimson/10 p-4 text-crimson">We couldn’t find a registration matching those details. Check the reference and the email or mobile you used.</p>}
        {state && "found" in state && state.found && (
          <div className="rounded-2xl border border-crimson/20 bg-white p-6">
            <p className="text-sm text-charcoal/70">Hello {state.firstName} — {state.editionTitle}</p>
            <p className="mt-1 font-display text-3xl text-crimson">{LABEL[state.status] ?? state.status}</p>
            <p className="mt-2 text-sm">Reference {state.reference}{state.paymentStatus ? ` · Payment: ${state.paymentStatus.replace(/_/g, " ")}` : ""}</p>
            {state.whatsappGroupUrl && <a href={state.whatsappGroupUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block font-semibold text-crimson underline underline-offset-4">Join the official WhatsApp group</a>}
            {state.status === "confirmed" && <TicketPanel reference={state.reference} contact={contact} />}
            <PaymentPanel key={state.reference + state.status} reference={state.reference} contact={contact} />
          </div>
        )}
      </div>
    </div>
  );
}
