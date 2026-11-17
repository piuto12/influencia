import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageShell } from "@/components/public/PageShell";
import { EmptyState } from "@/components/public/Section";
import { getPublicEditions } from "@/modules/content/queries";

export const metadata: Metadata = { title: "Previous Editions · Influencia" };
const LABEL: Record<string, string> = { upcoming: "Upcoming", active: "Open now", completed: "Completed", archived: "Archived" };

async function List() {
  const eds = (await getPublicEditions()).sort((a, b) => b.edition_number - a.edition_number);
  if (!eds.length) return <EmptyState>Editions will be listed here.</EmptyState>;
  return <ul className="space-y-6">{eds.map((e) => (
    <li key={e.id} id={e.code} className="rounded-2xl border border-charcoal/10 bg-white p-6">
      <p className="text-xs uppercase tracking-widest text-crimson">{LABEL[e.status] ?? e.status}</p>
      <h2 className="mt-1 font-serif text-2xl">{e.title}</h2>
      {e.subtitle && <p className="text-charcoal/70">{e.subtitle}</p>}
      <p className="mt-2 text-sm text-charcoal/70">{e.starts_at ? new Date(e.starts_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }) : "Date to be announced"}{e.venue_name ? ` · ${e.venue_name}${e.venue_city ? `, ${e.venue_city}` : ""}` : ""}</p>
      <p className="mt-3 text-sm"><Link className="text-crimson underline" href="/gallery">Photos</Link> · <Link className="text-crimson underline" href="/videos">Videos</Link>{e.status === "active" && <> · <Link className="text-crimson underline" href="/register">Register</Link></>}</p>
    </li>))}</ul>;
}
export default function Page() {
  return <PageShell title="Previous Editions" eyebrow="Archive"><Suspense fallback={<p>Loading…</p>}><List /></Suspense></PageShell>;
}
