import { requirePageAccess } from "@/lib/auth";
import { adminPages } from "@/modules/content/admin-queries";
import { deletePage, savePage } from "@/modules/content/actions";
import { btn, btnGhost, Card, field, Flash, PageTitle, type SP } from "@/components/admin/ui";

type P = { slug: string; title: string; body: string; seo: { title?: string; description?: string }; status: string };
const BUILT_IN = [["about", "About Influencia"], ["rashid-gazzali", "About Dr. Rashid Gazzali"], ["prp-framework", "PRP Framework"], ["programme", "Programme"], ["contact", "Contact"], ["privacy", "Privacy Policy"], ["terms", "Terms and Conditions"]];

function PForm({ p, slug, title }: { p?: P; slug?: string; title?: string }) {
  return (
    <form action={savePage} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Slug<input name="slug" required defaultValue={p?.slug ?? slug} readOnly={!!(p || slug)} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={`${field} mt-1`} /></label>
      <label className="text-sm">Page title<input name="title" required defaultValue={p?.title ?? title} className={`${field} mt-1`} /></label>
      <label className="text-sm sm:col-span-2">Content (Markdown; raw HTML is not rendered)<textarea name="body" rows={12} defaultValue={p?.body} className={`${field} mt-1 font-mono`} /></label>
      <label className="text-sm">SEO title<input name="seo_title" defaultValue={p?.seo?.title ?? ""} maxLength={70} className={`${field} mt-1`} /></label>
      <label className="text-sm">SEO description<input name="seo_description" defaultValue={p?.seo?.description ?? ""} maxLength={180} className={`${field} mt-1`} /></label>
      <label className="text-sm">Status<select name="status" defaultValue={p?.status ?? "draft"} className={`${field} mt-1`}><option value="draft">Draft (built-in page shows)</option><option value="published">Published (replaces built-in page)</option></select></label>
      <div className="sm:col-span-2 flex gap-2"><button className={btn}>Save page</button></div>
    </form>
  );
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("content.manage");
  const sp = await searchParams; const rows = (await adminPages()) as P[]; const have = new Set(rows.map((r) => r.slug));
  return (
    <>
      <PageTitle>Pages</PageTitle><Flash ok={sp.ok} err={sp.err} />
      <p className="mb-4 text-sm text-charcoal/70">A published page with a built-in slug replaces that page&apos;s built-in content. Privacy Policy and Terms must be written and published here before registration opens.</p>
      <div className="space-y-3">
        {rows.map((p) => <Card key={p.slug}><details><summary className="flex cursor-pointer gap-3"><strong>{p.title}</strong><span className="text-sm text-charcoal/60">/{p.slug} · {p.status}</span></summary>
          <div className="mt-4"><PForm p={p} /><form action={deletePage} className="mt-3"><input type="hidden" name="slug" value={p.slug} /><button className={btnGhost}>Delete (built-in content returns)</button></form></div></details></Card>)}
        {BUILT_IN.filter(([s]) => !have.has(s)).map(([s, t]) => <Card key={s}><details><summary className="flex cursor-pointer gap-3"><strong>{t}</strong><span className="text-sm text-charcoal/60">/{s} · built-in — click to override</span></summary><div className="mt-4"><PForm slug={s} title={t} /></div></details></Card>)}
      </div>
      <Card title="Add a new page" className="mt-8"><PForm /></Card>
    </>
  );
}
