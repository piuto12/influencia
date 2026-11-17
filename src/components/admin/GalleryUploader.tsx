"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { addGalleryItems, requestUpload } from "@/modules/content/actions";
import { MEDIA_BUCKET } from "@/modules/content/media";
import { btn } from "./ui";

/** Bulk photo upload: files go straight to Storage one by one, then are registered in a single call. */
export function GalleryUploader({ editionCode }: { editionCode: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [publish, setPublish] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3 text-sm">
      <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 100))} />
      <label className="flex items-center gap-2"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> Publish immediately (otherwise saved as drafts)</label>
      <button type="button" className={btn} disabled={busy || !files.length} onClick={async () => {
        setBusy(true); setMsg(null);
        const ok: string[] = []; let failed = 0;
        const supabase = createClient();
        for (const f of files) {
          const t = await requestUpload("image", "gallery", f.type, f.size);
          if (!t.ok) { failed++; continue; }
          const { error } = await supabase.storage.from(MEDIA_BUCKET).uploadToSignedUrl(t.path, t.token, f, { contentType: f.type });
          if (error) failed++; else ok.push(t.path);
        }
        const r = ok.length ? await addGalleryItems(editionCode, ok, publish) : { ok: false, added: 0 };
        setMsg(`${r.added} photo(s) added${failed ? `, ${failed} failed` : ""}.`); setBusy(false); setFiles([]);
        router.refresh();
      }}>{busy ? "Uploading…" : `Upload ${files.length || ""} photo${files.length === 1 ? "" : "s"}`}</button>
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}
