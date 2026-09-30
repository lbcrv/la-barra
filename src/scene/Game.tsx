"use client";

import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Bot, type Level } from "@/game/bot";
import { idleInputs, type Inputs } from "@/game/input";
import { goal, matchPoint, newMatch, resume, type Match, type Mode } from "@/game/match";
import { Narrator, type Call } from "@/game/narrator";
import { effects, kickerOf, take, type ActivePower, type Power } from "@/game/powerups";
import { RODS } from "@/game/rods";
import { PHYSICS_HZ } from "@/game/table";
import { TEAMS, type Side } from "@/game/teams";
import { Hud, Victory } from "@/ui/Hud";
import { Menu } from "@/ui/Menu";
import { Radio } from "@/ui/Radio";
import { type Lang } from "@/ui/strings";
import { Aim } from "./Aim";
import { Backdrop } from "./Backdrop";
import { Ball, type BallHandle } from "./Ball";
import { BotDriver } from "./BotDriver";
import { Confetti } from "./Confetti";
import { PowerField } from "./PowerField";
import { CameraRig, Fill, Lamp } from "./Room";
import { Rods } from "./Rods";
import { Scoreboard } from "./Scoreboard";
import { play as sfx } from "./sound";
import { Table } from "./Table";

/** Pause after a goal before the next ball rolls in, so the goal can land. */
const NEXT_BALL_MS = 1600;
/** Pause before a match's first ball. */
const FIRST_BALL_MS = 900;

/**
 * Keys for two players sharing a keyboard. Red: W/S slide, D kicks.
 * Blue: arrow up/down slide, arrow left kicks. Up slides toward the far side.
 */
const KEYS: Record<string, { team: Side; dir?: -1 | 1; kick?: true }> = {
  KeyW: { team: "red", dir: -1 },
  KeyS: { team: "red", dir: 1 },
  KeyD: { team: "red", kick: true },
  ArrowUp: { team: "blue", dir: -1 },
  ArrowDown: { team: "blue", dir: 1 },
  ArrowLeft: { team: "blue", kick: true },
};

/** How long Don Chepe's line stays up, and the least time between two "big shot" calls. */
const LINE_MS = 3200;
const BIG_SHOT_GAP_MS = 6000;
/** A kick that adds this much speed (m/s) is a big shot. */
const BIG_SHOT = 3.2;

const now = () => performance.now() / 1000;

/** Which sides a person plays in each mode; the rest are bots. */
const HUMANS: Record<Mode | "demo", Side[]> = { demo: [], bot: ["red"], local: ["red", "blue"], online: ["red", "blue"] };

