"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { matchPoint, type Match } from "@/game/match";
import type { ActivePower } from "@/game/powerups";
import { TEAMS, type Side } from "@/game/teams";
import { CAP_STYLE } from "@/scene/PowerField";
import { Crest, IconCamera, IconPause, Key } from "./art";
import { SoundButton } from "./Menu";
import { useSettings } from "./settings";
import { strings, type Lang } from "./strings";

const TEAM_BG = { red: "bg-red", blue: "bg-blue" } as const;

/** Everything drawn over the table during a match: the score, the goal call, the controls. */
export function Hud({
  lang,
  match,
  onPause,
  onCamera,
  powers,
}: {
  lang: Lang;
  match: Match;
  onPause: () => void;
  onCamera: () => void;
  powers: ActivePower[];
}) {
  const t = strings[lang];
  const { hints } = useSettings();
  const point = matchPoint(match, "red") || matchPoint(match, "blue");

  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-5">
        <button onClick={onPause} className="icon-button pointer-events-auto" aria-label={t.pause.open}>
          <IconPause />
          <span className="hidden sm:inline">{t.pause.open}</span>
        </button>

        <Scoreboard score={match.score} />

        <div className="pointer-events-auto flex flex-col gap-2 sm:flex-row">
          <SoundButton lang={lang} label={false} />
          <button onClick={onCamera} className="icon-button" aria-label={t.hud.camera} title={t.hud.camera}>
            <IconCamera />
          </button>
        </div>
      </header>

      <PowerBadges lang={lang} powers={powers} />

      {point && match.phase === "playing" && (
        <p className="toon-text pointer-events-none absolute inset-x-0 top-24 text-center text-xl text-gold sm:top-28">{t.matchPoint}</p>
      )}

      {match.phase === "goal" && match.last && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status">
          <p key={match.score.red + match.score.blue} className="toon-text anim-pop text-7xl sm:text-9xl" style={{ color: TEAMS[match.last].color }}>
            {t.goal}
          </p>
        </div>
      )}

      {hints && <Hints lang={lang} local={match.mode === "local"} />}
    </>
  );
}

/** The score, painted: each side's crest and colour, the numbers on cream cards. */
function Scoreboard({ score }: { score: Record<Side, number> }) {
  return (
    <div className="toon-panel flex items-stretch overflow-hidden" style={{ borderRadius: 14 }} role="status" aria-label={`${TEAMS.red.name} ${score.red}, ${TEAMS.blue.name} ${score.blue}`}>
      {(["red", "blue"] as const).map((side, i) => (
        <div key={side} className={`flex items-center gap-2 px-1.5 py-1.5 sm:px-3 ${TEAM_BG[side]} ${i === 1 ? "order-3 flex-row-reverse" : ""}`}>
          <Crest team={side} className="size-7 flex-none sm:size-9" />
          <span className="hidden max-w-36 text-sm leading-tight font-semibold text-cream md:block">{TEAMS[side].name}</span>
          <span className="font-sign hidden text-sm text-cream sm:inline md:hidden">{TEAMS[side].short}</span>
        </div>
      ))}
      <div className="order-2 flex items-center gap-1.5 bg-ink px-2 py-1.5" aria-hidden="true">
        <Digit n={score.red} />
        <Digit n={score.blue} />
      </div>
    </div>
  );
}

function Digit({ n }: { n: number }) {
  return <span className="font-sign grid h-10 w-8 place-items-center rounded-md border-2 border-ink bg-cream text-2xl text-ink tabular-nums">{n}</span>;
}

const COARSE = "(pointer: coarse)";
const subscribePointer = (l: () => void) => {
  const m = window.matchMedia(COARSE);
  m.addEventListener("change", l);
  return () => m.removeEventListener("change", l);
};

