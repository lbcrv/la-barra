"use client";

import { useEffect, useState } from "react";
import { matchPoint, type Match } from "@/game/match";
import type { ActivePower } from "@/game/powerups";
import { TEAMS } from "@/game/teams";
import { CAP_STYLE } from "@/scene/PowerField";
import { SoundToggle } from "./SoundToggle";
import { strings, type Lang } from "./strings";

const TEAM_BG = { red: "bg-red", blue: "bg-blue" } as const;

/** Everything drawn over the table during a match: the score, the goal call, the controls. */
export function Hud({
  lang,
  match,
  onMenu,
  onCamera,
  onLang,
  powers,
}: {
  lang: Lang;
  match: Match;
  onMenu: () => void;
  onCamera: () => void;
  onLang: () => void;
  powers: ActivePower[];
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
          <SoundToggle lang={lang} />
          <button onClick={onCamera} className="hud-link">
            {t.resetView}
          </button>
          <button onClick={onLang} className="hud-link">
            {t.lang}
          </button>
        </div>
      </header>

      <PowerBadges lang={lang} powers={powers} />

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

/** Powers in play, under the score: whose, which, and the seconds left, counting down. */
function PowerBadges({ lang, powers }: { lang: Lang; powers: ActivePower[] }) {
  const [now, setNow] = useState(() => performance.now() / 1000);
  useEffect(() => {
    if (powers.length === 0) return;
    const id = window.setInterval(() => setNow(performance.now() / 1000), 200);
    return () => window.clearInterval(id);
  }, [powers.length]);

  const live = powers.filter((p) => p.until > now);
  if (live.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[4.6rem] flex justify-center gap-2 sm:top-[5.2rem]">
      {live.map((p) => (
        <div
          key={p.power}
          className="anim-pop flex items-center gap-1.5 rounded-full border-[3px] border-ink px-2.5 py-0.5 text-sm font-semibold"
          style={{ background: CAP_STYLE[p.power].cap, color: p.power === "hielo" || p.power === "turbo" ? "#1b1410" : "#f6ead0", boxShadow: "3px 3px 0 #1b1410" }}
        >
          <span className="size-3 rounded-full border-2 border-ink" style={{ background: TEAMS[p.side].color }} />
          {strings[lang].powers[p.power]}
          <span className="tabular-nums opacity-80">{Math.ceil(p.until - now)}</span>
        </div>
      ))}
    </div>
  );
}
