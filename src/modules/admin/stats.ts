export interface RegRow { status: string; category: string }
export interface PayRow { status: string; amount: number; refunded: number; currency: string }

const PENDING = new Set(["submitted", "payment_pending", "proof_submitted", "under_verification"]);

export function summarizeRegistrations(rows: RegRow[], capacity: number, checkedIn = 0) {
  const byStatus: Record<string, number> = {}; const byCategory: Record<string, number> = {};
  let pending = 0;
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    if (PENDING.has(r.status)) pending++;
  }
  const confirmed = byStatus.confirmed ?? 0;
  return { total: rows.length, confirmed, pending, byStatus, byCategory, availableSeats: Math.max(0, capacity - confirmed), checkedIn,
    attendanceRate: confirmed ? Math.round((checkedIn / confirmed) * 100) : 0 };
}

/** Collection = verified payments less recorded refunds, per currency. */
export function summarizePayments(rows: PayRow[]) {
  const collected: Record<string, number> = {}; const refunded: Record<string, number> = {};
  let awaitingVerification = 0;
  for (const p of rows) {
    if (p.status === "proof_submitted" || p.status === "under_verification") awaitingVerification++;
    if (["verified", "partially_refunded", "refunded"].includes(p.status)) {
      collected[p.currency] = (collected[p.currency] ?? 0) + p.amount;
      refunded[p.currency] = (refunded[p.currency] ?? 0) + p.refunded;
    }
  }
  const net: Record<string, number> = {};
  for (const c of Object.keys(collected)) net[c] = Math.round((collected[c] - (refunded[c] ?? 0)) * 100) / 100;
  return { awaitingVerification, collected, refunded, net };
}
