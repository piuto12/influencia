import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { PageShell } from "@/components/public/PageShell";
import { rateLimitShared } from "@/lib/rate-limit";
import { verifyCertificate } from "@/modules/certificates/service";

export const metadata: Metadata = { title: "Certificate verification · Influencia", robots: { index: false, follow: false } };

async function Result({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const h = await headers(); const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await rateLimitShared(`certverify:${ip}`, 30, 10 * 60_000))) return <p role="alert" className="rounded-xl bg-amber-100 p-5 text-amber-900">Too many checks from your network. Please wait a few minutes and try again.</p>;
  let r = null;
  try { r = await verifyCertificate(decodeURIComponent(code)); } catch { return <p role="alert" className="rounded-xl bg-red-100 p-5 text-red-800">Verification is temporarily unavailable. Please try again shortly.</p>; }
  if (!r) return <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-6"><p className="font-serif text-2xl text-red-800">Certificate not found</p><p className="mt-2 text-charcoal/75">We could not find a certificate with that ID. Check the ID and try again, or contact the Influencia team.</p></div>;
  if (r.revoked) return <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6"><p className="font-serif text-2xl text-amber-900">This certificate has been revoked</p><p className="mt-2 text-charcoal/75">It is no longer valid. Contact the Influencia team for details.</p></div>;
  return (
    <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6">
      <p className="font-serif text-2xl text-emerald-900">✓ Valid certificate</p>
      <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-2 text-charcoal"><dt className="text-charcoal/70">Awarded to</dt><dd className="font-semibold">{r.name}</dd><dt className="text-charcoal/70">Programme</dt><dd>{r.eventTitle}</dd>{r.eventDate && <><dt className="text-charcoal/70">Date</dt><dd>{r.eventDate}</dd></>}<dt className="text-charcoal/70">Certificate ID</dt><dd><code>{decodeURIComponent(code).toUpperCase()}</code></dd></dl>
    </div>
  );
}
export default function Page(props: { params: Promise<{ code: string }> }) {
  return <PageShell title="Certificate verification" eyebrow="Certificates"><Suspense fallback={<p>Checking…</p>}><Result {...props} /></Suspense><p className="mt-8 text-sm"><Link href="/certificates/verify" className="text-crimson underline">Verify another certificate</Link></p></PageShell>;
}
