export interface Discount { label: string; type: "percent" | "fixed"; value: number; valid_from?: string; valid_until?: string }
export interface FeeResult { baseFee: number; discountApplied: Discount | null; final: number; currency: string }

/** Best single non-stackable discount currently valid. Pure; server-side only trust. */
export function computeFee(baseFee: number, discounts: Discount[], currency: string, now = new Date()): FeeResult {
  let best: Discount | null = null; let bestAmount = baseFee;
  for (const d of discounts) {
    if (d.valid_from && now < new Date(d.valid_from)) continue;
    if (d.valid_until && now > new Date(d.valid_until)) continue;
    const amt = d.type === "percent" ? baseFee * (1 - Math.min(100, Math.max(0, d.value)) / 100) : baseFee - Math.max(0, d.value);
    const rounded = Math.max(0, Math.round(amt * 100) / 100);
    if (rounded < bestAmount) { best = d; bestAmount = rounded; }
  }
  return { baseFee, discountApplied: best, final: bestAmount, currency };
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}
