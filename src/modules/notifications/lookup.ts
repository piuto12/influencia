import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
export async function registrationIdByReference(reference: string): Promise<string | null> {
  const { data } = await createAdminClient().from("registrations").select("id").eq("reference", reference).maybeSingle();
  return data?.id ?? null;
}
export async function registrationIdForPayment(paymentId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("payments").select("registration_id").eq("id", paymentId).maybeSingle();
  return data?.registration_id ?? null;
}
