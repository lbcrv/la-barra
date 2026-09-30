"use client";

import { useBeforePhysicsStep } from "@react-three/rapier";
import type { RefObject } from "react";
import type { Bot } from "@/game/bot";
import type { Inputs } from "@/game/input";
import type { BallHandle } from "./Ball";

/**
 * Lets bots play: every physics step, before the rods move, each bot looks at
 * the ball and its own rods and writes its side's input. Mounted before
 * `Rods` so its step runs first.
 */
export function BotDriver({
  botsRef,
  inputsRef,
  ballRef,
  slidesRef,
}: {
  botsRef: RefObject<Bot[]>;
  inputsRef: RefObject<Inputs>;
  ballRef: RefObject<BallHandle | null>;
  slidesRef: RefObject<number[]>;
}) {
  useBeforePhysicsStep((world) => {
    if (botsRef.current.length === 0) return;
    const ball = ballRef.current?.state() ?? null;
    for (const bot of botsRef.current) {
      Object.assign(inputsRef.current[bot.team], bot.think(ball, slidesRef.current, world.timestep));
    }
  });
  return null;
}
