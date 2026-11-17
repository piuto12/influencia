import Link from "next/link";
import { requirePageAccess } from "@/lib/auth";
import { paymentQueue, resolveEdition } from "@/modules/admin/queries";
import { Badge, btnGhost, EditionSwitcher, money, PageTitle, Td, Th, when, type SP } from "@/components/admin/ui";

const FILTERS = [["", "Needs review"], ["verified", "Verified"], ["rejected", "Rejected"], ["pending", "Pending"], ["refunded", "Refunded"], ["partially_refunded", "Part-refunded"]];

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("payments.read");
  const sp = await searchParams;
  const { edition, all } = await resolveEdition(sp.edition);
  if (!edition) return <p>No edition.</p>;
  const rows = await paymentQueue(edition.id, sp.status);
  return (
    <>
      <PageTitle actions={<a className={btnGhost} href={`/admin/export/payments?edition=${edition.code}`}>Export CSV</a>}>Payments</PageTitle>
      <EditionSwitcher all={all} current={edition} base="/admin/payments" />
      <nav aria-label="Filter" className="mb-4 flex flex-wrap gap-2 text-sm">{FILTERS.map(([v, l]) => <Link key={v} href={`/admin/payments?edition=${edition.code}${v ? `&status=${v}` : ""}`} className={`rounded-full border px-3 py-1 ${(sp.status ?? "") === v ? "border-crimson bg-crimson text-white" : "border-charcoal/20 bg-white"}`}>{l}</Link>)}</nav>
      <div className="overflow-x-auto rounded-2xl border border-charcoal/10 bg-white">
        <table className="w-full text-sm"><thead className="border-b border-charcoal/10"><tr><Th>Participant</Th><Th>Method</Th><Th>Amount</Th><Th>Txn ref</Th><Th>Status</Th><Th>Created</Th></tr></thead>
          <tbody className="divide-y divide-charcoal/5">{rows.map((r) => <tr key={r.id} className="hover:bg-warm">
            <Td><Link className="font-medium text-crimson underline" href={`/admin/participants/${r.registrations.id}`}>{r.registrations.participants.full_name}</Link><div className="text-xs text-charcoal/60">{r.registrations.reference}</div></Td>
            <Td>{r.method_code}</Td><Td>{money(Number(r.amount), r.currency)}</Td><Td>{r.transaction_ref ?? "—"}</Td><Td><Badge value={r.status} /></Td><Td>{when(r.created_at)}</Td></tr>)}
            {rows.length === 0 && <tr><Td className="py-8 text-center text-charcoal/60">Nothing here.</Td></tr>}</tbody></table>
      </div>
    </>
  );
}
