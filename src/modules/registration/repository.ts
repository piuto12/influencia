import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Availability, RegistrationRepository, StatusRecord } from "./service";

/** Supabase-backed repository. Service-role client: only reachable through vetted server actions. */
export const supabaseRegistrationRepository: RegistrationRepository = {
  async getAvailability(code): Promise<Availability | null> {
    const db = createAdminClient();
    const { data: ed, error } = await db.from("event_editions")
      .select("id, capacity, waitlist_enabled, registration_open, registration_deadline").eq("code", code).maybeSingle();
    if (error) throw error;
    if (!ed) return null;
    const { count, error: e2 } = await db.from("registrations").select("id", { count: "exact", head: true })
      .eq("edition_id", ed.id).eq("status", "confirmed");
    if (e2) throw e2;
    return { registrationOpen: ed.registration_open, confirmed: count ?? 0, capacity: ed.capacity, waitlistEnabled: ed.waitlist_enabled, deadline: ed.registration_deadline };
  },

  async register(code, data) {
    const db = createAdminClient();
    const { data: rows, error } = await db.rpc("register_for_edition", { p_edition_code: code, p_data: data });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { registrationId: row.registration_id, reference: row.reference };
  },

  async findForStatus(reference): Promise<StatusRecord | null> {
    const db = createAdminClient();
    const { data, error } = await db.from("registrations")
      .select("id,edition_id,reference,status,participants(full_name,email,mobile,whatsapp),event_editions(title,whatsapp_group_url),payments(status,created_at)")
      .eq("reference", reference).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const p = data.participants as unknown as { full_name: string; email: string; mobile: string; whatsapp: string | null };
    const e = data.event_editions as unknown as { title: string; whatsapp_group_url: string | null };
    const pays = ((data.payments ?? []) as { status: string; created_at: string }[]).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { registrationId: data.id, editionId: data.edition_id, reference: data.reference, status: data.status, fullName: p.full_name, email: p.email, mobile: p.mobile, whatsapp: p.whatsapp,
      editionTitle: e.title, whatsappGroupUrl: e.whatsapp_group_url, paymentStatus: pays[0]?.status ?? null };
  },
};
