import { requirePageAccess } from "@/lib/auth";
import { adminVideos } from "@/modules/content/admin-queries";
import { deleteVideo, saveVideo } from "@/modules/content/actions";
import { UploadField } from "@/components/admin/UploadField";
import { btn, btnGhost, Card, field, Flash, PageTitle, type SP } from "@/components/admin/ui";

type V = { id: string; title: string; description: string | null; source: string; url: string | null; storage_path: string | null; thumbnail_path: string | null; featured: boolean; sort_order: number; status: string; media_categories: { name: string } | null };

function VideoForm({ v }: { v?: V }) {
  return (
    <form action={saveVideo} className="grid gap-3 sm:grid-cols-2">
      {v && <input type="hidden" name="id" value={v.id} />}
      <label className="text-sm">Title<input name="title" required defaultValue={v?.title} className={`${field} mt-1`} /></label>
      <label className="text-sm">Category<input name="category" defaultValue={v?.media_categories?.name ?? ""} className={`${field} mt-1`} /></label>
      <label className="text-sm sm:col-span-2">Description<textarea name="description" rows={2} defaultValue={v?.description ?? ""} className={`${field} mt-1`} /></label>
      <label className="text-sm">Source<select name="source" defaultValue={v?.source === "upload" ? "upload" : "link"} className={`${field} mt-1`}><option value="link">YouTube / Vimeo link</option><option value="upload">Uploaded video file</option></select></label>
      <label className="text-sm">Video link<input name="url" defaultValue={v?.url ?? ""} placeholder="https://www.youtube.com/watch?v=…" className={`${field} mt-1`} /></label>
      <UploadField name="storage_path" kind="video" folder="videos" label="Video file (MP4/WebM, up to 50 MB) — only if source is upload" initial={v?.storage_path} />
      <UploadField name="thumbnail_path" folder="thumbnails" label="Custom thumbnail (optional)" initial={v?.thumbnail_path} />
      <label className="text-sm">Display order<input name="sort_order" type="number" defaultValue={v?.sort_order ?? 0} className={`${field} mt-1`} /></label>
      <label className="text-sm">Status<select name="status" defaultValue={v?.status ?? "draft"} className={`${field} mt-1`}><option value="draft">Draft</option><option value="published">Published</option></select></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={v?.featured} /> Featured on homepage</label>
      <div className="sm:col-span-2 flex gap-2"><button className={btn}>{v ? "Save video" : "Add video"}</button></div>
    </form>
  );
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("media.manage");
  const sp = await searchParams; const vids = (await adminVideos()) as V[];
  return (
    <>
      <PageTitle>Videos</PageTitle><Flash ok={sp.ok} err={sp.err} />
      <Card title="Add video"><VideoForm /></Card>
      <div className="mt-6 space-y-3">{vids.map((v) => (
        <Card key={v.id}><details><summary className="flex cursor-pointer flex-wrap items-center gap-3"><strong>{v.title}</strong><span className="text-sm text-charcoal/60">{v.source}{v.featured ? " · featured" : ""}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${v.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-charcoal/10"}`}>{v.status}</span></summary>
          <div className="mt-4"><VideoForm v={v} /><form action={deleteVideo} className="mt-3"><input type="hidden" name="id" value={v.id} /><button className={btnGhost}>Delete video</button></form></div></details></Card>))}
        {!vids.length && <p className="text-sm text-charcoal/60">No videos yet.</p>}</div>
    </>
  );
}
