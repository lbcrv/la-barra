"use client";

import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import type { RefObject } from "react";
import type { SnapshotBuffer } from "@/net/protocol";
import type { BallHandle } from "./Ball";
import type { RemoteRods } from "./Rods";

/**
 * Online guest: every frame, blends the host's snapshots for this instant and
 * puts the ball and rods there. Runs before the rods' own frame update, which
 * reads `rodsRef`. Mount it inside <Physics>.
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
  }, -1);
  return null;
}

/**
 * Online guest: the physics world is paused there, and a paused world also
 * skips copying bodies onto their meshes, so nothing the host sent would show.
 * A zero-length step moves no time forward but still does that copy. Mount it
 * inside <Physics>, after the rods, so it runs once they have been placed.
 */
export function SyncMeshes() {
  const { step } = useRapier();
  useFrame(() => step(0));
  return null;
}
