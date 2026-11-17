import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MFA_PRIVILEGED, parseMfaMode } from "@/lib/mfa";
import { DisableMfa, EnrollMfa } from "@/components/admin/MfaForms";
import type { SP } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Admin security", robots: { index: false, follow: false } };

async function Body({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const a = await getAdmin();
  if (!a) redirect("/admin/login");
  if (a.mfa === "challenge") redirect("/admin/login/mfa");
  const { data } = await (await createClient()).auth.mfa.listFactors();
  const enrolled = (data?.totp?.length ?? 0) > 0; const mode = parseMfaMode(process.env.ADMIN_MFA);
  const mandatory = mode === "required" && MFA_PRIVILEGED.includes(a.role);
  return (
    <div className="w-full max-w-lg space-y-5 rounded-2xl bg-white p-8 shadow-xl">
      <h1 className="font-serif text-3xl text-charcoal">Account security</h1>
      {sp.required && <p role="alert" className="rounded-lg bg-amber-100 px-4 py-3 text-sm text-amber-900">Two-step verification is required for your role. Set it up to continue.</p>}
      <p className="text-sm text-charcoal/75">Signed in as <strong>{a.name}</strong> ({a.role.replace(/_/g, " ")}). Two-step verification: <strong>{enrolled ? "on" : "off"}</strong>{mandatory ? " (required for your role)" : mode === "off" ? " (disabled on this server)" : ""}.</p>
      {mode !== "off" && (!enrolled ? <EnrollMfa /> : !mandatory && <DisableMfa />)}
      {a.mfa === "ok" && <p className="text-sm"><Link href="/admin" className="text-crimson underline">Back to dashboard</Link></p>}
    </div>
  );
}
export default function Page(props: { searchParams: SP }) { return <main className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-hero)] p-5"><Suspense><Body {...props} /></Suspense></main>; }
