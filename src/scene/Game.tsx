"use client";

import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { TEAMS, type Side } from "@/game/teams";
import { strings, type Lang } from "@/ui/strings";
import { Ball, type BallHandle } from "./Ball";
import { CameraRig, Fill, Lamp } from "./Room";
import { Table } from "./Table";

/** Pause after a goal before the next ball rolls in, so the goal can land. */
const NEXT_BALL_MS = 1400;

export function Game() {
  const [lang, setLang] = useState<Lang>("es");
  const [score, setScore] = useState<Record<Side, number>>({ red: 0, blue: 0 });
  const [flash, setFlash] = useState<Side | null>(null);
  const ball = useRef<BallHandle>(null);
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
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        serve();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [serve]);

  return (
    <div className="relative h-dvh w-full select-none">
      <Canvas shadows="percentage" camera={{ fov: 38, near: 0.05, far: 20 }} dpr={[1, 2]} onPointerDown={serve}>
        <Fill />
        <CameraRig />
        <Lamp />
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]} timeStep={1 / 120}>
            <Table onGoal={goal} />
            <Ball ref={ball} onDead={serve} />
          </Physics>
        </Suspense>
      </Canvas>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-6">
        <div className="pointer-events-auto">
          <h1 className="font-sign text-2xl text-cream sm:text-3xl">{t.title}</h1>
        </div>
        <button onClick={() => setLang(lang === "es" ? "en" : "es")} className="pointer-events-auto text-sm tracking-widest text-cream/70 uppercase hover:text-cream">
          {t.lang}
        </button>
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

      <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm tracking-wide text-cream/60">{t.serve}</p>
    </div>
  );
}
