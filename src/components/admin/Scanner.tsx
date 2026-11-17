"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { scanCheckIn } from "@/modules/ops/actions";
import { btn, btnGhost, field } from "./ui";

type Result = { tone: "ok" | "warn" | "err"; text: string };
const MSG: Record<string, string> = { invalid_code: "Not a valid Influencia ticket.", wrong_edition: "This ticket is for a different edition.", not_confirmed: "This registration is not confirmed.", not_found: "Registration not found.", unavailable: "Check-in unavailable. Try again." };
interface Detector { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> }
type DetectorCtor = new (o: { formats: string[] }) => Detector;

/** Camera scanning uses the browser's built-in BarcodeDetector where available; USB/Bluetooth scanners work by typing into the field. */
export function Scanner({ editionCode }: { editionCode: string }) {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [camera, setCamera] = useState(false);
  const [supported] = useState(() => typeof window !== "undefined" && "BarcodeDetector" in window);
  const video = useRef<HTMLVideoElement>(null);
  const last = useRef({ v: "", t: 0 });
  const input = useRef<HTMLInputElement>(null);

  const submit = useCallback(async (raw: string) => {
    const v = raw.trim(); if (!v) return;
    const now = Date.now(); if (last.current.v === v && now - last.current.t < 4000) return; // ignore the same code re-read by the camera
    last.current = { v, t: now };
    const r = await scanCheckIn(editionCode, v);
    if (!r.ok) setResult({ tone: "err", text: MSG[r.error] ?? MSG.unavailable });
    else if (r.result === "already_checked_in") setResult({ tone: "warn", text: `${r.name} (${r.reference}) was already checked in at ${new Date(r.at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}.` });
    else setResult({ tone: "ok", text: `Checked in: ${r.name} (${r.reference})` });
    router.refresh();
  }, [editionCode, router]);

  useEffect(() => {
    if (!camera) return;
    let stop = false; let stream: MediaStream | null = null; let timer: ReturnType<typeof setTimeout>;
    (async () => {
      try {
        const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
        const det = new Ctor({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
        const tick = async () => {
          if (stop || !video.current) return;
          try { const codes = await det.detect(video.current); if (codes[0]) await submit(codes[0].rawValue); } catch { /* frame not ready */ }
          timer = setTimeout(tick, 350);
        };
        tick();
      } catch { setResult({ tone: "err", text: "Camera unavailable. Allow camera access, or type the code instead." }); setCamera(false); }
    })();
    return () => { stop = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [camera, submit]);

  const tone = { ok: "bg-emerald-100 text-emerald-900", warn: "bg-amber-100 text-amber-900", err: "bg-red-100 text-red-800" };
  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); const v = input.current?.value ?? ""; if (input.current) input.current.value = ""; void submit(v); }} className="flex gap-2">
        <input ref={input} autoFocus autoComplete="off" spellCheck={false} aria-label="Scan or paste ticket code" placeholder="Scan with a USB scanner, or paste the ticket code" className={field} />
        <button className={btn}>Check in</button>
      </form>
      {supported && <button type="button" className={btnGhost} onClick={() => setCamera((c) => !c)}>{camera ? "Stop camera" : "Scan with camera"}</button>}
      {camera && <video ref={video} playsInline muted className="aspect-video w-full max-w-md rounded-xl bg-black" />}
      {result && <p role="status" aria-live="assertive" className={`rounded-xl px-4 py-3 text-sm font-medium ${tone[result.tone]}`}>{result.text}</p>}
    </div>
  );
}