/** A short reminder of the controls at the bottom of the screen: touch on a touch screen, mouse and keys otherwise. */
function Hints({ lang, local }: { lang: Lang; local: boolean }) {
  const g = strings[lang].guide;
  const touch = useSyncExternalStore(subscribePointer, () => window.matchMedia(COARSE).matches, () => false);
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-wrap justify-center gap-2 px-3 text-sm sm:text-base">
      {touch && !local ? (
        <>
          <Chip>
            <b>{g.kick}</b> {g.tap.toLowerCase()}
          </Chip>
          <Chip>
            <b>{g.pass}</b> {g.twoTap.toLowerCase()}
          </Chip>
        </>
      ) : local ? (
        <>
          <Chip>
            <Crest team="red" className="size-5" />
            <Key>W</Key>
            <Key>S</Key> {g.move} · <Key>D</Key> {g.kick} · <Key>A</Key> {g.pass}
          </Chip>
          <Chip>
            <Crest team="blue" className="size-5" />
            <Key>↑</Key>
            <Key>↓</Key> {g.move} · <Key>←</Key> {g.kick} · <Key>→</Key> {g.pass}
          </Chip>
        </>
      ) : (
        <>
          <Chip>
            <b>{g.kick}</b> {g.click.toLowerCase()}
          </Chip>
          <Chip>
            <b>{g.pass}</b> {g.rightTap.toLowerCase()}
          </Chip>
          <Chip>
            <Key wide>{g.space}</Key> {g.serve}
          </Chip>
        </>
      )}
    </footer>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <p className="hint-chip">{children}</p>;
}

/** The final whistle: the winner's crest, the score, and the way back in. */
export function Victory({
  lang,
  match,
  onRematch,
  onMenu,
}: {
  lang: Lang;
  match: Match;
  /** Null for the online guest, who waits for the host to call the rematch. */
  onRematch: (() => void) | null;
  onMenu: () => void;
}) {
  const t = strings[lang];
  const winner = match.last!;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/45 p-4">
      <div className="toon-panel anim-pop w-full max-w-sm overflow-hidden text-center" role="dialog" aria-label={t.won(TEAMS[winner].name)}>
        <div className={`${TEAM_BG[winner]} border-b-[3px] border-ink px-6 pt-5 pb-4`}>
          <Crest team={winner} className="mx-auto size-24" />
          <p className="toon-text mt-3 text-4xl leading-tight text-cream">{t.won(TEAMS[winner].name)}</p>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-center gap-4">
            <Crest team="red" className="size-10" title={TEAMS.red.name} />
            <p className="font-sign text-5xl tabular-nums">
              <span className="text-red">{match.score.red}</span>
              <span className="mx-2 text-ink/40">:</span>
              <span className="text-blue">{match.score.blue}</span>
            </p>
            <Crest team="blue" className="size-10" title={TEAMS.blue.name} />
          </div>
          {!onRematch && <p className="mt-4 font-semibold">{t.net.waitingRematch}</p>}
          <div className={`mt-6 grid gap-3 ${onRematch ? "grid-cols-2" : "grid-cols-1"}`}>
            {onRematch && (
              <button onClick={onRematch} className="toon-button bg-gold text-ink" autoFocus>
                {t.rematch}
              </button>
            )}
            <button onClick={onMenu} className="toon-button bg-cream text-ink">
              {t.menu}
            </button>
          </div>
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
    <div className="pointer-events-none absolute inset-x-0 top-[4.9rem] flex justify-center gap-2 sm:top-[5.6rem]">
      {live.map((p) => (
        <div
          key={p.power}
          className="anim-pop flex items-center gap-1.5 rounded-full border-[3px] border-ink px-2.5 py-0.5 text-sm font-semibold"
          style={{ background: CAP_STYLE[p.power].cap, color: p.power === "hielo" || p.power === "turbo" ? "#1b1410" : "#f6ead0", boxShadow: "3px 3px 0 #1b1410" }}
        >
          <Crest team={p.side} className="size-4" title={TEAMS[p.side].name} />
          {strings[lang].powers[p.power]}
          <span className="tabular-nums opacity-80">{Math.ceil(p.until - now)}</span>
        </div>
      ))}
    </div>
  );
}
