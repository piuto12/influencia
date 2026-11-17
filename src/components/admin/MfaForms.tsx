"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmEnrollment, disableMfa, startEnrollment, verifyLoginCode, type MfaResult } from "@/modules/admin/mfa-actions";
import { btn, btnGhost, field } from "./ui";

const ERR: Record<string, string> = { invalid_code: "That code isn’t right. Check your authenticator app and try again.", rate_limited: "Too many attempts. Wait a few minutes.", unavailable: "Something went wrong. Please try again." };

function CodeInput({ onSubmit, label, pending }: { onSubmit: (code: string) => void; label: string; pending: boolean }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\s/g, ""); onSubmit(v); }} className="flex gap-2">
      <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required aria-label="6-digit code" placeholder="123456" className={field} autoFocus />
      <button className={btn} disabled={pending}>{label}</button>
    </form>
  );
}

export function LoginMfaForm() {
  const router = useRouter(); const [pending, start] = useTransition(); const [err, setErr] = useState<string | null>(null);
  return (<div className="space-y-3">
    <CodeInput label="Verify" pending={pending} onSubmit={(code) => start(async () => { const r: MfaResult = await verifyLoginCode(code); if (r.ok) { router.replace("/admin"); router.refresh(); } else setErr(ERR[r.error ?? "unavailable"]); })} />
    {err && <p role="alert" className="text-sm text-red-700">{err}</p>}</div>);
}

export function EnrollMfa() {
  const router = useRouter(); const [pending, start] = useTransition();
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null); const [err, setErr] = useState<string | null>(null);
  if (!setup) return (<div><button className={btn} disabled={pending} onClick={() => start(async () => { const r = await startEnrollment(); if (r.ok) setSetup(r); else setErr(ERR.unavailable); })}>Set up authenticator app</button>{err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}</div>);
  return (<div className="space-y-4 text-sm">
    <p>1. Scan this QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).</p>
    <Image unoptimized src={setup.qr} alt="Authenticator setup QR code" width={180} height={180} className="rounded-lg bg-white p-2" />
    <p>Can’t scan? Enter this key manually: <code className="select-all break-all">{setup.secret}</code></p>
    <p>2. Enter the 6-digit code the app shows to finish.</p>
    <CodeInput label="Turn on" pending={pending} onSubmit={(code) => start(async () => { const r = await confirmEnrollment(setup.factorId, code); if (r.ok) { router.replace("/admin"); router.refresh(); } else setErr(ERR[r.error ?? "unavailable"]); })} />
    {err && <p role="alert" className="text-red-700">{err}</p>}</div>);
}

export function DisableMfa() {
  const router = useRouter(); const [pending, start] = useTransition(); const [err, setErr] = useState<string | null>(null);
  return (<div><button className={btnGhost} disabled={pending} onClick={() => start(async () => { const r = await disableMfa(); if (r.ok) router.refresh(); else setErr("Could not turn off two-step verification (it may be required for your role)."); })}>Turn off two-step verification</button>{err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}</div>);
}
