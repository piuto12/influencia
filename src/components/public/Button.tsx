import Link from "next/link";
import type { ReactNode } from "react";

const styles = {
  primary: "bg-white text-crimson hover:bg-warm hover:shadow-[0_8px_30px_rgba(0,0,0,0.25)]",
  solid: "bg-crimson text-white hover:bg-maroon",
  ghost: "border border-white/60 text-white hover:bg-white/10",
} as const;

export function ButtonLink({ href, children, variant = "primary", external }: {
  href: string; children: ReactNode; variant?: keyof typeof styles; external?: boolean;
}) {
  const cls = `inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.15em] transition duration-300 hover:-translate-y-0.5 ${styles[variant]}`;
  return external
    ? <a href={href} className={cls} target="_blank" rel="noopener noreferrer">{children}</a>
    : <Link href={href} className={cls}>{children}</Link>;
}
