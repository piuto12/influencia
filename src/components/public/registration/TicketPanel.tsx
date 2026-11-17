"use client";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { downloadMyCertificate, getMyTicket, type Ticket } from "@/modules/ops/actions";

/** Shown only to a confirmed participant who has proven reference + contact. */
export function TicketPanel({ reference, contact }: { reference: string; contact: string }) {
  const [t, setT] = useState<Ticket | null | undefined>(undefined);
  const [busy, start] = useTransition(); const [err, setErr] = useState(false);
  useEffect(() => { let live = true; void getMyTicket(reference, contact).then((r) => { if (live) setT(r); }); return () => { live = false; }; }, [reference, contact]);
  if (!t) return t === undefined ? <p className="mt-6 text-sm text-charcoal/70">Loading your ticket…</p> : null;
  return (
    <section className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-6">
      <h3 className="font-serif text-2xl">Your check-in ticket</h3>
      <p className="mt-1 text-sm text-charcoal/75">Show this QR code at the registration desk. It is personal to you — please don’t share it.</p>
      {t.qr && <Image unoptimized src={t.qr} alt={`Check-in QR code for ${reference}`} width={220} height={220} className="mt-4 rounded-xl bg-white p-2" />}
      {t.certificate && (
        <div className="mt-5"><button type="button" disabled={busy} className="rounded-full bg-crimson px-6 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white hover:bg-maroon disabled:opacity-60" onClick={() => start(async () => {
          setErr(false); const f = await downloadMyCertificate(reference, contact);
          if (!f) { setErr(true); return; }
          const blob = new Blob([Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = f.filename; a.click(); URL.revokeObjectURL(a.href);
        })}>{busy ? "Preparing…" : "Download certificate (PDF)"}</button>{err && <p role="alert" className="mt-2 text-sm text-red-700">Certificate unavailable right now.</p>}</div>)}
    </section>
  );
}
