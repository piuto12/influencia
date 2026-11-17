import { requirePageAccess } from "@/lib/auth";
import { eligibleWithoutCertificate, getTemplate, listCertificates } from "@/modules/certificates/service";
import { canRenderName } from "@/modules/certificates/pdf";
import { resolveEdition } from "@/modules/admin/queries";
import { issueAllCertificates, revokeCertificateAction, saveCertificateTemplate } from "@/modules/ops/actions";
import { UploadField } from "@/components/admin/UploadField";
import { btn, btnGhost, Card, EditionSwitcher, field, Flash, PageTitle, Stat, Td, Th, when, type SP } from "@/components/admin/ui";

// Bulk email / PDF / export work can exceed the platform default timeout.
export const maxDuration = 60;

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("certificates.manage");
  const sp = await searchParams; const { edition, all } = await resolveEdition(sp.edition);
  if (!edition) return <p>No edition.</p>;
  const [tpl, certs, el] = await Promise.all([getTemplate(edition.id), listCertificates(edition.id), eligibleWithoutCertificate(edition.id)]);
  const c = tpl?.config ?? {}; const active = certs.filter((x) => !x.revoked_at); const back = `/admin/certificates?edition=${edition.code}`;
  const odd = [...certs.map((x) => x.registrations.participants.full_name), ...el.eligible.map((x) => x.participants.full_name)].filter((n) => !canRenderName(n));
  return (
    <>
      <PageTitle actions={active.length ? <a className={btnGhost} href={`/admin/certificates/pdf?edition=${edition.code}&all=1`}>Download all (one PDF)</a> : undefined}>Certificates</PageTitle><Flash ok={sp.ok} err={sp.err} />
      <EditionSwitcher all={all} current={edition} base="/admin/certificates" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3"><Stat label="Issued" value={active.length} /><Stat label="Eligible, not yet issued" value={el.eligible.length} hint={el.need ? "Rule: confirmed AND checked in" : "Rule: confirmed"} /><Stat label="Confirmed" value={el.confirmed} /></div>
      {odd.length > 0 && <p role="alert" className="mb-4 rounded-lg bg-amber-100 px-4 py-3 text-sm text-amber-900">Some names contain characters the built-in certificate font cannot print ({odd.slice(0, 3).join(", ")}{odd.length > 3 ? "…" : ""}); they will appear with “?”. Edit the participant’s name to a Latin spelling before issuing.</p>}
      <Card title="Issue certificates"><form action={issueAllCertificates} className="flex flex-wrap items-center gap-3"><input type="hidden" name="editionId" value={edition.id} /><input type="hidden" name="code" value={edition.code} />
        <button className={btn} disabled={!el.eligible.length}>Issue {el.eligible.length} certificate{el.eligible.length === 1 ? "" : "s"}</button><span className="text-sm text-charcoal/60">Only confirmed participants meeting the attendance rule are included.</span></form></Card>
      <Card title="Template" className="mt-6"><form action={saveCertificateTemplate} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="editionId" value={edition.id} /><input type="hidden" name="code" value={edition.code} />
        <label className="text-sm">Heading<input name="heading" defaultValue={c.heading ?? ""} placeholder="Certificate of Participation" className={`${field} mt-1`} /></label>
        <label className="text-sm">Body line<input name="body_text" defaultValue={c.body_text ?? ""} placeholder="has participated in" className={`${field} mt-1`} /></label>
        <label className="text-sm">Organizer name<input name="organizer" defaultValue={c.organizer ?? ""} placeholder="Dr. Rashid Gazzali / Influencia Team" className={`${field} mt-1`} /></label>
        <label className="text-sm">Authorized signatory<input name="signatory_name" defaultValue={c.signatory_name ?? ""} className={`${field} mt-1`} /></label>
        <label className="text-sm">Signatory title<input name="signatory_title" defaultValue={c.signatory_title ?? ""} className={`${field} mt-1`} /></label>
        <UploadField name="signature_path" folder="misc" label="Signature image (PNG, optional)" initial={c.signature_path} />
        <div className="sm:col-span-2"><button className={btn}>Save template</button></div></form></Card>
      <Card title="Issued certificates" className="mt-6"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><Th>Participant</Th><Th>Certificate ID</Th><Th>Issued</Th><Th>Status</Th><Th /></tr></thead><tbody className="divide-y divide-charcoal/5">
        {certs.map((x) => (<tr key={x.certificate_code}><Td>{x.registrations.participants.full_name}</Td><Td><code>{x.certificate_code}</code></Td><Td>{when(x.issued_at)}</Td>
          <Td>{x.revoked_at ? <span className="text-red-700">revoked{x.revoked_reason ? `: ${x.revoked_reason}` : ""}</span> : <span className="text-emerald-800">valid</span>}</Td>
          <Td>{!x.revoked_at && <div className="flex flex-wrap gap-2"><a className={btnGhost} href={`/admin/certificates/pdf?code=${x.certificate_code}`}>PDF</a>
            <form action={revokeCertificateAction} className="flex gap-1"><input type="hidden" name="code" value={x.certificate_code} /><input type="hidden" name="back" value={back} /><input name="reason" required minLength={3} placeholder="Revoke reason" aria-label="Revoke reason" className={`${field} max-w-36`} /><button className={btnGhost}>Revoke</button></form></div>}</Td></tr>))}
        {!certs.length && <tr><Td className="py-6 text-center text-charcoal/60">None issued yet.</Td></tr>}</tbody></table></div></Card>
    </>
  );
}
