import Image from "next/image";
import { requirePageAccess } from "@/lib/auth";
import { adminGallery } from "@/modules/content/admin-queries";
import { deleteGalleryItem, saveGalleryItem } from "@/modules/content/actions";
import { resolveEdition } from "@/modules/admin/queries";
import { mediaUrl } from "@/modules/content/media";
import { GalleryUploader } from "@/components/admin/GalleryUploader";
import { btn, btnGhost, Card, EditionSwitcher, field, Flash, PageTitle, type SP } from "@/components/admin/ui";

type G = { id: string; storage_path: string; caption: string | null; sort_order: number; featured: boolean; status: string };

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("media.manage");
  const sp = await searchParams; const { edition, all } = await resolveEdition(sp.edition);
  if (!edition) return <p>No edition.</p>;
  const items = (await adminGallery(edition.id)) as G[];
  return (
    <>
      <PageTitle>Photo gallery</PageTitle><Flash ok={sp.ok} err={sp.err} />
      <EditionSwitcher all={all} current={edition} base="/admin/media/gallery" />
      <Card title={`Upload photos to ${edition.title}`}><GalleryUploader editionCode={edition.code} /></Card>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((g) => { const src = mediaUrl(g.storage_path); return (
        <Card key={g.id}>{src && <Image src={src} alt={g.caption ?? ""} width={400} height={300} className="mb-3 aspect-[4/3] w-full rounded-lg object-cover" />}
          <form action={saveGalleryItem} className="space-y-2 text-sm"><input type="hidden" name="id" value={g.id} /><input type="hidden" name="code" value={edition.code} />
            <input name="caption" defaultValue={g.caption ?? ""} placeholder="Caption" aria-label="Caption" className={field} />
            <div className="flex gap-2"><input name="sort_order" type="number" defaultValue={g.sort_order} aria-label="Order" className={`${field} max-w-24`} />
              <select name="status" defaultValue={g.status} aria-label="Status" className={field}><option value="draft">Draft</option><option value="published">Published</option></select></div>
            <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={g.featured} /> Featured</label>
            <button className={btn}>Save</button></form>
          <form action={deleteGalleryItem} className="mt-2"><input type="hidden" name="id" value={g.id} /><input type="hidden" name="code" value={edition.code} /><button className={btnGhost}>Delete</button></form></Card>); })}
        {!items.length && <p className="text-sm text-charcoal/60">No photos for this edition yet.</p>}</div>
    </>
  );
}
