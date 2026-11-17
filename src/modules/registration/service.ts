import { normalizePhone, registrationSchema, statusLookupSchema, type RegistrationInput } from "./schemas";

export type RegistrationErrorCode =
  | "validation" | "registration_closed" | "deadline_passed" | "duplicate_registration"
  | "capacity_full" | "edition_not_found" | "unavailable";

export type RegisterResult =
  | { ok: true; reference: string }
  | { ok: false; code: RegistrationErrorCode; fieldErrors?: Record<string, string[]> };

export interface Availability { registrationOpen: boolean; confirmed: number; capacity: number; waitlistEnabled: boolean; deadline: string | null }

export interface RegistrationRepository {
  getAvailability(editionCode: string): Promise<Availability | null>;
  register(editionCode: string, data: Record<string, unknown>): Promise<{ registrationId: string; reference: string }>;
  findForStatus(reference: string): Promise<StatusRecord | null>;
}

export interface StatusRecord {
  registrationId: string; editionId: string; reference: string; status: string; fullName: string; email: string; mobile: string; whatsapp: string | null;
  editionTitle: string; whatsappGroupUrl: string | null; paymentStatus: string | null;
}

const KNOWN = new Set(["registration_closed", "deadline_passed", "duplicate_registration", "edition_not_found"]);

export async function registerParticipant(
  editionCode: string, raw: Record<string, unknown>, repo: RegistrationRepository, now = new Date(),
): Promise<RegisterResult> {
  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "validation", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const input: RegistrationInput = parsed.data;

  const a = await repo.getAvailability(editionCode);
  if (!a) return { ok: false, code: "edition_not_found" };
  if (!a.registrationOpen) return { ok: false, code: "registration_closed" };
  if (a.deadline && now > new Date(a.deadline)) return { ok: false, code: "deadline_passed" };
  if (a.confirmed >= a.capacity && !a.waitlistEnabled) return { ok: false, code: "capacity_full" };

  const { website: _hp, consent: _c, ...rest } = input;
  void _hp; void _c;
  const data = { ...rest, whatsapp: rest.whatsapp || null };
  try {
    const r = await repo.register(editionCode, data);
    return { ok: true, reference: r.reference };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = [...KNOWN].find((k) => msg.includes(k));
    return { ok: false, code: (code as RegistrationErrorCode | undefined) ?? "unavailable" };
  }
}

export type StatusResult =
  | { found: true; reference: string; status: string; firstName: string; editionTitle: string; paymentStatus: string | null; whatsappGroupUrl: string | null }
  | { found: false };

/** Reference + matching email or phone. Identical response for every failure mode. */
/** Proves the caller knows the reference AND the email/phone used. Null for every failure mode. */
export async function authenticateRegistrant(raw: Record<string, unknown>, repo: Pick<RegistrationRepository, "findForStatus">): Promise<StatusRecord | null> {
  const parsed = statusLookupSchema.safeParse(raw);
  if (!parsed.success) return null;
  const rec = await repo.findForStatus(parsed.data.reference);
  if (!rec) return null;
  const c = parsed.data.contact;
  const phone = normalizePhone(c);
  const match = c.toLowerCase() === rec.email.toLowerCase() ||
    (phone !== null && (phone === rec.mobile || phone === rec.whatsapp));
  return match ? rec : null;
}

export async function lookupStatus(raw: Record<string, unknown>, repo: RegistrationRepository): Promise<StatusResult> {
  const rec = await authenticateRegistrant(raw, repo);
  if (!rec) return { found: false };
  return {
    found: true, reference: rec.reference, status: rec.status, firstName: rec.fullName.split(" ")[0],
    editionTitle: rec.editionTitle, paymentStatus: rec.paymentStatus,
    // Group link only for confirmed participants.
    whatsappGroupUrl: rec.status === "confirmed" ? rec.whatsappGroupUrl : null,
  };
}
