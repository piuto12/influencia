import { requirePageAccess } from "@/lib/auth";
import { adminArticles } from "@/modules/content/admin-queries";
import { deleteArticle, saveArticle } from "@/modules/content/actions";
import { UploadField } from "@/components/admin/UploadField";
import { btn, btnGhost, Card, field, Flash, PageTitle, when, type SP } from "@/components/admin/ui";

type A = { id: string; slug: string; title: string; excerpt: string | null; body: string; author: string | null; featured_image_path: string | null; seo: { title?: string; description?: string }; status: string; updated_at: string; media_categories: { name: string } | null };

function AForm({ a }: { a?: A }) {
  return (
    <form action={saveArticle} className="grid gap-3 sm:grid-cols-2">
      {a && <input type="hidden" name="id" value={a.id} />}
      <label className="text-sm">Title<input name="title" required defaultValue={a?.title} className={`${field} mt-1`} /></label>
      <label className="text-sm">URL slug (/blog/…)<input name="slug" required defaultValue={a?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="my-first-article" className={`${field} mt-1`} /></label>
      <label className="text-sm">Author<input name="author" defaultValue={a?.author ?? ""} className={`${field} mt-1`} /></label>
      <label className="text-sm">Category<input name="category" defaultValue={a?.media_categories?.name ?? ""} className={`${field} mt-1`} /></label>
      <label className="text-sm sm:col-span-2">Excerpt<textarea name="excerpt" rows={2} defaultValue={a?.excerpt ?? ""} className={`${field} mt-1`} /></label>
      <label className="text-sm sm:col-span-2">Article body (Markdown; raw HTML is not rendered)<textarea name="body" rows={14} defaultValue={a?.body} className={`${field} mt-1 font-mono`} /></label>
      <UploadField name="featured_image_path" folder="blog" label="Featured image" initial={a?.featured_image_path} />
      <label className="text-sm">Status<select name="status" defaultValue={a?.status ?? "draft"} className={`${field} mt-1`}><option value="draft">Draft</option><option value="published">Published</option></select></label>
      <label className="text-sm">SEO title<input name="seo_title" defaultValue={a?.seo?.title ?? ""} maxLength={70} className={`${field} mt-1`} /></label>
      <label className="text-sm">SEO description<input name="seo_description" defaultValue={a?.seo?.description ?? ""} maxLength={180} className={`${field} mt-1`} /></label>
      <div className="sm:col-span-2"><button className={btn}>{a ? "Save article" : "Create article"}</button></div>
    </form>
  );
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("content.manage");
  const sp = await searchParams; const list = (await adminArticles()) as A[];
  return (
    <>
      <PageTitle>Blog &amp; articles</PageTitle><Flash ok={sp.ok} err={sp.err} />
      <Card title="New article"><AForm /></Card>
      <div className="mt-6 space-y-3">{list.map((a) => (
        <Card key={a.id}><details><summary className="flex cursor-pointer flex-wrap items-center gap-3"><strong>{a.title}</strong><span className="text-sm text-charcoal/60">/blog/{a.slug} · {when(a.updated_at)}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${a.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-charcoal/10"}`}>{a.status}</span></summary>
          <div className="mt-4"><AForm a={a} /><form action={deleteArticle} className="mt-3"><input type="hidden" name="id" value={a.id} /><button className={btnGhost}>Delete article</button></form></div></details></Card>))}
        {!list.length && <p className="text-sm text-charcoal/60">No articles yet.</p>}</div>
    </>
  );
}
