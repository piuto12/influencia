import crypto from "node:crypto";

/** Check-in QR payload: v1.<base64url(regId:editionId)>.<hmac>. Contains no personal data; forging needs the server secret. */
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const mac = (payload: string, secret: string) => crypto.createHmac("sha256", secret).update(payload).digest("base64url").slice(0, 22);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function signCheckInToken(registrationId: string, editionId: string, secret: string): string {
  const payload = b64(`${registrationId}:${editionId}`);
  return `v1.${payload}.${mac(payload, secret)}`;
}

export function verifyCheckInToken(raw: string, secret: string): { registrationId: string; editionId: string } | null {
  const token = raw.trim();
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || token.length > 200) return null;
  const [, payload, sig] = parts;
  const expected = mac(payload, secret);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const [registrationId, editionId] = Buffer.from(payload, "base64url").toString("utf8").split(":");
  return UUID.test(registrationId ?? "") && UUID.test(editionId ?? "") ? { registrationId, editionId } : null;
}
