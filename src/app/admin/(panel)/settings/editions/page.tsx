import Link from "next/link";
import { requirePageAccess } from "@/lib/auth";
import { adminEditions } from "@/modules/content/admin-queries";
import { createEdition } from "@/modules/content/actions";
import { btn, Badge, Card, field, Flash, PageTitle, when, type SP } from "@/components/admin/ui";

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("events.manage");
  const sp = await searchParams; const eds = (await adminEditions()) as { id: string; code: string; edition_number: number; title: string; status: string; is_featured: boolean; starts_at: string | null; capacity: number; registration_open: boolean }[];
  return (
    <>
      <PageTitle>Edition control centre</PageTitle><Flash ok={sp.ok} err={sp.err} />
      <Card title="Editions"><ul className="divide-y divide-charcoal/10">{eds.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-3 py-3 text-sm"><strong className="min-w-24">{e.code}</strong><span>{e.title}</span><Badge value={e.status} />
          {e.is_featured && <span className="rounded-full bg-crimson/10 px-2 py-0.5 text-xs text-crimson">featured on homepage</span>}
          <span className="text-charcoal/60">{when(e.starts_at)} · capacity {e.capacity} · registration {e.registration_open ? "open" : "closed"}</span>
          <Link className="ml-auto text-crimson underline" href={`/admin/settings/event?edition=${e.code}`}>Settings</Link><Link className="text-crimson underline" href={`/admin/settings/payments?edition=${e.code}`}>Payments</Link></li>))}</ul></Card>
      <Card title="Create a new edition" className="mt-6">
        <p className="mb-3 text-sm text-charcoal/70">Creates a draft edition (registration closed) with its own capacity, payment settings, registrations, galleries and certificates. Open it from Event settings when ready.</p>
        <form action={createEdition} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Title<input name="title" required placeholder="Influencia – Edition 4" className={`${field} mt-1`} /></label>
          <label className="text-sm">Subtitle<input name="subtitle" className={`${field} mt-1`} /></label>
          <label className="text-sm">Starts (IST)<input name="starts_at" type="datetime-local" className={`${field} mt-1`} /></label>
          <label className="text-sm">Capacity<input name="capacity" type="number" min={0} defaultValue={200} className={`${field} mt-1`} /></label>
          <label className="text-sm">Venue<input name="venue_name" className={`${field} mt-1`} /></label>
          <label className="text-sm">City<input name="venue_city" className={`${field} mt-1`} /></label>
          <div className="sm:col-span-2"><button className={btn}>Create edition</button></div></form></Card>
    </>
  );
}
