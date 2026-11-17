"use client";
import { motion, useReducedMotion } from "motion/react";

/** Layered circles + thin arcs echoing the poster. Pure SVG; slow rotation disabled for reduced motion. */
export function CircleField({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const spin = (d: number, dir = 1) =>
    reduce ? {} : { animate: { rotate: 360 * dir }, transition: { duration: d, ease: "linear" as const, repeat: Infinity } };
  return (
    <svg aria-hidden viewBox="0 0 800 800" className={`pointer-events-none ${className}`} fill="none">
      <circle cx="400" cy="400" r="330" fill="rgba(0,0,0,0.12)" />
      <motion.g style={{ originX: "400px", originY: "400px" }} {...spin(120)}>
        <circle cx="400" cy="400" r="380" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeDasharray="900 1500" />
      </motion.g>
      <motion.g style={{ originX: "400px", originY: "400px" }} {...spin(180, -1)}>
        <circle cx="400" cy="400" r="300" stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeDasharray="500 1400" />
      </motion.g>
      <circle cx="400" cy="400" r="210" stroke="rgba(214,173,80,0.35)" strokeWidth="1" />
      <circle cx="400" cy="400" r="110" fill="rgba(255,255,255,0.04)" />
    </svg>
  );
}
