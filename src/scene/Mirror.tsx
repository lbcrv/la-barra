"use client";

import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import type { SnapshotBuffer } from "@/net/protocol";
import type { BallHandle } from "./Ball";
import type { RemoteRods } from "./Rods";

/**
 * Online guest: every frame, blends the host's snapshots for this instant and
 * puts the ball and rods there. Rods read `rodsRef` on their own.
 */
export function Mirror({
  bufferRef,
  ballRef,
  rodsRef,
}: {
  bufferRef: RefObject<SnapshotBuffer>;
  ballRef: RefObject<BallHandle | null>;
  rodsRef: RefObject<RemoteRods | null>;
}) {
  useFrame(() => {
    const s = bufferRef.current.sample(performance.now());
    if (!s) return;
    ballRef.current?.mirror(s.ball);
    const rods = rodsRef.current;
    if (!rods) return;
    rods.slides = s.slides;
    rods.angles = s.angles;
    rods.active = { red: s.active[0], blue: s.active[1] };
  });
  return null;
}
