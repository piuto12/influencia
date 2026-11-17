import { requirePageAccess } from "@/lib/auth";
import { adminTestimonials } from "@/modules/content/admin-queries";
import { adminEditions } from "@/modules/content/admin-queries";
import { deleteTestimonial, saveTestimonial } from "@/modules/content/actions";
import { UploadField } from "@/components/admin/UploadField";
import { btn, btnGhost, Card, field, Flash, PageTitle, type SP } from "@/components/admin/ui";

type T = { id: string; name: string; designation: string | null; organization: string | null; photo_path: string | null; feedback: string | null; video_url: string | null; rating: number | null; featured: boolean; status: string; event_editions: { code: string } | null };

function TForm({ t, editions }: { t?: T; editions: { code: string; title: string }[] }) {
  return (
    <form action={saveTestimonial} className="grid gap-3 sm:grid-cols-2">
      {t && <input type="hidden" name="id" value={t.id} />}
      <label className="text-sm">Participant name<input name="name" required defaultValue={t?.name} className={`${field} mt-1`} /></label>
      <label className="text-sm">Designation<input name="designation" defaultValue={t?.designation ?? ""} className={`${field} mt-1`} /></label>
      <label className="text-sm">Organization<input name="organization" defaultValue={t?.organization ?? ""} className={`${field} mt-1`} /></label>
      <label className="text-sm">Edition<select name="edition_code" defaultValue={t?.event_editions?.code ?? ""} className={`${field} mt-1`}><option value="">—</option>{editions.map((e) => <option key={e.code} value={e.code}>{e.title}</option>)}</select></label>
      <label className="text-sm sm:col-span-2">Written feedback (the participant&apos;s own words, with their permission)<textarea name="feedback" rows={4} defaultValue={t?.feedback ?? ""} className={`${field} mt-1`} /></label>
      <label className="text-sm">Video link (optional)<input name="video_url" defaultValue={t?.video_url ?? ""} className={`${field} mt-1`} /></label>
      <label className="text-sm">Rating (optional)<select name="rating" defaultValue={t?.rating ?? ""} className={`${field} mt-1`}><option value="">—</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      <UploadField name="photo_path" folder="testimonials" label="Photograph (optional)" initial={t?.photo_path} />
      <div className="space-y-2"><label className="text-sm">Status<select name="status" defaultValue={t?.status ?? "draft"} className={`${field} mt-1`}><option value="draft">Draft (not public)</option><option value="published">Approved &amp; published</option></select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={t?.featured} /> Featured</label></div>
      <div className="sm:col-span-2"><button className={btn}>{t ? "Save testimonial" : "Add testimonial"}</button></div>
    </form>
  );
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("media.manage");
  const sp = await searchParams; const [list, eds] = await Promise.all([adminTestimonials() as Promise<T[]>, adminEditions()]);
  return (
    <>
      <PageTitle>Testimonials</PageTitle><Flash ok={sp.ok} err={sp.err} />
      <p className="mb-4 text-sm text-charcoal/70">Only real feedback from real participants, entered by an administrator. Nothing is shown publicly until its status is <em>Approved &amp; published</em>.</p>
      <Card title="Add testimonial"><TForm editions={eds} /></Card>
      <div className="mt-6 space-y-3">{list.map((t) => (
        <Card key={t.id}><details><summary className="flex cursor-pointer flex-wrap items-center gap-3"><strong>{t.name}</strong><span className="text-sm text-charcoal/60">{t.organization}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${t.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-charcoal/10"}`}>{t.status === "published" ? "approved" : "draft"}</span></summary>
          <div className="mt-4"><TForm t={t} editions={eds} /><form action={deleteTestimonial} className="mt-3"><input type="hidden" name="id" value={t.id} /><button className={btnGhost}>Delete</button></form></div></details></Card>))}
        {!list.length && <p className="text-sm text-charcoal/60">No testimonials yet.</p>}</div>
    </>
  );
}
