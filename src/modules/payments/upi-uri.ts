/** Pure UPI helpers (no QR library) so client components stay light. */
export function buildUpiUri(o: { upiId: string; payeeName?: string; amount?: number; note?: string; currency?: string }) {
  const q = new URLSearchParams({ pa: o.upiId, cu: o.currency ?? "INR" });
  if (o.payeeName) q.set("pn", o.payeeName);
  if (o.amount) q.set("am", o.amount.toFixed(2));
  if (o.note) q.set("tn", o.note.slice(0, 50));
  return `upi://pay?${q.toString()}`;
}

export const isValidUpiId = (v: string) => /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(v);

