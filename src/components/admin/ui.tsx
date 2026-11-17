import Link from "next/link";
import type { ReactNode } from "react";
import type { EditionLite } from "@/modules/admin/queries";

export const btn = "inline-flex items-center rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-white transition hover:bg-maroon disabled:opacity-50";
export const btnGhost = "inline-flex items-center rounded-lg border border-charcoal/25 bg-white px-4 py-2 text-sm font-medium transition hover:border-crimson hover:text-crimson";
export const field = "w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2 text-sm outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/20";

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-charcoal/10 bg-white p-5 shadow-sm ${className}`}>{title && <h2 className="mb-3 font-serif text-xl">{title}</h2>}{children}</section>;
}
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return <div className="rounded-2xl border border-charcoal/10 bg-white p-5"><p className="text-xs uppercase tracking-widest text-charcoal/60">{label}</p><p className="mt-1 font-display text-4xl text-crimson">{value}</p>{hint && <p className="mt-1 text-xs text-charcoal/60">{hint}</p>}</div>;
}
const TONE: Record<string, string> = {
  confirmed: "bg-emerald-100 text-emerald-800", verified: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800", cancelled: "bg-red-100 text-red-800", failed: "bg-red-100 text-red-800",
  waitlisted: "bg-amber-100 text-amber-800", under_verification: "bg-amber-100 text-amber-800", proof_submitted: "bg-amber-100 text-amber-800",
  refunded: "bg-slate-200 text-slate-700", partially_refunded: "bg-slate-200 text-slate-700",
};
export function Badge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-charcoal/40">—</span>;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[value] ?? "bg-charcoal/10 text-charcoal"}`}>{value.replace(/_/g, " ")}</span>;
}
export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return <p role={err ? "alert" : "status"} className={`mb-5 rounded-lg px-4 py-3 text-sm ${err ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>{err ?? ok}</p>;
}
export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="font-serif text-3xl">{children}</h1><div className="flex gap-2">{actions}</div></div>;
}
export function EditionSwitcher({ all, current, base }: { all: EditionLite[]; current: EditionLite; base: string }) {
  if (all.length < 2) return <p className="mb-4 text-sm text-charcoal/60">Edition: <strong>{current.title}</strong></p>;
  return <nav aria-label="Edition" className="mb-4 flex flex-wrap gap-2 text-sm">{all.map((e) => <Link key={e.id} href={`${base}?edition=${e.code}`} className={`rounded-full border px-3 py-1 ${e.id === current.id ? "border-crimson bg-crimson text-white" : "border-charcoal/20 bg-white"}`}>{e.code}</Link>)}</nav>;
}
export function Th({ children }: { children?: ReactNode }) { return <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-charcoal/60">{children}</th>; }
export const Td = ({ children, className = "" }: { children?: ReactNode; className?: string }) => <td className={`px-3 py-2.5 align-top ${className}`}>{children}</td>;
export const money = (n: number, c: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: c.trim() }).format(n);
export const when = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "—";
export type SP = Promise<Record<string, string | undefined>>;
export function L({ k, label, type = "text", v }: { k: string; label: string; type?: string; v?: string | number | null }) {
  return <label className="text-sm">{label}<input name={k} type={type} defaultValue={v ?? ""} className={`${field} mt-1`} /></label>;
}
export function I({ k, l, v, type = "text" }: { k: string; l: string; v?: string | number | null; type?: string }) {
  return <label className="text-sm">{l}<input name={k} type={type} defaultValue={v ?? ""} className={`${field} mt-1`} /></label>;
}
