"use client";

import { pingBars } from "@/net/protocol";
import type { Lang } from "./strings";

const COLOURS = ["#d7322a", "#d7322a", "#f2b632", "#2f8f46"];

/** Signal bars and the round trip in ms, in a corner during online play. Null means no answer lately. */
export function Ping({ ms, lang, relayed = null }: { ms: number | null; lang: Lang; relayed?: boolean | null }) {
  const bars = pingBars(ms);
  const colour = COLOURS[bars];
  const label = ms === null ? (lang === "es" ? "sin señal" : "no signal") : `${Math.round(ms)} ms`;
  // Through the TURN relay the trip is longer; worth knowing when the ping is high.
  const via = relayed ? (lang === "es" ? "por relevo" : "relayed") : null;
  return (
    <div
      className="toon-panel pointer-events-none absolute right-3 bottom-3 flex items-center gap-2 px-2.5 py-1 sm:right-5 sm:bottom-5"
      style={{ borderRadius: 12, boxShadow: "3px 3px 0 var(--ink)" }}
      role="status"
      aria-label={`Ping ${label}`}
    >
      <svg viewBox="0 0 18 14" className="h-3.5 w-4.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={i * 6.5}
            y={10 - i * 4.5}
            width="4.5"
            height={4 + i * 4.5}
            rx="1"
            fill={i < bars ? colour : "#c9bfa8"}
            stroke="#1b1410"
            strokeWidth="1.2"
          />
        ))}
      </svg>
      <span className="text-sm font-semibold tabular-nums" style={{ color: bars <= 1 ? "#d7322a" : "#1b1410" }}>
        {label}
      </span>
      {via && <span className="text-xs font-semibold text-ink/60">· {via}</span>}
    </div>
  );
}
