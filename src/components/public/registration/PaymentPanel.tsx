"use client";
import Image from "next/image";
import { useCallback, useEffect, useState, useTransition } from "react";
import { beginRazorpay, finishRazorpay, loadPaymentView, selectPaymentMethod, submitPaymentProof, type PaymentViewWithQr } from "@/modules/payments/actions";
import { buildUpiUri } from "@/modules/payments/upi-uri";
import { formatMoney } from "@/modules/payments/fees";
import { isOfflineMethod } from "@/modules/payments/rules";
import { inputCls } from "./Field";

const PROOF_ERRORS: Record<string, string> = {
  transaction_ref: "Enter the transaction / UTR reference exactly as shown in your payment app (6–40 letters or digits).",
  reference_or_proof: "Add the transaction reference, a screenshot, or both.",
  too_large: "The file is larger than 5 MB.", unsupported_type: "Upload a JPG, PNG, WebP or PDF.", empty: "The file is empty.",
};
type RzpWindow = Window & { Razorpay?: new (o: Record<string, unknown>) => { open(): void } };

export function PaymentPanel({ reference, contact }: { reference: string; contact: string }) {
  const [view, setView] = useState<PaymentViewWithQr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reload = useCallback(async () => {
    const r = await loadPaymentView(reference, contact);
    if (r.ok) { setView(r.view); setError(null); } else setError("We couldn’t load payment details right now. Please refresh, or contact the team.");
  }, [reference, contact]);
  useEffect(() => {
    let live = true;
    void loadPaymentView(reference, contact).then((r) => {
      if (!live) return;
      if (r.ok) setView(r.view); else setError("We couldn’t load payment details right now. Please refresh, or contact the team.");
    });
    return () => { live = false; };
  }, [reference, contact]);

  if (error) return <p role="alert" className="rounded-xl bg-crimson/10 p-4 text-crimson">{error}</p>;
  if (!view) return <p className="text-charcoal/70">Loading payment options…</p>;

  const p = view.payment;
  const live = p && !["rejected", "failed"].includes(p.status) ? p : null;
  const method = live ? view.methods.find((m) => m.code === live.method) : undefined;

  const choose = (code: string) => start(async () => {
    const r = await selectPaymentMethod(reference, contact, code);
    if (!r.ok) setNote(r.error === "payment_in_progress" ? "A payment is already being verified." : "That payment method isn’t available right now.");
    await reload();
  });

  const onProof = (fd: FormData) => start(async () => {
    fd.set("reference", reference); fd.set("contact", contact); fd.set("paymentId", (live ?? p)!.id);
    const r = await submitPaymentProof(fd);
    if (r.ok) { setNote("Thank you — your payment details were submitted for verification."); await reload(); }
    else setNote(PROOF_ERRORS[r.detail ?? ""] ?? "We couldn’t submit that. Please check the details and try again.");
  });

  const payRazorpay = () => start(async () => {
    const o = await beginRazorpay(reference, contact, live!.id);
    if (!o.ok) { setNote("Online payment is unavailable right now."); return; }
    await new Promise<void>((res, rej) => {
      if ((window as RzpWindow).Razorpay) return res();
      const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = () => res(); s.onerror = () => rej(); document.head.appendChild(s);
    }).catch(() => setNote("Could not load the payment window."));
    const R = (window as RzpWindow).Razorpay; if (!R) return;
    new R({ key: o.keyId, order_id: o.orderId, amount: Math.round(o.amount * 100), currency: o.currency, name: "Influencia", description: reference,
      handler: (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        void finishRazorpay(reference, contact, resp.razorpay_order_id, resp.razorpay_payment_id, resp.razorpay_signature).then(reload);
      } }).open();
  });

  // ---- states ----
  if (view.registrationStatus === "confirmed") return <Box title="Seat confirmed"><p>Your seat is confirmed. See you on the day.</p></Box>;
  if (p && ["proof_submitted", "under_verification"].includes(p.status))
    return <Box title="Payment submitted"><p>Your payment details are with our team for verification. Your seat is confirmed only after verification and organizer approval. Check progress any time on the Registration Status page.</p></Box>;
  if (p && ["verified"].includes(p.status))
    return <Box title="Payment verified"><p>Thank you. Your payment is verified. The organizers will now approve your seat and you’ll be notified.</p></Box>;
  if (p && ["refunded", "partially_refunded"].includes(p.status))
    return <Box title="Payment refunded"><p>A refund has been recorded for this registration. Contact the team for details.</p></Box>;

  if (!view.methods.length)
    return <Box title="Payment"><p>Payment options are not open yet. Your registration is saved under reference <strong>{reference}</strong>; the team will be in touch, or return to Registration Status later.</p></Box>;

  return (
    <Box title="Complete your payment" busy={pending}>
      {note && <p role="status" className="mb-4 rounded-xl bg-white p-3 text-sm">{note}</p>}
      {p?.status === "rejected" && <p role="alert" className="mb-4 rounded-xl bg-crimson/10 p-3 text-crimson">Your last payment submission wasn’t accepted{p.rejectionReason ? `: ${p.rejectionReason}` : "."} Please resubmit below or choose another method.</p>}

      {!live && !(p?.status === "rejected") && (
        <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">Choose a payment method</legend>
          {view.methods.map((m) => (
            <button key={m.code} type="button" disabled={pending} onClick={() => choose(m.code)}
              className="flex w-full items-center justify-between rounded-xl border border-charcoal/20 bg-white px-5 py-4 text-left transition hover:border-crimson">
              <span>{m.label}</span><span className="font-semibold text-crimson">{formatMoney(m.amount, m.currency)}{m.discountLabel ? ` · ${m.discountLabel}` : ""}</span>
            </button>))}
        </fieldset>)}

      {live && method && (
        <div className="space-y-5">
          <p>Amount due: <strong className="text-crimson">{formatMoney(live.amount, live.currency)}</strong> via {method.label}</p>
          {method.config.instructions && <p className="whitespace-pre-line text-sm text-charcoal/80">{method.config.instructions}</p>}
          {(method.code === "upi" || method.code === "upi_qr") && method.config.upi_id && (
            <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
              {view.qr[method.code] && <Image unoptimized src={view.qr[method.code]} alt={`UPI QR code for ${formatMoney(live.amount, live.currency)}`} width={200} height={200} className="rounded-xl bg-white p-2" />}
              <div className="text-sm"><p>UPI ID: <strong className="select-all">{method.config.upi_id}</strong></p>
                <a className="mt-2 inline-block font-semibold text-crimson underline underline-offset-4 sm:hidden" href={buildUpiUri({ upiId: method.config.upi_id, payeeName: method.config.payee_name, amount: live.amount, currency: live.currency, note: reference })}>Open in UPI app</a></div>
            </div>)}
          {method.code === "bank_transfer" && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {([["Account name", "account_name"], ["Account number", "account_number"], ["IFSC", "ifsc"], ["Bank", "bank_name"], ["Branch", "branch"]] as const).map(([l, k]) => method.config[k] ? <div key={k} className="contents"><dt className="text-charcoal/70">{l}</dt><dd className="select-all font-medium">{method.config[k]}</dd></div> : null)}
            </dl>)}
          {method.code === "razorpay" && <button type="button" disabled={pending} onClick={payRazorpay} className="rounded-full bg-crimson px-8 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-white hover:bg-maroon disabled:opacity-60">Pay securely online</button>}
          {method.code === "venue" && <p className="text-sm">Quote reference <strong>{reference}</strong> at the venue desk. Your seat stays unconfirmed until the payment is recorded by the team.</p>}
          {method.code !== "razorpay" && !isOfflineMethod(method.code) && <ProofForm onSubmit={onProof} pending={pending} />}
          <button type="button" className="text-sm underline" onClick={() => setView({ ...view, payment: null })}>Use a different method</button>
        </div>)}

      {p?.status === "rejected" && <div className="mt-4"><ProofForm onSubmit={onProof} pending={pending} />
        <div className="mt-6 space-y-3">{view.methods.map((m) => <button key={m.code} type="button" disabled={pending} onClick={() => choose(m.code)} className="block text-sm underline">Pay with {m.label} ({formatMoney(m.amount, m.currency)})</button>)}</div></div>}
    </Box>
  );
}

function Box({ title, children, busy }: { title: string; children: React.ReactNode; busy?: boolean }) {
  return <section aria-busy={busy} className="mt-8 rounded-2xl border border-crimson/20 bg-warm p-6"><h3 className="mb-3 font-serif text-2xl">{title}</h3>{children}</section>;
}

function ProofForm({ onSubmit, pending }: { onSubmit: (fd: FormData) => void; pending: boolean }) {
  return (
    <form onSubmit={(ev) => { ev.preventDefault(); onSubmit(new FormData(ev.currentTarget)); }} className="space-y-4 border-t border-charcoal/10 pt-5">
      <p className="text-sm font-medium">After paying, tell us how:</p>
      <div><label htmlFor="txnRef" className="mb-1 block text-sm">Transaction / UTR reference</label><input id="txnRef" name="txnRef" className={inputCls} autoComplete="off" /></div>
      <div><label htmlFor="proof" className="mb-1 block text-sm">Payment screenshot or receipt (optional if reference given)</label><input id="proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="block w-full text-sm" /></div>
      <button type="submit" disabled={pending} className="rounded-full bg-crimson px-7 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-white hover:bg-maroon disabled:opacity-60">{pending ? "Submitting…" : "Submit payment details"}</button>
    </form>
  );
}
