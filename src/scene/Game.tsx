"use client";

import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { idleInputs, type Inputs } from "@/game/input";
import { PHYSICS_HZ } from "@/game/table";
import { TEAMS, type Side } from "@/game/teams";
import { strings, type Lang } from "@/ui/strings";
import { Aim } from "./Aim";
import { Ball, type BallHandle } from "./Ball";
import { CameraRig, Fill, Lamp } from "./Room";
import { Rods } from "./Rods";
import { Table } from "./Table";

/** Pause after a goal before the next ball rolls in, so the goal can land. */
const NEXT_BALL_MS = 1400;
/** Pause before the first ball, so the table is on screen before play starts. */
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

export function Game() {
  const [lang, setLang] = useState<Lang>("es");
  const [score, setScore] = useState<Record<Side, number>>({ red: 0, blue: 0 });
  const [flash, setFlash] = useState<Side | null>(null);
  const [view, setView] = useState(0);
  const ball = useRef<BallHandle>(null);
  const inputs = useRef<Inputs>(idleInputs());
  // Red follows the mouse once it moves over the table, until a key takes over.
  const aiming = useRef(false);
  // A ball can rattle around the pocket; one goal per ball.
  const scored = useRef(false);
  const t = strings[lang];

  const serve = useCallback(() => {
    if (scored.current) return;
    ball.current?.serve();
  }, []);

  const goal = useCallback((conceded: Side) => {
    if (scored.current) return;
    scored.current = true;
    const scorer: Side = conceded === "red" ? "blue" : "red";
    setScore((s) => ({ ...s, [scorer]: s[scorer] + 1 }));
    setFlash(scorer);
    window.setTimeout(() => {
      ball.current?.park();
      setFlash(null);
      scored.current = false;
      ball.current?.serve();
    }, NEXT_BALL_MS);
  }, []);

  // Development only: lets a test script roll the ball anywhere, e.g. straight into a goal.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __barra?: unknown }).__barra = {
      place: (x: number, z: number, vx: number, vz: number) => ball.current?.place({ x, z }, { x: vx, z: vz }),
      position: () => ball.current?.position(),
      aim: (z: number) => {
        aiming.current = false;
        inputs.current.red.pointerZ = z;
      },
    };
  }, []);

  // The first ball rolls in by itself once the physics world is ready.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!ball.current) return;
      window.clearInterval(id);
      window.setTimeout(serve, FIRST_BALL_MS);
    }, 100);
    return () => window.clearInterval(id);
  }, [serve]);

  useEffect(() => {
    // Keys held per side, so releasing W while S is still down keeps sliding toward S.
    const held: Record<Side, Set<-1 | 1>> = { red: new Set(), blue: new Set() };
    const slideDir = (team: Side): -1 | 0 | 1 => {
      const h = held[team];
      return h.has(-1) === h.has(1) ? 0 : h.has(-1) ? -1 : 1;
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        serve();
        return;
      }
      const key = KEYS[e.code];
      if (!key) return;
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
      if (!key) return;
      const input = inputs.current[key.team];
      if (key.kick) input.kick = false;
      if (key.dir) {
        held[key.team].delete(key.dir);
        input.keyDir = slideDir(key.team);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 0) inputs.current.red.kick = false;
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

  return (
    <div className="relative h-dvh w-full select-none">
      <Canvas
        shadows="percentage"
        camera={{ fov: 38, near: 0.05, far: 20 }}
        dpr={[1, 2]}
        // Left button kicks; the right one belongs to the camera.
        onPointerMove={() => (aiming.current = true)}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          aiming.current = true;
          inputs.current.red.kick = true;
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Fill />
        <CameraRig resetKey={view} />
        <Lamp />
        <Aim aimingRef={aiming} onAim={(z) => (inputs.current.red.pointerZ = z)} />
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]} timeStep={1 / PHYSICS_HZ}>
            <Table onGoal={goal} />
            <Ball ref={ball} onDead={serve} />
            <Rods inputs={inputs} ball={ball} />
          </Physics>
        </Suspense>
      </Canvas>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-6">
        <div className="pointer-events-auto">
          <h1 className="font-sign text-2xl text-cream sm:text-3xl">{t.title}</h1>
        </div>
        <div className="pointer-events-auto flex gap-5">
          <button onClick={() => setView((v) => v + 1)} className="text-sm tracking-widest text-cream/70 uppercase hover:text-cream">
            {t.resetView}
          </button>
          <button onClick={() => setLang(lang === "es" ? "en" : "es")} className="text-sm tracking-widest text-cream/70 uppercase hover:text-cream">
            {t.lang}
          </button>
        </div>
      </header>

      {/* Placeholder scoreboard; the bead counter on the table replaces it later. */}
      <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center sm:top-6">
        <div className="flex items-center gap-4 rounded bg-black/40 px-4 py-1.5 text-cream">
          <span style={{ color: TEAMS.red.color }} className="font-semibold brightness-150">
            {TEAMS.red.name}
          </span>
          <span className="font-sign text-2xl tabular-nums">
            {score.red} : {score.blue}
          </span>
          <span style={{ color: TEAMS.blue.color }} className="font-semibold brightness-150">
            {TEAMS.blue.name}
          </span>
        </div>
      </div>

      {flash && (
        <p className="font-sign pointer-events-none absolute inset-x-0 top-1/3 text-center text-6xl" style={{ color: TEAMS[flash].color }}>
          {t.goal}
        </p>
      )}

      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-sm tracking-wide text-cream/60">
        {t.controls} · {t.camera}
      </p>
    </div>
  );
}
