"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { Level } from "@/game/bot";
import { TARGET, type Mode } from "@/game/match";
import { TEAMS } from "@/game/teams";
import { setSoundOn, soundOn, subscribeSound } from "@/scene/sound";
import { Cap, Crest, IconBook, IconGear, IconGlobe, IconSound } from "./art";
import { strings, type Lang } from "./strings";

/** The difficulty caps: colour, and how many stars are punched into each. */
const LEVEL_CAP: Record<Level, { color: string; stars: number }> = {
  easy: { color: "#2f8f46", stars: 1 },
  normal: { color: "#f2b632", stars: 2 },
  hard: { color: "#d7322a", stars: 3 },
};

/**
 * The front of the shop: its painted sign hanging over the price board, where
 * today's ways to play are chalked up. The demo match plays on behind it.
 */
export function Menu({
  lang,
  onLang,
  onPlay,
  online,
  onOptions,
  onGuide,
}: {
  lang: Lang;
  onLang: () => void;
  onPlay: (mode: Mode, level: Level) => void;
  /** Shown once online play is available. */
  online?: () => void;
  onOptions: () => void;
  onGuide: () => void;
}) {
  const t = strings[lang];
  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="flex min-h-full w-full max-w-[33rem] flex-col items-center justify-center px-4 pt-10 pb-6 md:ml-[5vw]">
        <ShopSign title={t.title} tagline={t.tagline} line={t.signLine} />
        <Board className="anim-rise mt-7 w-full" style={{ "--delay": "90ms" } as React.CSSProperties}>
          <p className="font-chalk text-2xl text-gold">{t.today}</p>

          <div className="mt-1">
            <p className="font-chalk px-3 text-3xl leading-tight">{t.vsBot}</p>
            <div className="mt-1 flex justify-around gap-2 sm:justify-start sm:gap-5 sm:px-2">
              {(["easy", "normal", "hard"] as const).map((level) => (
                <button key={level} onClick={() => onPlay("bot", level)} className="cap-button" aria-label={`${t.vsBot}: ${t.levels[level]}`}>
                  <Cap color={LEVEL_CAP[level].color} className="size-16 sm:size-[4.5rem]">
                    <Stars n={LEVEL_CAP[level].stars} />
                  </Cap>
                  <span className="font-chalk text-xl">{t.levels[level]}</span>
                </button>
              ))}
            </div>
          </div>

          <hr className="chalk-rule my-3" />

          <BoardItem onClick={() => onPlay("local", "normal")} title={t.local} note={t.localNote}>
            <span className="flex w-13 flex-none -space-x-2" aria-hidden="true">
              <Crest team="red" className="size-9" />
              <Crest team="blue" className="size-9" />
            </span>
          </BoardItem>
          {online && (
            <BoardItem onClick={online} title={t.online} note={t.onlineNote}>
              {/* Two screens, chalked, with the line between them. */}
              <svg viewBox="0 0 48 32" className="h-9 w-13 flex-none" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <rect x="2" y="6" width="15" height="11" rx="2" />
                <path d="M6 22h7M9.5 17v5" />
                <rect x="31" y="6" width="15" height="11" rx="2" />
                <path d="M35 22h7M38.5 17v5" />
                <path d="M19 11.5h10" strokeDasharray="2.5 3" stroke="var(--gold)" />
              </svg>
            </BoardItem>
          )}

          <hr className="chalk-rule my-3" />
          <p className="px-3 text-base leading-snug font-semibold text-chalk/85">
            {t.firstTo(TARGET)}. {t.powersNote}.
          </p>
        </Board>

        <nav className="anim-rise mt-6 flex flex-wrap justify-center gap-2.5" style={{ "--delay": "160ms" } as React.CSSProperties} aria-label={t.options}>
          <button onClick={onOptions} className="icon-button">
            <IconGear />
            {t.options}
          </button>
          <button onClick={onGuide} className="icon-button">
            <IconBook />
            {t.howTo}
          </button>
          <button onClick={onLang} className="icon-button" lang={lang === "es" ? "en" : "es"}>
            <IconGlobe />
            {t.lang}
          </button>
          <SoundButton lang={lang} label={false} />
        </nav>
      </div>
    </div>
  );
}

/** The sign over the shop, hanging from two wires, with both crests painted on. */
function ShopSign({ title, tagline, line }: { title: string; tagline: string; line: string }) {
  return (
    <div className="anim-rise relative w-full max-w-120 -rotate-1">
      {/* The wires it hangs from, up out of sight. */}
      <span className="absolute bottom-full left-[14%] h-40 w-1 border-x border-ink bg-[#a9b0b6]" aria-hidden="true" />
      <span className="absolute right-[14%] bottom-full h-40 w-1 border-x border-ink bg-[#a9b0b6]" aria-hidden="true" />
      <div className="shop-sign px-5 pt-4 pb-3.5 text-center">
        <div className="flex items-center justify-center gap-3">
          <Crest team="red" className="hidden size-12 flex-none min-[480px]:block" title={TEAMS.red.name} />
          <h1 className="sign-title text-[min(3.75rem,15vw)] whitespace-nowrap">{title}</h1>
          <Crest team="blue" className="hidden size-12 flex-none min-[480px]:block" title={TEAMS.blue.name} />
        </div>
        <p className="font-sign mt-2 text-base tracking-wide text-ink uppercase sm:text-lg">{tagline}</p>
        <p className="mt-0.5 text-sm font-semibold text-ink/75">{line}</p>
      </div>
    </div>
  );
}

/** The price board: chalk on slate in a wooden frame. */
export function Board({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`chalkboard px-3 py-4 sm:px-5 ${className}`} style={style}>
      {children}
    </section>
  );
}

/** One line chalked on the board, to press. */
function BoardItem({ onClick, title, note, children }: { onClick: () => void; title: string; note: string; children: ReactNode }) {
  return (
    <button onClick={onClick} className="chalk-button">
      {children}
      <span className="flex-1">
        <span className="font-chalk block text-3xl leading-none">{title}</span>
        <span className="mt-0.5 block text-base font-semibold text-chalk/80">{note}</span>
      </span>
      <span className="font-chalk text-3xl text-gold" aria-hidden="true">
        →
      </span>
    </button>
  );
}

/** Stars punched into a cap, one per level of difficulty. */
function Stars({ n }: { n: number }) {
  const xs = n === 1 ? [50] : n === 2 ? [38, 62] : [30, 50, 70];
  return (
    <>
      {xs.map((x) => (
        <path
          key={x}
          d={star(x, 50, 10)}
          fill="#f6ead0"
          stroke="#1b1410"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      ))}
    </>
  );
}

function star(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Sound on or off, as an icon button that says what it does. */
export function SoundButton({ lang, label = true }: { lang: Lang; label?: boolean }) {
  // The server renders it on; the browser then reads the saved choice.
  const on = useSyncExternalStore(subscribeSound, soundOn, () => true);
  const t = strings[lang];
  return (
    <button onClick={() => setSoundOn(!on)} aria-pressed={on} aria-label={label ? undefined : on ? t.hud.soundOn : t.hud.soundOff} className="icon-button">
      <IconSound on={on} />
      {label && (on ? t.sound.on : t.sound.off)}
    </button>
  );
}
