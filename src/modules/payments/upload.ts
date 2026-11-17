export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export type ProofCheck = { ok: true; mime: string; ext: string } | { ok: false; reason: "empty" | "too_large" | "unsupported_type" };

const starts = (b: Uint8Array, sig: number[], off = 0) => sig.every((v, i) => b[off + i] === v);

/** Trust magic bytes, never the client-declared type or filename. */
export function validateProof(bytes: Uint8Array): ProofCheck {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > MAX_PROOF_BYTES) return { ok: false, reason: "too_large" };
  if (starts(bytes, [0xff, 0xd8, 0xff])) return { ok: true, mime: "image/jpeg", ext: "jpg" };
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ok: true, mime: "image/png", ext: "png" };
  if (starts(bytes, [0x52, 0x49, 0x46, 0x46]) && starts(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return { ok: true, mime: "image/webp", ext: "webp" };
  if (starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { ok: true, mime: "application/pdf", ext: "pdf" };
  return { ok: false, reason: "unsupported_type" };
}
