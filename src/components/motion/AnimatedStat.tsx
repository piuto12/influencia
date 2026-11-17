"use client";
import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export function AnimatedStat({ value, label, suffix = "" }: { value: number; label: string; suffix?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, value, { duration: reduce ? 0 : 1.6, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [inView, value, reduce]);
  return (
    <div ref={ref} className="text-center">
      <div className="font-display text-6xl text-crimson sm:text-7xl">{reduce ? value : n}{suffix}</div>
      <div className="mt-1 text-xs uppercase tracking-[0.25em] text-charcoal/70">{label}</div>
    </div>
  );
}
