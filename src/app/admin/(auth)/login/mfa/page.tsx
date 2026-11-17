import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdmin } from "@/lib/auth";
import { LoginMfaForm } from "@/components/admin/MfaForms";

export const metadata: Metadata = { title: "Verify sign-in", robots: { index: false, follow: false } };

async function Body() {
  const a = await getAdmin();
  if (!a) redirect("/admin/login");
  if (a.mfa === "ok") redirect("/admin");
  if (a.mfa === "enroll") redirect("/admin/security?required=1");
  return (
    <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-xl">
      <h1 className="font-serif text-3xl text-charcoal">Two-step verification</h1>
      <p className="text-sm text-charcoal/75">Enter the 6-digit code from your authenticator app.</p>
      <LoginMfaForm />
    </div>
  );
}
export default function Page() { return <main className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-hero)] p-5"><Suspense><Body /></Suspense></main>; }
