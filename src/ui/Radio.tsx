"use client";

import { NARRATOR } from "@/game/narrator";
import { strings, type Lang } from "./strings";

/** Don Chepe's line, in a speech bubble coming from the shop's radio. */
export function Radio({ lang, line }: { lang: Lang; line: { text: string; id: number } | null }) {
  if (!line) return null;
  return (
    <div className="pointer-events-none absolute bottom-28 left-3 max-w-72 sm:bottom-20 sm:left-5 sm:max-w-xs">
      <div key={line.id} className="toon-panel anim-pop relative px-4 py-2.5" style={{ borderRadius: 16 }}>
        <p className="font-sign text-xs tracking-wider text-red uppercase">
          {NARRATOR} · {strings[lang].radio}
        </p>
        <p className="mt-0.5 text-lg leading-snug font-semibold">{line.text}</p>
        {/* The bubble's tail, pointing down at the radio. */}
        <span
          className="absolute -bottom-3 left-6 size-5 rotate-45 border-r-[3px] border-b-[3px] border-ink bg-cream"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
