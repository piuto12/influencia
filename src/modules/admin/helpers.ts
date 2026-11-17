import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError } from "@/lib/auth";
import { PermissionError } from "@/modules/payments/service";
import { CONTENT_TAG } from "@/modules/content/queries";

export const back = (path: string, kind: "ok" | "err", msg: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);
export const text = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function audit(actor: string, action: string, entityType: string, entityId: string, before?: unknown, after?: unknown) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const { error } = await createAdminClient().from("audit_logs").insert({ actor_id: actor, action, entity_type: entityType, entity_id: entityId, before: before ?? null, after: after ?? null, ip, user_agent: h.get("user-agent")?.slice(0, 300) ?? null });
  if (error) throw new Error(error.message);
}

export const errMsg = (e: unknown) => {
  if (e instanceof ForbiddenError || e instanceof PermissionError) return "You don’t have permission for that action.";
  const m = e instanceof Error ? e.message : "";
  const known: Record<string, string> = {
    capacity_reached: "Capacity reached — enable the waiting list or raise capacity.", invalid_state: "That isn’t allowed in the current state.",
    reason_required: "A reason is required.", invalid_amount: "Invalid amount.", payment_not_verified: "No verified payment — verify the payment first (super admin may override).",
    invalid_input: "Please check the form: some values are missing or invalid.", slug_taken: "That URL slug is already used.", invalid_video_url: "Enter a valid YouTube or Vimeo link.",
    invalid_media: "That file isn’t allowed (type or size).", duplicate_key: "That already exists.",
    already_checked_in: "Already checked in.", email_not_configured: "Email isn’t configured yet — set EMAIL_PROVIDER_API_KEY and EMAIL_FROM on the server.", not_eligible: "Not eligible under the attendance rule.",
  };
  return Object.entries(known).find(([k]) => m.includes(k))?.[1] ?? "Something went wrong. Please try again.";
};
// Next's redirect() throws a control-flow error that must not be swallowed.
export const isRedirect = (e: unknown) => typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");

export async function run(path: string, okMsg: string, fn: () => Promise<void>) {
  try { await fn(); } catch (e) { if (isRedirect(e)) throw e; back(path, "err", errMsg(e)); }
  revalidatePath("/admin", "layout");
  updateTag(CONTENT_TAG);
  back(path, "ok", okMsg);
}
