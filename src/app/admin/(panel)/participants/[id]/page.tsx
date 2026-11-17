import { notFound } from "next/navigation";
import { requirePageAccess } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { registrationDetail } from "@/modules/admin/queries";
import { approveRegistration, changeRegistrationStatus, refundPayment, rejectPayment, reviewPayment, updateParticipant, verifyPayment } from "@/modules/admin/actions";
import { ProofButton } from "@/components/admin/ProofButton";
import { Badge, btn, btnGhost, Card, field, Flash, money, PageTitle, when, type SP } from "@/components/admin/ui";
import { CATEGORIES } from "@/modules/registration/schemas";
import { whatsappLink } from "@/modules/notifications/service";
import { TEMPLATE_LABELS, type TemplateKey } from "@/modules/notifications/templates";
import { resendNotification } from "@/modules/ops/actions";

type Ev = { id: number; event_type: string; from_status: string | null; to_status: string | null; amount: number | null; created_at: string; data: Record<string, unknown> };
type Pay = { id: string; status: string; method_code: string; amount: number; currency: string; transaction_ref: string | null; rejection_reason: string | null; fee_snapshot?: Record<string, unknown>; created_at: string;
  payment_events?: Ev[]; payment_proofs?: { id: string; mime: string; uploaded_at: string }[]; refunds?: { id: string; amount: number; reason: string; created_at: string }[] };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const a = await requirePageAccess("participants.read");
  const { id } = await params; const sp = await searchParams;
  const canPay = can(a.role, "payments.read");
  const d = await registrationDetail(id, canPay);
  if (!d) notFound();
  const { reg, history, attendance } = d; const p = reg.participants; const pays = d.payments as unknown as Pay[];
  const back = `/admin/participants/${id}`;
  const contactKeys: TemplateKey[] = reg.status === "confirmed" ? ["registration_approved", "event_reminder", "event_day", "post_event_thanks"] : ["registration_ack", "payment_ack"];
  const wa = can(a.role, "participants.write") ? await Promise.all(contactKeys.map(async (k) => [k, await whatsappLink(k, id)] as const)) : [];
  const canReview = can(a.role, "registrations.review"), canVerify = can(a.role, "payments.verify"), canRefund = can(a.role, "payments.refund");
  return (
    <>
      <PageTitle actions={<Badge value={reg.status} />}>{p.full_name} <span className="text-lg text-charcoal/60">· {reg.reference}</span></PageTitle>
      <Flash ok={sp.ok} err={sp.err} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Participant">
          {can(a.role, "participants.write") ? (
            <form action={updateParticipant} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="regId" value={id} /><input type="hidden" name="participantId" value={p.id} />
              {([["full_name", "Full name"], ["mobile", "Mobile"], ["whatsapp", "WhatsApp"], ["organization", "Organization"], ["designation", "Designation"], ["department", "Department / industry"], ["city", "City"]] as const).map(([k, l]) => (
                <label key={k} className="text-sm">{l}<input name={k} defaultValue={p[k] ?? ""} className={`${field} mt-1`} /></label>))}
              <p className="text-sm text-charcoal/70">Email<br /><strong>{p.email}</strong></p>
              <div className="sm:col-span-2"><button className={btn}>Save changes</button></div>
            </form>
          ) : <dl className="space-y-1 text-sm">{Object.entries({ Email: p.email, Mobile: p.mobile, Organization: p.organization, City: p.city }).map(([k, v]) => <div key={k}><dt className="inline text-charcoal/60">{k}: </dt><dd className="inline">{v as string}</dd></div>)}</dl>}
          <p className="mt-4 text-sm text-charcoal/70">Category: {CATEGORIES.find((c) => c.value === reg.category)?.label} · Previous participant: {reg.previous_participation ? "Yes" : "No"} · Registered {when(reg.created_at)}</p>
          <p className="mt-1 text-sm text-charcoal/70">Attendance: {attendance ? `Checked in ${when(attendance.checked_in_at)} (${attendance.method})` : "Not checked in"}</p>
        </Card>

        {canReview && (
          <Card title="Decision">
            <form action={approveRegistration} className="space-y-3"><input type="hidden" name="id" value={id} />
              <button className={btn} disabled={reg.status === "confirmed"}>Approve &amp; confirm seat</button>
              {a.role === "super_admin" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="override" /> Override missing payment verification (audited)</label>}
              <p className="text-xs text-charcoal/60">Seats are allocated in a locked transaction; approval fails if capacity is full and the waiting list is off.</p></form>
            <form action={changeRegistrationStatus} className="mt-5 grid gap-3 border-t border-charcoal/10 pt-4">
              <input type="hidden" name="id" value={id} />
              <select name="status" className={field} aria-label="New status"><option value="waitlisted">Waitlist</option><option value="rejected">Reject</option><option value="cancelled">Cancel</option></select>
              <input name="note" placeholder="Reason (required to reject or cancel)" className={field} />
              <button className={btnGhost}>Apply</button></form>
          </Card>)}
      </div>

      {can(a.role, "participants.write") && (
        <Card title="Contact participant" className="mt-6">
          <ul className="space-y-2 text-sm">{wa.map(([k, link]) => (
            <li key={k} className="flex flex-wrap items-center gap-3"><span className="min-w-56">{TEMPLATE_LABELS[k]}</span>
              {link && <a className={btnGhost} href={link} target="_blank" rel="noopener noreferrer">Open in WhatsApp</a>}
              <form action={resendNotification}><input type="hidden" name="id" value={id} /><input type="hidden" name="key" value={k} /><button className={btnGhost}>Send email</button></form></li>))}</ul>
          <p className="mt-3 text-xs text-charcoal/60">WhatsApp opens a click-to-chat with the message prepared; nothing is sent until you press send there. The official group link is only included for confirmed participants.</p>
        </Card>)}

      <Card title="Payments" className="mt-6">
        {!canPay ? <ul className="text-sm">{(d.payments as { id: string; status: string }[]).map((x) => <li key={x.id}><Badge value={x.status} /></li>)}{d.payments.length === 0 && <li>No payment yet.</li>}</ul> :
          pays.length === 0 ? <p className="text-sm text-charcoal/60">No payment started.</p> :
          <div className="space-y-6">{pays.map((x) => (
            <div key={x.id} className="rounded-xl border border-charcoal/10 p-4">
              <p className="flex flex-wrap items-center gap-3"><Badge value={x.status} /><strong>{money(Number(x.amount), x.currency)}</strong><span className="text-sm text-charcoal/60">{x.method_code} · {when(x.created_at)}</span></p>
              {x.transaction_ref && <p className="mt-1 text-sm">Transaction ref: <strong className="select-all">{x.transaction_ref}</strong></p>}
              {x.rejection_reason && <p className="mt-1 text-sm text-red-700">Rejected: {x.rejection_reason}</p>}
              {x.fee_snapshot && <p className="mt-1 text-xs text-charcoal/60">Fee snapshot: base {String(x.fee_snapshot.base_fee)} → {String(x.fee_snapshot.final)} (settings v{String(x.fee_snapshot.settings_version)})</p>}
              <p className="mt-2 flex flex-wrap gap-4">{(x.payment_proofs ?? []).map((pr, i) => <ProofButton key={pr.id} id={pr.id} label={`View proof ${i + 1} (${pr.mime.split("/")[1]})`} />)}</p>
              {canVerify && ["proof_submitted", "under_verification"].includes(x.status) && (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="flex flex-wrap gap-2">
                    {x.status === "proof_submitted" && <form action={reviewPayment}><input type="hidden" name="paymentId" value={x.id} /><input type="hidden" name="back" value={back} /><button className={btnGhost}>Start review</button></form>}
                    <form action={verifyPayment}><input type="hidden" name="paymentId" value={x.id} /><input type="hidden" name="back" value={back} /><button className={btn}>Verify payment</button></form></div>
                  <form action={rejectPayment} className="flex gap-2"><input type="hidden" name="paymentId" value={x.id} /><input type="hidden" name="back" value={back} /><input name="reason" required minLength={3} placeholder="Rejection reason" className={field} /><button className={btnGhost}>Reject</button></form>
                </div>)}
              {canRefund && ["verified", "partially_refunded"].includes(x.status) && (
                <form action={refundPayment} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="paymentId" value={x.id} /><input type="hidden" name="back" value={back} />
                  <input name="amount" type="number" step="0.01" min="0.01" required placeholder="Refund amount" className={`${field} max-w-40`} /><input name="reason" placeholder="Reason" className={`${field} max-w-xs`} /><button className={btnGhost}>Record refund</button></form>)}
              {(x.refunds?.length ?? 0) > 0 && <ul className="mt-3 text-sm text-charcoal/70">{x.refunds!.map((r) => <li key={r.id}>Refund {money(Number(r.amount), x.currency)} — {r.reason} ({when(r.created_at)})</li>)}</ul>}
              <details className="mt-3 text-sm"><summary className="cursor-pointer text-charcoal/70">Transaction history ({x.payment_events?.length ?? 0})</summary>
                <ol className="mt-2 space-y-1">{(x.payment_events ?? []).map((e) => <li key={e.id}>{when(e.created_at)} — {e.event_type.replace(/_/g, " ")}{e.to_status ? ` → ${e.to_status.replace(/_/g, " ")}` : ""}</li>)}</ol></details>
            </div>))}</div>}
      </Card>

      <Card title="Registration history" className="mt-6">
        <ol className="space-y-1 text-sm">{history.map((h: { id: number; from_status: string | null; to_status: string; note: string | null; created_at: string }) => <li key={h.id}>{when(h.created_at)} — {h.from_status ? `${h.from_status.replace(/_/g, " ")} → ` : ""}<strong>{h.to_status.replace(/_/g, " ")}</strong>{h.note ? ` (${h.note})` : ""}</li>)}</ol>
      </Card>
    </>
  );
}
