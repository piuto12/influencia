import type { ReactNode } from "react";

export function Field({ label, name, errors, children, hint }: { label: string; name: string; errors?: string[]; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-charcoal">{label}</label>
      {children}
      {hint && !errors?.length && <p className="mt-1 text-xs text-charcoal/70">{hint}</p>}
      {errors?.length ? <p id={`${name}-err`} role="alert" className="mt-1 text-sm text-crimson">{errors[0]}</p> : null}
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-charcoal/20 bg-white px-4 py-3 text-base text-charcoal outline-none transition focus:border-crimson focus:ring-2 focus:ring-crimson/25";
