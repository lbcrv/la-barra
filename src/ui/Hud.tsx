"use client";

import { matchPoint, type Match } from "@/game/match";
import { TEAMS } from "@/game/teams";
import { strings, type Lang } from "./strings";

const TEAM_BG = { red: "bg-red", blue: "bg-blue" } as const;

/** Everything drawn over the table during a match: the score, the goal call, the controls. */
export function Hud({
  lang,
  match,
  onMenu,
  onCamera,
  onLang,
}: {
  lang: Lang;
  match: Match;
  onMenu: () => void;
  onCamera: () => void;
  onLang: () => void;
}) {
  const t = strings[lang];
  const point = matchPoint(match, "red") || matchPoint(match, "blue");

  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-5">
        <button onClick={onMenu} className="toon-button pointer-events-auto bg-cream px-3 py-1.5 text-sm text-ink">
          {t.menu}
        </button>

        <div className="toon-panel flex items-center overflow-hidden text-cream" style={{ borderRadius: 14 }}>
          {(["red", "blue"] as const).map((side, i) => (
            <div key={side} className={`flex items-center gap-2 px-3 py-1.5 sm:gap-3 sm:px-4 ${TEAM_BG[side]} ${i === 1 ? "flex-row-reverse" : ""}`}>
              <span className="hidden text-sm font-semibold tracking-wide sm:inline">{TEAMS[side].name}</span>
              <span className="font-sign text-sm sm:hidden">{TEAMS[side].short}</span>
              <span className="toon-text w-7 text-center text-3xl tabular-nums">{match.score[side]}</span>
            </div>
          ))}
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-1 pt-1 sm:flex-row sm:gap-4">
          <button onClick={onCamera} className="hud-link">
            {t.resetView}
          </button>
          <button onClick={onLang} className="hud-link">
            {t.lang}
          </button>
        </div>
      </header>

      {point && match.phase === "playing" && (
        <p className="toon-text pointer-events-none absolute inset-x-0 top-20 text-center text-xl text-gold sm:top-24">{t.matchPoint}</p>
      )}

      {match.phase === "goal" && match.last && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p key={match.score.red + match.score.blue} className="toon-text anim-pop text-7xl sm:text-9xl" style={{ color: TEAMS[match.last].color }}>
            {t.goal}
          </p>
        </div>
      )}

      <footer className="pointer-events-none absolute inset-x-0 bottom-3 space-y-0.5 px-4 text-center text-sm font-semibold text-cream/70">
        {match.mode === "bot" ? <p>{t.controlsMouse}</p> : (
          <>
            <p>{t.controlsRed}</p>
            <p>{t.controlsBlue}</p>
          </>
        )}
        <p className="hidden sm:block">{t.controlsCamera}</p>
      </footer>
    </>
  );
}

/** The final whistle: who won, the score, and the way back in. */
export function Victory({ lang, match, onRematch, onMenu }: { lang: Lang; match: Match; onRematch: () => void; onMenu: () => void }) {
  const t = strings[lang];
  const winner = match.last!;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-ink/40 p-4">
      <div className="toon-panel anim-pop w-full max-w-sm px-6 py-7 text-center">
        <p className="toon-text text-4xl leading-tight" style={{ color: TEAMS[winner].color }}>
          {t.won(TEAMS[winner].name)}
        </p>
        <p className="font-sign mt-4 text-5xl tabular-nums">
          <span className="text-red">{match.score.red}</span>
          <span className="mx-3 text-ink/40">:</span>
          <span className="text-blue">{match.score.blue}</span>
        </p>
        <div className="mt-7 grid grid-cols-2 gap-3">
          <button onClick={onRematch} className="toon-button bg-gold text-ink">
            {t.rematch}
          </button>
          <button onClick={onMenu} className="toon-button bg-cream text-ink">
            {t.menu}
          </button>
        </div>
      </div>
    </div>
  );
}
