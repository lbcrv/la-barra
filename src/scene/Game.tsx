"use client";

import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Bot, type Level } from "@/game/bot";
import { idleInputs, type Inputs } from "@/game/input";
import { goal, newMatch, resume, type Match, type Mode } from "@/game/match";
import { RODS } from "@/game/rods";
import { PHYSICS_HZ } from "@/game/table";
import type { Side } from "@/game/teams";
import { Hud, Victory } from "@/ui/Hud";
import { Menu } from "@/ui/Menu";
import { type Lang } from "@/ui/strings";
import { Aim } from "./Aim";
import { Backdrop } from "./Backdrop";
import { Ball, type BallHandle } from "./Ball";
import { BotDriver } from "./BotDriver";
import { Confetti } from "./Confetti";
import { CameraRig, Fill, Lamp } from "./Room";
import { Rods } from "./Rods";
import { Scoreboard } from "./Scoreboard";
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
    ball.current?.serve();
  }, []);

  /** Clears the table and hands each side to a person or a bot for the new mode. */
  const setUp = useCallback(
    (mode: Mode | "demo", level: Level) => {
      clearTimers();
      scored.current = false;
      ball.current?.park();
      inputs.current = idleInputs();
      aiming.current = false;
      // Back to the playing view, wherever the demo left the camera.
      setView((v) => v + 1);
      const humans = HUMANS[mode];
      bots.current = (["red", "blue"] as const)
        .filter((s) => !humans.includes(s))
        .map((s) => new Bot(s, mode === "demo" ? "normal" : level));
      later(FIRST_BALL_MS, () => ball.current?.serve());
    },
    [clearTimers, later],
  );

  const play = useCallback(
    (mode: Mode, level: Level) => {
      setUp(mode, level);
      update(newMatch(mode, level));
    },
    [setUp, update],
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
      if (next) update(next);
      later(NEXT_BALL_MS, () => {
        ball.current?.park();
        scored.current = false;
        if (next?.phase === "over") return;
        if (next) update(resume(next));
        ball.current?.serve();
      });
    },
    [later, update],
  );

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
        <Lamp />
        <Aim aimingRef={aiming} onAim={(z) => (inputs.current.red.pointerZ = z)} />
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]} timeStep={1 / PHYSICS_HZ}>
            <Table onGoal={onGoal} />
            <Ball
              ref={ball}
              onDead={serve}
              onHit={(strength, kind) => {
                if (kind === "kick" && strength > 2) shake.current = Math.max(shake.current, Math.min(0.45, strength / 10));
              }}
            />
            <BotDriver botsRef={bots} inputsRef={inputs} ballRef={ball} slidesRef={slides} />
            <Rods inputs={inputs} ball={ball} slidesRef={slides} />
          </Physics>
        </Suspense>
      </Canvas>

      {!match && <Menu lang={lang} onLang={toggleLang} onPlay={play} />}
      {match && <Hud lang={lang} match={match} onMenu={toMenu} onCamera={() => setView((v) => v + 1)} onLang={toggleLang} />}
      {match?.phase === "over" && <Victory lang={lang} match={match} onRematch={() => play(match.mode, match.level)} onMenu={toMenu} />}
    </div>
  );
}
