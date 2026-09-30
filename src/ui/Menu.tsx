"use client";

import type { Level } from "@/game/bot";
import { TARGET, type Mode } from "@/game/match";
import { strings, type Lang } from "./strings";

const LEVEL_STYLE: Record<Level, string> = {
  easy: "bg-green text-cream",
  normal: "bg-gold text-ink",
  hard: "bg-red text-cream",
};

/** The front of the machine: the title and the ways to play, over a demo match. */
export function Menu({
  lang,
  onLang,
  onPlay,
  online,
}: {
  lang: Lang;
  onLang: () => void;
  onPlay: (mode: Mode, level: Level) => void;
  /** Shown once online play is available. */
  online?: () => void;
}) {
  const t = strings[lang];
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <div className="toon-panel anim-rise w-full max-w-md px-6 py-7 text-center sm:px-9">
        <h1 className="toon-text text-5xl text-gold sm:text-6xl">{t.title}</h1>
        <p className="mt-2 text-lg font-semibold tracking-wide uppercase">{t.tagline}</p>

        <section className="mt-7">
          <h2 className="font-sign text-xl">{t.vsBot}</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {(["easy", "normal", "hard"] as const).map((level, i) => (
              <button
                key={level}
                onClick={() => onPlay("bot", level)}
                className={`toon-button anim-rise text-base ${LEVEL_STYLE[level]}`}
                style={{ "--delay": `${120 + i * 70}ms` } as React.CSSProperties}
              >
                {t.levels[level]}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-3" style={{ gridTemplateColumns: online ? "1fr 1fr" : "1fr" }}>
          <button onClick={() => onPlay("local", "normal")} className="toon-button bg-blue text-cream">
            {t.local}
            <span className="mt-0.5 block font-sans text-sm font-semibold normal-case opacity-85">{t.localNote}</span>
          </button>
          {online && (
            <button onClick={online} className="toon-button bg-cream text-ink">
              {t.online}
              <span className="mt-0.5 block font-sans text-sm font-semibold normal-case opacity-75">{t.onlineNote}</span>
            </button>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between text-sm font-semibold">
          <span>{t.firstTo(TARGET)}</span>
          <button onClick={onLang} className="tracking-widest uppercase underline-offset-4 hover:underline">
            {t.lang}
          </button>
        </div>
      </div>
    </div>
  );
}
