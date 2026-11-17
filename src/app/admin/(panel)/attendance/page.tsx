import { requirePageAccess } from "@/lib/auth";
import { attendedOf, searchConfirmed } from "@/modules/attendance/service";
import { dashboard, resolveEdition } from "@/modules/admin/queries";
import { manualCheckIn, undoCheckIn } from "@/modules/ops/actions";
import { Scanner } from "@/components/admin/Scanner";
import { btn, btnGhost, btnGhost as g, Card, EditionSwitcher, field, Flash, PageTitle, Stat, Td, Th, when, type SP } from "@/components/admin/ui";

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("attendance.manage");
  const sp = await searchParams; const { edition, all } = await resolveEdition(sp.edition);
  if (!edition) return <p>No edition.</p>;
  const [d, rows] = await Promise.all([dashboard(edition), searchConfirmed(edition.id, sp.q ?? "")]);
  const back = `/admin/attendance?edition=${edition.code}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`; void g;
  return (
    <>
      <PageTitle actions={<a className={btnGhost} href={`/admin/export/attendance?edition=${edition.code}`}>Export CSV</a>}>Attendance</PageTitle><Flash ok={sp.ok} err={sp.err} />
      <EditionSwitcher all={all} current={edition} base="/admin/attendance" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3"><Stat label="Confirmed" value={d.reg.confirmed} /><Stat label="Checked in" value={d.reg.checkedIn} /><Stat label="Attendance" value={`${d.reg.attendanceRate}%`} /></div>
      <Card title="QR check-in"><Scanner editionCode={edition.code} /></Card>
      <Card title="Manual check-in & corrections" className="mt-6">
        <form className="mb-4 flex gap-2"><input type="hidden" name="edition" value={edition.code} /><input name="q" defaultValue={sp.q} placeholder="Search confirmed participants" aria-label="Search" className={field} /><button className={btn}>Search</button></form>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><Th>Participant</Th><Th>Reference</Th><Th>Check-in</Th><Th /></tr></thead><tbody className="divide-y divide-charcoal/5">
          {rows.map((r) => { const at = attendedOf(r.attendance); return (
            <tr key={r.id}><Td>{r.participants.full_name}<div className="text-xs text-charcoal/60">{r.participants.organization}</div></Td><Td>{r.reference}</Td>
              <Td>{at ? <span className="text-emerald-800">{when(at.checked_in_at)} ({at.method})</span> : <span className="text-charcoal/50">—</span>}</Td>
              <Td>{at ? (
                <form action={undoCheckIn} className="flex gap-2"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} /><input name="note" required minLength={3} placeholder="Reason for correction" aria-label="Reason" className={`${field} max-w-48`} /><button className={btnGhost}>Undo</button></form>
              ) : <form action={manualCheckIn}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} /><button className={btn}>Check in</button></form>}</Td></tr>); })}
          {!rows.length && <tr><Td className="py-6 text-center text-charcoal/60">No confirmed participants match.</Td></tr>}</tbody></table></div>
      </Card>
    </>
  );
}
