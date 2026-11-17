import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { signCheckInToken, verifyCheckInToken } from "./token";

const db = () => createAdminClient();
const secret = () => { const s = process.env.QR_SIGNING_SECRET; if (!s || s.length < 32) throw new Error("qr_secret_missing"); return s; };

export const tokenFor = (registrationId: string, editionId: string) => signCheckInToken(registrationId, editionId, secret());

export type CheckInOutcome =
  | { ok: true; result: "checked_in" | "already_checked_in"; at: string; name: string; reference: string }
  | { ok: false; error: "invalid_code" | "wrong_edition" | "not_confirmed" | "not_found" | "unavailable" };

export async function checkInByToken(token: string, editionId: string, actor: string): Promise<CheckInOutcome> {
  try {
    const t = verifyCheckInToken(token, secret());
    if (!t) return { ok: false, error: "invalid_code" };
    if (t.editionId !== editionId) return { ok: false, error: "wrong_edition" };
    return await checkIn(t.registrationId, "qr", actor);
  } catch { return { ok: false, error: "unavailable" }; }
}

export async function checkIn(registrationId: string, method: "qr" | "manual", actor: string): Promise<CheckInOutcome> {
  const { data, error } = await db().rpc("check_in_registration", { p_registration: registrationId, p_method: method, p_actor: actor });
  if (error) return { ok: false, error: error.message.includes("not_confirmed") ? "not_confirmed" : error.message.includes("not_found") ? "not_found" : "unavailable" };
  const { data: reg } = await db().from("registrations").select("reference,participants(full_name)").eq("id", registrationId).single();
  const name = (reg?.participants as unknown as { full_name: string } | undefined)?.full_name ?? "";
  return { ok: true, result: data.result, at: data.at, name, reference: reg?.reference ?? "" };
}

export async function searchConfirmed(editionId: string, q: string) {
  let query = db().from("registrations").select("id,reference,participants!inner(full_name,email,mobile,organization),attendance(checked_in_at,method)").eq("edition_id", editionId).eq("status", "confirmed").order("reference").limit(30);
  const t = q.replace(/[%,()*\\]/g, " ").trim();
  if (t) query = query.or(`full_name.ilike.%${t}%,email.ilike.%${t}%,mobile.ilike.%${t}%`, { referencedTable: "participants" });
  const { data, error } = await query; if (error) throw error;
  return (data ?? []) as unknown as { id: string; reference: string; participants: { full_name: string; email: string; mobile: string; organization: string | null }; attendance: { checked_in_at: string; method: string } | { checked_in_at: string; method: string }[] | null }[];
}

export async function attendanceReport(editionId: string) {
  const { data, error } = await db().from("registrations").select("reference,category,participants(full_name,email,mobile,organization),attendance(checked_in_at,method)").eq("edition_id", editionId).eq("status", "confirmed").order("reference").limit(10000);
  if (error) throw error;
  return (data ?? []) as unknown as { reference: string; category: string; participants: { full_name: string; email: string; mobile: string; organization: string | null }; attendance: { checked_in_at: string; method: string }[] | { checked_in_at: string; method: string } | null }[];
}
export const attendedOf = (a: unknown) => (Array.isArray(a) ? a[0] : a) as { checked_in_at: string; method: string } | null | undefined;
