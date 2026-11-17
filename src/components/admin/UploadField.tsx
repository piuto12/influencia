"use client";
import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { requestUpload } from "@/modules/content/actions";
import { MEDIA_BUCKET, mediaUrl, type UploadKind } from "@/modules/content/media";

const ERR: Record<string, string> = { type: "That file type isn’t allowed.", size: "That file is too large.", empty: "The file is empty.", forbidden: "Not allowed.", unavailable: "Upload failed. Try again." };
const ACCEPT: Record<UploadKind, string> = { image: "image/jpeg,image/png,image/webp,image/avif", video: "video/mp4,video/webm" };

/** Uploads straight from the browser to Storage using a one-time signed URL issued after a permission check. */
export function UploadField({ name, kind = "image", folder, label, initial }: { name: string; kind?: UploadKind; folder: string; label: string; initial?: string | null }) {
  const [path, setPath] = useState(initial ?? "");
  const [state, setState] = useState<"idle" | "busy" | string>("idle");
  const url = mediaUrl(path);
  return (
    <div className="text-sm">
      <span className="mb-1 block">{label}</span>
      <input type="hidden" name={name} value={path} />
      {url && (kind === "image" ? <Image src={url} alt="" width={96} height={96} className="mb-2 h-24 w-24 rounded-lg object-cover" /> : <p className="mb-2 text-charcoal/70">Uploaded: {path}</p>)}
      <input type="file" accept={ACCEPT[kind]} disabled={state === "busy"} className="block w-full text-sm" onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        setState("busy");
        const t = await requestUpload(kind, folder, f.type, f.size);
        if (!t.ok) { setState(ERR[t.error] ?? ERR.unavailable); return; }
        const { error } = await createClient().storage.from(MEDIA_BUCKET).uploadToSignedUrl(t.path, t.token, f, { contentType: f.type });
        if (error) { setState(ERR.unavailable); return; }
        setPath(t.path); setState("idle");
      }} />
      {state === "busy" && <p className="mt-1 text-charcoal/60" role="status">Uploading…</p>}
      {state !== "idle" && state !== "busy" && <p className="mt-1 text-red-700" role="alert">{state}</p>}
      {path && <button type="button" className="mt-1 text-xs underline" onClick={() => setPath("")}>Remove</button>}
    </div>
  );
}
