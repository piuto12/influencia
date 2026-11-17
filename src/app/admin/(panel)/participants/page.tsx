import Link from "next/link";
import { requirePageAccess } from "@/lib/auth";
import { latestPayment, listRegistrations, PAGE_SIZE, resolveEdition } from "@/modules/admin/queries";
import { CATEGORIES } from "@/modules/registration/schemas";
import { Badge, btn, btnGhost, EditionSwitcher, field, PageTitle, Td, Th, type SP } from "@/components/admin/ui";

const STATUSES = ["submitted", "payment_pending", "proof_submitted", "under_verification", "confirmed", "rejected", "cancelled", "waitlisted"];

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("participants.read");
  const sp = await searchParams;
  const { edition, all } = await resolveEdition(sp.edition);
  if (!edition) return <p>No edition.</p>;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listRegistrations(edition.id, { q: sp.q, status: sp.status, category: sp.category, page });
  const qs = (o: Record<string, string | number | undefined>) => { const p = new URLSearchParams(); const m = { edition: edition.code, q: sp.q, status: sp.status, category: sp.category, ...o }; for (const [k, v] of Object.entries(m)) if (v) p.set(k, String(v)); return `?${p}`; };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <>
      <PageTitle actions={<a className={btnGhost} href={`/admin/export/registrations${qs({ page: undefined })}`}>Export CSV</a>}>Participants</PageTitle>
      <EditionSwitcher all={all} current={edition} base="/admin/participants" />
      <form className="mb-5 grid gap-3 sm:grid-cols-[1fr_11rem_13rem_auto]">
        <input type="hidden" name="edition" value={edition.code} />
        <input name="q" defaultValue={sp.q} placeholder="Search name, email, mobile, organization" aria-label="Search" className={field} />
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className={field}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
        <select name="category" defaultValue={sp.category ?? ""} aria-label="Category" className={field}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        <button className={btn}>Filter</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-charcoal/10 bg-white">
        <table className="w-full text-sm"><thead className="border-b border-charcoal/10"><tr><Th>Reference</Th><Th>Name</Th><Th>Contact</Th><Th>Category</Th><Th>Registration</Th><Th>Payment</Th></tr></thead>
          <tbody className="divide-y divide-charcoal/5">
            {rows.map((r) => (<tr key={r.id} className="hover:bg-warm">
              <Td><Link className="font-medium text-crimson underline" href={`/admin/participants/${r.id}`}>{r.reference}</Link></Td>
              <Td>{r.participants.full_name}<div className="text-xs text-charcoal/60">{r.participants.organization}</div></Td>
              <Td><div>{r.participants.email}</div><div className="text-xs text-charcoal/60">{r.participants.mobile}</div></Td>
              <Td>{CATEGORIES.find((c) => c.value === r.category)?.label}</Td>
              <Td><Badge value={r.status} /></Td><Td><Badge value={latestPayment(r)?.status} /></Td></tr>))}
            {rows.length === 0 && <tr><Td className="py-8 text-center text-charcoal/60">No registrations match.</Td></tr>}
          </tbody></table>
      </div>
      <p className="mt-4 flex items-center gap-4 text-sm">{total} result{total === 1 ? "" : "s"} · page {page} of {pages}
        {page > 1 && <Link className="text-crimson underline" href={qs({ page: page - 1 })}>Previous</Link>}
        {page < pages && <Link className="text-crimson underline" href={qs({ page: page + 1 })}>Next</Link>}</p>
    </>
  );
}
