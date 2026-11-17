"use client";
import { useState } from "react";
import { openProof } from "@/modules/admin/actions";

export function ProofButton({ id, label }: { id: string; label: string }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(false);
  return (
    <>
      <button type="button" disabled={busy} className="text-sm text-crimson underline" onClick={async () => {
        setBusy(true); setErr(false);
        try { const u = await openProof(id); if (u) window.open(u, "_blank", "noopener,noreferrer"); else setErr(true); } catch { setErr(true); }
        setBusy(false);
      }}>{busy ? "Opening…" : label}</button>
      {err && <span role="alert" className="ml-2 text-xs text-red-700">Unavailable</span>}
    </>
  );
}