export function Game() {
  const [lang, setLang] = useState<Lang>("es");
  // Null while the menu is up and the bots play a demo behind it.
  const [match, setMatch] = useState<Match | null>(null);
  const [view, setView] = useState(0);
  // Each goal fires a confetti burst from the net it went into.
  const [burst, setBurst] = useState<{ n: number; scorer: Side | null; conceded: Side | null }>({ n: 0, scorer: null, conceded: null });
  const shake = useRef(0);
  const [powers, setPowers] = useState<ActivePower[]>([]);
  const powersRef = useRef<ActivePower[]>([]);
  const rodSpeed = useRef<Record<Side, number>>({ red: 1, blue: 1 });
  const [hot, setHot] = useState(false);
  // The side that touched the ball last, credited with any cap it rolls over.
  const lastKicker = useRef<Side | null>(null);
  const [line, setLine] = useState<{ text: string; id: number } | null>(null);
  const narrator = useRef(new Narrator());
  const langRef = useRef<Lang>("es");
  const lineTimer = useRef(0);
  const lastBigShot = useRef(0);

  const ball = useRef<BallHandle>(null);
  const inputs = useRef<Inputs>(idleInputs());
  const slides = useRef<number[]>(RODS.map(() => 0));
  const bots = useRef<Bot[]>([new Bot("red", "normal"), new Bot("blue", "normal")]);
  const matchRef = useRef<Match | null>(null);
  const timers = useRef<number[]>([]);
  // Red follows the mouse once it moves over the table, until a key takes over.
  const aiming = useRef(false);
  // One goal per ball: a ball can rattle around the pocket.
  const scored = useRef(false);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const update = useCallback((m: Match | null) => {
    matchRef.current = m;
    setMatch(m);
  }, []);

  const serve = useCallback(() => {
    if (scored.current) return;
    lastKicker.current = null;
    ball.current?.serve();
  }, []);

  /** Don Chepe says something, during matches only. */
  const say = useCallback((call: Call) => {
    if (!matchRef.current) return;
    const text = narrator.current.line(call, langRef.current, (side) => TEAMS[side].name);
    setLine((l) => ({ text, id: (l?.id ?? 0) + 1 }));
    window.clearTimeout(lineTimer.current);
    lineTimer.current = window.setTimeout(() => setLine(null), LINE_MS);
  }, []);

  const setActivePowers = useCallback((next: ActivePower[]) => {
    powersRef.current = next;
    setPowers(next);
  }, []);

  /** Clears the table and hands each side to a person or a bot for the new mode. */
  const setUp = useCallback(
    (mode: Mode | "demo", level: Level) => {
      clearTimers();
      scored.current = false;
      ball.current?.park();
      inputs.current = idleInputs();
      aiming.current = false;
      setActivePowers([]);
      lastKicker.current = null;
      window.clearTimeout(lineTimer.current);
      setLine(null);
      // Back to the playing view, wherever the demo left the camera.
      setView((v) => v + 1);
      const humans = HUMANS[mode];
      bots.current = (["red", "blue"] as const)
        .filter((s) => !humans.includes(s))
        .map((s) => new Bot(s, mode === "demo" ? "normal" : level));
      later(FIRST_BALL_MS, () => ball.current?.serve());
    },
    [clearTimers, later, setActivePowers],
  );

  const play = useCallback(
    (mode: Mode, level: Level) => {
      setUp(mode, level);
      update(newMatch(mode, level));
      sfx("whistle");
      say({ kind: "kickoff" });
    },
    [setUp, update, say],
  );

  const toMenu = useCallback(() => {
    setUp("demo", "normal");
    update(null);
  }, [setUp, update]);

  const onGoal = useCallback(
    (conceded: Side) => {
      if (scored.current) return;
      scored.current = true;
      shake.current = 1;
      setBurst((b) => ({ n: b.n + 1, scorer: conceded === "red" ? "blue" : "red", conceded }));
      const m = matchRef.current;
      const next = m ? goal(m, conceded) : null;
      if (next) {
        update(next);
        sfx("goal");
        later(350, () => sfx("bead"));
        if (next.phase === "over") {
          say({ kind: "win", winner: next.last! });
          later(900, () => sfx("whistle"));
        } else {
          say({ kind: "goal", scorer: next.last! });
        }
      }
      later(NEXT_BALL_MS, () => {
        ball.current?.park();
        scored.current = false;
        if (next?.phase === "over") return;
        if (next) {
          update(resume(next));
          const leader = (["red", "blue"] as const).find((side) => matchPoint(next, side));
          if (leader) say({ kind: "matchPoint", side: leader });
        }
        serve();
      });
    },
    [later, update, say, serve],
  );

  const onHit = useCallback(
    (strength: number, kind: "kick" | "wall", vx: number) => {
      if (kind === "wall") {
        sfx("wall", strength / 3);
        return;
      }
      const kicker = kickerOf(vx);
      lastKicker.current = kicker;
      sfx("kick", strength / 4);
      const boost = effects(powersRef.current, now()).kickBoost[kicker];
      if (boost > 1) ball.current?.boost(boost);
      if (strength > 2) shake.current = Math.max(shake.current, Math.min(0.45, strength / 10));
      if (strength > BIG_SHOT && performance.now() - lastBigShot.current > BIG_SHOT_GAP_MS) {
        lastBigShot.current = performance.now();
        say({ kind: "bigShot" });
      }
    },
    [say],
  );

  const onTake = useCallback(
    (power: Power) => {
      const side = lastKicker.current;
      if (!side) return;
      setActivePowers(take(powersRef.current, power, side, now()));
      sfx("power");
      say({ kind: "power", power, side });
    },
    [say, setActivePowers],
  );

  // Powers run on the clock: apply their effects and drop them as they wear off.
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = now();
      const e = effects(powersRef.current, t);
      rodSpeed.current = e.rodSpeed;
      ball.current?.setDamping(e.ballDamping);
      setHot(e.kickBoost.red > 1 || e.kickBoost.blue > 1);
      const live = powersRef.current.filter((p) => p.until > t);
      if (live.length !== powersRef.current.length) setActivePowers(live);
    }, 100);
    return () => window.clearInterval(id);
  }, [setActivePowers]);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  // The demo starts once the physics world is ready.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!ball.current) return;
      window.clearInterval(id);
      toMenu();
    }, 100);
    return () => {
      window.clearInterval(id);
      clearTimers();
    };
  }, [toMenu, clearTimers]);

  // Development only: lets a test script drive the table.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __barra?: unknown }).__barra = {
      place: (x: number, z: number, vx: number, vz: number) => ball.current?.place({ x, z }, { x: vx, z: vz }),
      position: () => ball.current?.position(),
      aim: (z: number) => {
        aiming.current = false;
        inputs.current.red.pointerZ = z;
      },
      play,
      match: () => matchRef.current,
    };
  }, [play]);

  useEffect(() => {
    // Keys held per side, so releasing W while S is still down keeps sliding toward S.
    const held: Record<Side, Set<-1 | 1>> = { red: new Set(), blue: new Set() };
    const slideDir = (team: Side): -1 | 0 | 1 => {
      const h = held[team];
      return h.has(-1) === h.has(1) ? 0 : h.has(-1) ? -1 : 1;
    };
    const human = (team: Side) => {
      const m = matchRef.current;
      return !!m && HUMANS[m.mode].includes(team);
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && matchRef.current?.phase === "playing") {
        e.preventDefault();
        serve();
        return;
      }
      const key = KEYS[e.code];
      if (!key || !human(key.team)) return;
      e.preventDefault();
      const input = inputs.current[key.team];
      if (key.kick) input.kick = true;
      if (key.dir) {
        held[key.team].add(key.dir);
        input.keyDir = slideDir(key.team);
        input.pointerZ = null;
        if (key.team === "red") aiming.current = false;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const key = KEYS[e.code];
      if (!key || !human(key.team)) return;
      const input = inputs.current[key.team];
      if (key.kick) input.kick = false;
      if (key.dir) {
        held[key.team].delete(key.dir);
        input.keyDir = slideDir(key.team);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 0 && human("red")) inputs.current.red.kick = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [serve]);

  const redIsHuman = !!match && HUMANS[match.mode].includes("red");
  const toggleLang = () => setLang((l) => (l === "es" ? "en" : "es"));

  return (
    <div className="relative h-dvh w-full select-none">
      <Canvas
        shadows="percentage"
        camera={{ fov: 38, near: 0.05, far: 20 }}
        dpr={[1, 2]}
        // Left button kicks; the right one belongs to the camera.
        onPointerMove={() => {
          if (redIsHuman) aiming.current = true;
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || !redIsHuman) return;
          aiming.current = true;
          inputs.current.red.kick = true;
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Fill />
        <CameraRig resetKey={view} spin={!match} shakeRef={shake} />
        <Backdrop />
        <Scoreboard score={match?.score ?? { red: 0, blue: 0 }} />
        <Confetti burst={burst.n} side={burst.scorer} goalOf={burst.conceded} />
        <PowerField running={match?.phase === "playing"} ballRef={ball} onTake={onTake} />
        <Lamp />
        <Aim aimingRef={aiming} onAim={(z) => (inputs.current.red.pointerZ = z)} />
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]} timeStep={1 / PHYSICS_HZ}>
            <Table onGoal={onGoal} />
            <Ball ref={ball} onDead={serve} onHit={onHit} hot={hot} />
            <BotDriver botsRef={bots} inputsRef={inputs} ballRef={ball} slidesRef={slides} />
            <Rods inputs={inputs} ball={ball} slidesRef={slides} speedRef={rodSpeed} />
          </Physics>
        </Suspense>
      </Canvas>

      {!match && <Menu lang={lang} onLang={toggleLang} onPlay={play} />}
      {match && (
        <Hud lang={lang} match={match} onMenu={toMenu} onCamera={() => setView((v) => v + 1)} onLang={toggleLang} powers={powers} />
      )}
      {match && <Radio lang={lang} line={line} />}
      {match?.phase === "over" && <Victory lang={lang} match={match} onRematch={() => play(match.mode, match.level)} onMenu={toMenu} />}
    </div>
  );
}
