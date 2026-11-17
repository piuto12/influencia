import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError, requirePermission } from "@/lib/auth";
import { latestPayment, listRegistrations, resolveEdition } from "@/modules/admin/queries";
import { toCsv } from "@/modules/admin/csv";
import { attendanceReport, attendedOf } from "@/modules/attendance/service";
import { listCertificates } from "@/modules/certificates/service";

// Bulk PDF / export work can exceed the platform default timeout.
export const maxDuration = 60;

export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const url = new URL(req.url);
  try {
    const a = await requirePermission(kind === "payments" ? "reports.finance" : kind === "attendance" ? "attendance.manage" : kind === "certificates" ? "certificates.manage" : "participants.read");
    const { edition } = await resolveEdition(url.searchParams.get("edition") ?? undefined);
    if (!edition) return NextResponse.json({ error: "no_edition" }, { status: 404 });
    let csv: string;
    if (kind === "registrations") {
      const { rows } = await listRegistrations(edition.id, { q: url.searchParams.get("q") ?? undefined, status: url.searchParams.get("status") ?? undefined, category: url.searchParams.get("category") ?? undefined }, false);
      csv = toCsv(["Reference", "Name", "Email", "Mobile", "Organization", "City", "Category", "Registration status", "Payment status", "Registered at"],
        rows.map((r) => [r.reference, r.participants.full_name, r.participants.email, r.participants.mobile, r.participants.organization, r.participants.city, r.category, r.status, latestPayment(r)?.status ?? "", r.created_at]));
    } else if (kind === "payments") {
      const { data, error } = await createAdminClient().from("payments").select("status,method_code,amount,currency,transaction_ref,verified_at,created_at,registrations!inner(reference,edition_id,participants(full_name)),refunds(amount)").eq("registrations.edition_id", edition.id).limit(10000);
      if (error) throw error;
      csv = toCsv(["Reference", "Name", "Method", "Status", "Amount", "Currency", "Refunded", "Transaction ref", "Verified at", "Created at"],
        (data as unknown as { status: string; method_code: string; amount: number; currency: string; transaction_ref: string | null; verified_at: string | null; created_at: string; registrations: { reference: string; participants: { full_name: string } }; refunds: { amount: number }[] }[]).map((p) =>
          [p.registrations.reference, p.registrations.participants.full_name, p.method_code, p.status, p.amount, String(p.currency).trim(), (p.refunds ?? []).reduce((s, r) => s + Number(r.amount), 0), p.transaction_ref, p.verified_at, p.created_at]));
    } else if (kind === "attendance") {
      const rows = await attendanceReport(edition.id);
      csv = toCsv(["Reference", "Name", "Email", "Mobile", "Organization", "Category", "Checked in", "Checked in at", "Method"],
        rows.map((r) => { const at = attendedOf(r.attendance); return [r.reference, r.participants.full_name, r.participants.email, r.participants.mobile, r.participants.organization, r.category, at ? "yes" : "no", at?.checked_in_at ?? "", at?.method ?? ""]; }));
    } else if (kind === "certificates") {
      const rows = await listCertificates(edition.id);
      csv = toCsv(["Certificate ID", "Reference", "Name", "Issued at", "Status", "Revoked reason"],
        rows.map((c) => [c.certificate_code, c.registrations.reference, c.registrations.participants.full_name, c.issued_at, c.revoked_at ? "revoked" : "valid", c.revoked_reason ?? ""]));
    } else return NextResponse.json({ error: "unknown_export" }, { status: 404 });
    await createAdminClient().from("audit_logs").insert({ actor_id: a.adminId, action: `export.${kind}`, entity_type: "edition", entity_id: edition.id, ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null });
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${kind}-${edition.code}.csv"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof ForbiddenError ? "forbidden" : "unavailable" }, { status: e instanceof ForbiddenError ? 403 : 500 });
  }
}
