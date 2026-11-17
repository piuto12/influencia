import { requirePageAccess } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dashboard, resolveEdition } from "@/modules/admin/queries";
import { Card, EditionSwitcher, PageTitle, btnGhost, money, Td, Th, type SP } from "@/components/admin/ui";
import { CATEGORIES } from "@/modules/registration/schemas";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const a = await requirePageAccess(["reports.registration", "reports.finance"]);
  const sp = await searchParams;
  const { edition, all } = await resolveEdition(sp.edition);
  if (!edition) return <p>No edition.</p>;
  const d = await dashboard(edition);
  const base = `?edition=${edition.code}`;
  return (
    <>
      <PageTitle>Reports</PageTitle><EditionSwitcher all={all} current={edition} base="/admin/reports" />
      {can(a.role, "reports.registration") && <>
        <Card title="Registration report" className="mb-6">
          <p className="mb-3 flex gap-3"><a className={btnGhost} href={`/admin/export/registrations${base}`}>Download CSV</a></p>
          <table className="w-full max-w-md text-sm"><tbody>{Object.entries(d.reg.byStatus).map(([k, v]) => <tr key={k}><Td>{k.replace(/_/g, " ")}</Td><Td className="text-right">{v}</Td></tr>)}
            <tr className="border-t font-semibold"><Td>Total</Td><Td className="text-right">{d.reg.total}</Td></tr></tbody></table>
        </Card>
        <Card title="Category-wise" className="mb-6">
          <table className="w-full max-w-md text-sm"><tbody>{CATEGORIES.map((c) => <tr key={c.value}><Td>{c.label}</Td><Td className="text-right">{d.reg.byCategory[c.value] ?? 0}</Td></tr>)}</tbody></table>
        </Card>
        <Card title="Attendance & certificates" className="mb-6"><p className="mb-3 text-sm">{d.reg.checkedIn} checked in of {d.reg.confirmed} confirmed ({d.reg.attendanceRate}%).</p><p className="flex gap-3">{can(a.role, "attendance.manage") && <a className={btnGhost} href={`/admin/export/attendance${base}`}>Attendance CSV</a>}{can(a.role, "certificates.manage") && <a className={btnGhost} href={`/admin/export/certificates${base}`}>Certificates CSV</a>}</p></Card>
      </>}
      {can(a.role, "reports.finance") && (
        <Card title="Payment report & reconciliation">
          <p className="mb-3"><a className={btnGhost} href={`/admin/export/payments${base}`}>Download CSV</a></p>
          <table className="w-full max-w-lg text-sm"><thead><tr><Th>Currency</Th><Th>Verified</Th><Th>Refunded</Th><Th>Net</Th></tr></thead>
            <tbody>{Object.keys(d.pay.collected).length === 0 && <tr><Td>No verified payments yet.</Td></tr>}
              {Object.keys(d.pay.collected).map((c) => <tr key={c}><Td>{c}</Td><Td>{money(d.pay.collected[c], c)}</Td><Td>{money(d.pay.refunded[c] ?? 0, c)}</Td><Td className="font-semibold">{money(d.pay.net[c], c)}</Td></tr>)}</tbody></table>
          <p className="mt-3 text-sm text-charcoal/70">Awaiting verification: {d.pay.awaitingVerification}</p>
        </Card>)}
    </>
  );
}
