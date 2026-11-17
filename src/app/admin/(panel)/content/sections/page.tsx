import { requirePageAccess } from "@/lib/auth";
import { adminSections } from "@/modules/content/admin-queries";
import { deleteSection, moveSection, saveSection } from "@/modules/content/actions";
import { SECTION_TYPES, type SectionContent } from "@/modules/content/sections";
import { btn, btnGhost, Card, field, Flash, PageTitle, type SP } from "@/components/admin/ui";

type S = { id: string; type: keyof typeof SECTION_TYPES; sort_order: number; status: string; content: SectionContent };

function Fields({ c, type }: { c: SectionContent; type: string }) {
  const rich = type === "text" || type === "cta" || type === "about" || type === "speaker";
  return (<>
    <label className="text-sm">Small heading (eyebrow)<input name="eyebrow" defaultValue={c.eyebrow ?? ""} className={`${field} mt-1`} /></label>
    <label className="text-sm">Heading<input name="title" defaultValue={c.title ?? ""} className={`${field} mt-1`} /></label>
    {rich && <label className="text-sm sm:col-span-2">Text (Markdown){type === "about" || type === "speaker" ? " — leave empty for the default text" : ""}<textarea name="body" rows={5} defaultValue={c.body ?? ""} className={`${field} mt-1 font-mono`} /></label>}
    {(type === "text" || type === "cta") && <><label className="text-sm">Button label<input name="cta_label" defaultValue={c.cta_label ?? ""} className={`${field} mt-1`} /></label>
      <label className="text-sm">Button link<input name="cta_href" defaultValue={c.cta_href ?? ""} placeholder="/register or https://…" className={`${field} mt-1`} /></label></>}
  </>);
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("content.manage");
  const sp = await searchParams; const rows = (await adminSections()) as S[];
  return (
    <>
      <PageTitle>Homepage sections</PageTitle><Flash ok={sp.ok} err={sp.err} />
      <p className="mb-4 text-sm text-charcoal/70">The hero is fixed. Reorder, hide, retitle or add sections below; changes go live within a minute of saving.</p>
      <div className="space-y-3">{rows.map((s, i) => (
        <Card key={s.id}><details>
          <summary className="flex cursor-pointer flex-wrap items-center gap-3"><strong>{SECTION_TYPES[s.type]?.label ?? s.type}</strong><span className="text-sm text-charcoal/60">{s.content.title}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${s.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-charcoal/10"}`}>{s.status}</span></summary>
          <div className="mt-4 flex gap-2">
            <form action={moveSection}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="dir" value="up" /><button className={btnGhost} disabled={i === 0} aria-label="Move up">↑ Up</button></form>
            <form action={moveSection}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="dir" value="down" /><button className={btnGhost} disabled={i === rows.length - 1} aria-label="Move down">↓ Down</button></form>
            {SECTION_TYPES[s.type]?.custom && <form action={deleteSection}><input type="hidden" name="id" value={s.id} /><button className={btnGhost}>Delete</button></form>}
          </div>
          <form action={saveSection} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="id" value={s.id} /><input type="hidden" name="type" value={s.type} />
            <Fields c={s.content} type={s.type} />
            <label className="text-sm">Visibility<select name="status" defaultValue={s.status} className={`${field} mt-1`}><option value="published">Published</option><option value="draft">Hidden (draft)</option></select></label>
            <div className="sm:col-span-2"><button className={btn}>Save section</button></div></form>
        </details></Card>))}</div>
      <Card title="Add a section" className="mt-8"><form action={saveSection} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Type<select name="type" className={`${field} mt-1`}>{Object.entries(SECTION_TYPES).filter(([, v]) => v.custom).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        <label className="text-sm">Visibility<select name="status" defaultValue="draft" className={`${field} mt-1`}><option value="draft">Draft</option><option value="published">Published</option></select></label>
        <Fields c={{}} type="text" /><div className="sm:col-span-2"><button className={btn}>Add section</button></div></form></Card>
    </>
  );
}
