"use client";
import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
};
const nowSec = () => Math.floor(Date.now() / 1000);

export function Countdown({ targetIso, completedText = "This edition has concluded. Thank you for being part of it." }: {
  targetIso: string; completedText?: string;
}) {
  const now = useSyncExternalStore(subscribe, nowSec, () => 0);
  const target = Math.floor(new Date(targetIso).getTime() / 1000);
  const ready = now !== 0;
  const diff = Math.max(0, target - now);

  if (ready && target <= now) return <p className="font-serif text-xl text-white">{completedText}</p>;

  const parts = [
    ["Days", Math.floor(diff / 86400)],
    ["Hours", Math.floor((diff % 86400) / 3600)],
    ["Minutes", Math.floor((diff % 3600) / 60)],
    ["Seconds", diff % 60],
  ] as const;
  return (
    <div role="timer" aria-label="Time until the event" className="flex gap-3 sm:gap-5">
      {parts.map(([label, v]) => (
        <div key={label} className="min-w-[4.2rem] rounded-xl border border-white/20 bg-black/15 px-3 py-3 text-center backdrop-blur-sm sm:min-w-[5.5rem]">
          <div className="font-display text-4xl tabular-nums leading-none text-white sm:text-5xl">
            {ready ? String(v).padStart(2, "0") : "--"}
          </div>
          <div className="mt-1 text-[0.65rem] uppercase tracking-[0.25em] text-white/70">{label}</div>
        </div>
      ))}
    </div>
  );
}
