import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/public/PageShell";
import { field, btn } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Verify a Certificate · Influencia", description: "Check that an Influencia certificate is genuine." };

async function go(fd: FormData) {
  "use server";
  const code = String(fd.get("code") ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  redirect(`/certificates/verify/${encodeURIComponent(code || "invalid")}`);
}
export default function Page() {
  return (
    <PageShell title="Verify a Certificate" eyebrow="Certificates">
      <p className="mb-6 text-charcoal/80">Enter the certificate ID printed on the certificate (it looks like <code>CERT-XXXX-XXXX-XXXX-XXXX</code>), or scan its QR code.</p>
      <form action={go} className="flex max-w-xl gap-3"><input name="code" required placeholder="CERT-XXXX-XXXX-XXXX-XXXX" autoComplete="off" aria-label="Certificate ID" className={field} /><button className={btn}>Verify</button></form>
    </PageShell>
  );
}
