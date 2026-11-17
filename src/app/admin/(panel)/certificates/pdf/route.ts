import { NextResponse } from "next/server";
import { ForbiddenError, requirePermission } from "@/lib/auth";
import { listCertificates, renderCertificates } from "@/modules/certificates/service";
import { resolveEdition } from "@/modules/admin/queries";
import { audit } from "@/modules/admin/helpers";

// Bulk PDF / export work can exceed the platform default timeout.
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    const a = await requirePermission("certificates.manage");
    let codes = url.searchParams.getAll("code").filter((c) => /^CERT(-[A-Z2-9]{4}){4}$/.test(c)).slice(0, 5);
    if (url.searchParams.get("all") === "1") {
      const { edition } = await resolveEdition(url.searchParams.get("edition") ?? undefined);
      if (!edition) return NextResponse.json({ error: "no_edition" }, { status: 404 });
      codes = (await listCertificates(edition.id)).filter((c) => !c.revoked_at).map((c) => c.certificate_code);
    }
    if (!codes.length) return NextResponse.json({ error: "no_certificates" }, { status: 404 });
    const out = await renderCertificates(codes);
    if (!out) return NextResponse.json({ error: "no_certificates" }, { status: 404 });
    await audit(a.adminId, "certificate.downloaded", "certificate", codes.length === 1 ? codes[0] : `bulk:${codes.length}`);
    return new NextResponse(Buffer.from(out.pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${codes.length === 1 ? codes[0] : "certificates"}.pdf"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof ForbiddenError ? "forbidden" : "unavailable" }, { status: e instanceof ForbiddenError ? 403 : 500 });
  }
}
