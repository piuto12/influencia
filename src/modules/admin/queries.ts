import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizePayments, summarizeRegistrations, type PayRow, type RegRow } from "./stats";

const db = () => createAdminClient();
export const PAGE_SIZE = 25;

export interface EditionLite { id: string; code: string; title: string; capacity: number; status: string; is_featured: boolean }

export async function listEditions(): Promise<EditionLite[]> {
  const { data, error } = await db().from("event_editions").select("id,code,title,capacity,status,is_featured").order("edition_number", { ascending: false });
  if (error) throw error; return data ?? [];
}
/** Selected edition from ?edition=<code>, else the featured one, else the newest. */
export async function resolveEdition(code?: string): Promise<{ edition: EditionLite | null; all: EditionLite[] }> {
  const all = await listEditions();
  const edition = all.find((e) => e.code === code) ?? all.find((e) => e.is_featured) ?? all[0] ?? null;
  return { edition, all };
}

export async function dashboard(edition: EditionLite) {
  const d = db();
  const [regs, pays, att] = await Promise.all([
    d.from("registrations").select("status,category").eq("edition_id", edition.id).limit(10000),
    d.from("payments").select("status,amount,currency,registrations!inner(edition_id),refunds(amount)").eq("registrations.edition_id", edition.id).limit(10000),
    d.from("attendance").select("id,registrations!inner(edition_id)", { count: "exact", head: true }).eq("registrations.edition_id", edition.id),
  ]);
  for (const r of [regs, pays, att]) if (r.error) throw r.error;
  const payRows: PayRow[] = (pays.data ?? []).map((p: { status: string; amount: string | number; currency: string; refunds: { amount: string | number }[] }) =>
    ({ status: p.status, amount: Number(p.amount), currency: String(p.currency).trim(), refunded: (p.refunds ?? []).reduce((s, x) => s + Number(x.amount), 0) }));
  return { reg: summarizeRegistrations((regs.data ?? []) as RegRow[], edition.capacity, att.count ?? 0), pay: summarizePayments(payRows) };
}

export interface RegFilters { q?: string; status?: string; category?: string; page?: number }
const SELECT = "id,reference,status,category,created_at,participants!inner(full_name,email,mobile,organization,city),payments(status,amount,currency,created_at)";

export async function listRegistrations(editionId: string, f: RegFilters, paged = true) {
  let q = db().from("registrations").select(SELECT, { count: "exact" }).eq("edition_id", editionId).order("created_at", { ascending: false });
  if (f.status) q = q.eq("status", f.status);
  if (f.category) q = q.eq("category", f.category);
  if (f.q) {
    const t = f.q.replace(/[%,()*\\]/g, " ").trim();
    if (t) q = q.or(`full_name.ilike.%${t}%,email.ilike.%${t}%,mobile.ilike.%${t}%,organization.ilike.%${t}%`, { referencedTable: "participants" });
  }
  if (paged) { const p = Math.max(1, f.page ?? 1); q = q.range((p - 1) * PAGE_SIZE, p * PAGE_SIZE - 1); } else q = q.limit(10000);
  const { data, count, error } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as unknown as RegistrationRow[], total: count ?? 0 };
}

export interface RegistrationRow {
  id: string; reference: string; status: string; category: string; created_at: string;
  participants: { full_name: string; email: string; mobile: string; organization: string | null; city: string | null };
  payments: { status: string; amount: number | string; currency: string; created_at: string }[];
}
export const latestPayment = (r: RegistrationRow) => [...(r.payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

export async function registrationDetail(id: string, withPayments: boolean) {
  const d = db();
  const { data: reg, error } = await d.from("registrations").select("*,participants(*),event_editions(code,title)").eq("id", id).maybeSingle();
  if (error) throw error; if (!reg) return null;
  const [hist, att, pays] = await Promise.all([
    d.from("registration_history").select("*").eq("registration_id", id).order("created_at"),
    d.from("attendance").select("*").eq("registration_id", id).maybeSingle(),
    withPayments ? d.from("payments").select("*,payment_events(*),payment_proofs(*),refunds(*)").eq("registration_id", id).order("created_at", { ascending: false })
      : d.from("payments").select("id,status,method_code,created_at").eq("registration_id", id).order("created_at", { ascending: false }),
  ]);
  return { reg, history: hist.data ?? [], attendance: att.data, payments: pays.data ?? [] };
}

export async function paymentQueue(editionId: string, status?: string) {
  let q = db().from("payments").select("id,status,amount,currency,method_code,transaction_ref,created_at,registrations!inner(id,reference,edition_id,participants(full_name))")
    .eq("registrations.edition_id", editionId).order("created_at", { ascending: false }).limit(300);
  if (status) q = q.eq("status", status); else q = q.in("status", ["proof_submitted", "under_verification"]);
  const { data, error } = await q; if (error) throw error;
  return (data ?? []) as unknown as { id: string; status: string; amount: number; currency: string; method_code: string; transaction_ref: string | null; created_at: string; registrations: { id: string; reference: string; participants: { full_name: string } } }[];
}

export async function paymentSettings(editionId: string) {
  const { data, error } = await db().from("payment_settings").select("*,payment_methods(label,provider,sort_order)").eq("edition_id", editionId);
  if (error) throw error;
  return (data ?? []).sort((a: { payment_methods: { sort_order: number } }, b: { payment_methods: { sort_order: number } }) => a.payment_methods.sort_order - b.payment_methods.sort_order);
}
export async function editionFull(id: string) {
  const { data, error } = await db().from("event_editions").select("*").eq("id", id).maybeSingle();
  if (error) throw error; return data;
}
export async function auditLog(limit = 200) {
  const { data, error } = await db().from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error; return data ?? [];
}
export async function adminUsers() {
  const { data, error } = await db().from("admin_users").select("*").order("created_at");
  if (error) throw error; return data ?? [];
}
export async function proofSignedUrl(proofId: string) {
  const { data: p } = await db().from("payment_proofs").select("storage_path").eq("id", proofId).maybeSingle();
  if (!p) return null;
  const { data } = await db().storage.from("private-payment-proofs").createSignedUrl(p.storage_path, 60);
  return data?.signedUrl ?? null;
}
