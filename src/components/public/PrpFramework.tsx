"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { prpPillars } from "@/modules/events/site-content";

const pos = [{ x: 200, y: 50 }, { x: 70, y: 270 }, { x: 330, y: 270 }];

export function PrpFramework() {
  const [i, setI] = useState(0);
  const p = prpPillars[i];
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <svg viewBox="0 0 400 320" role="img" aria-label="PRP Framework: three connected pillars" className="mx-auto w-full max-w-md">
        <polygon points="200,50 70,270 330,270" fill="none" stroke="rgba(214,173,80,0.6)" strokeWidth="1.5" />
        {pos.map((q, k) => (
          <g key={k} role="button" tabIndex={0} aria-label={prpPillars[k].title} aria-pressed={i === k} className="cursor-pointer outline-none"
            onClick={() => setI(k)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setI(k)}>
            <motion.circle cx={q.x} cy={q.y} animate={{ r: i === k ? 46 : 36 }} fill={i === k ? "#B30E19" : "#790609"} stroke="white" strokeOpacity={i === k ? 0.9 : 0.35} />
            <text x={q.x} y={q.y + 14} textAnchor="middle" fill="white" fontSize="40" fontFamily="var(--font-anton)">{prpPillars[k].letter}</text>
          </g>
        ))}
      </svg>
      <div className="min-h-44">
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
            <p className="text-xs uppercase tracking-[0.3em] text-gold">Pillar {i + 1}</p>
            <h3 className="mt-2 font-serif text-3xl sm:text-4xl">{p.title}</h3>
            <p className="mt-4 max-w-md text-lg text-white/85">{p.body}</p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-6 flex gap-2">
          {prpPillars.map((_, k) => (
            <button key={k} type="button" aria-label={`Show pillar ${k + 1}`} aria-pressed={i === k} onClick={() => setI(k)} className="flex h-8 w-12 items-center justify-center">
              <span className={`h-1.5 w-10 rounded-full transition ${i === k ? "bg-white" : "bg-white/30"}`} />
            </button>))}
        </div>
      </div>
    </div>
  );
}
