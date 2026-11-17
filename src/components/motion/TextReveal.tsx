"use client";
import { motion, useReducedMotion } from "motion/react";

/** Word-by-word masked slide-up. Static text when reduced motion is requested. */
export function TextReveal({ text, className, delay = 0, as: Tag = "span" }: {
  text: string; className?: string; delay?: number; as?: "span" | "h1" | "h2" | "p";
}) {
  const reduce = useReducedMotion();
  if (reduce) return <Tag className={className}>{text}</Tag>;
  return (
    <Tag className={className} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden align-bottom pr-[0.25em]">
          <motion.span
            className="inline-block"
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.9, delay: delay + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
