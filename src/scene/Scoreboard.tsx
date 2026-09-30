"use client";

import { Outlines } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";
import { TARGET } from "@/game/match";
import { CABINET, FIELD, WALL } from "@/game/table";
import { TEAMS, type Side } from "@/game/teams";
import { INK, OUTLINE_PX, toonGradient } from "./toon";

/** The counter sits on the far rim of the cabinet, a wire for each side. */
const RIM_Z = -(FIELD.width / 2 + WALL.thickness + CABINET.rim / 2);
const WIRE_Y = WALL.height + 0.035;
const BEAD_R = 0.016;
const GAP = BEAD_R * 2.25;
/** How far a bead slides when it is counted. */
const SLIDE = 0.12;

/**
 * Abacus beads, like real tables keep score: five per side. Beads wait at the
 * outer end of the wire and slide toward the middle as goals go in.
 */
export function Scoreboard({ score }: { score: Record<Side, number> }) {
  return (
    <group>
      {(["red", "blue"] as const).map((side) => (
        <Wire key={side} side={side} count={score[side]} />
      ))}
    </group>
  );
}

function Wire({ side, count }: { side: Side; count: number }) {
  const grad = toonGradient();
  const dir = side === "red" ? -1 : 1;
  // The wire runs from near the middle out toward the side's end.
  const inner = dir * 0.08;
  const outer = dir * (0.08 + SLIDE + TARGET * GAP + 0.03);
  const beads = useRef<(Mesh | null)[]>([]);

  useFrame((_, dt) => {
    beads.current.forEach((b, i) => {
      if (!b) return;
      // Counted beads stack from the inner end; the rest wait at the outer end.
      const counted = i < count;
      const target = counted ? inner + dir * (i * GAP + BEAD_R) : outer - dir * ((TARGET - 1 - i) * GAP + BEAD_R);
      b.position.x += (target - b.position.x) * Math.min(1, dt * 10);
    });
  });

  return (
    <group position={[0, WIRE_Y, RIM_Z]}>
      <mesh rotation-z={Math.PI / 2} position={[(inner + outer) / 2, 0, 0]}>
        <cylinderGeometry args={[0.0022, 0.0022, Math.abs(outer - inner) + 0.02, 6]} />
        <meshToonMaterial color="#c9ccd2" gradientMap={grad} />
      </mesh>
      {Array.from({ length: TARGET }, (_, i) => (
        <mesh key={i} ref={(m) => (beads.current[i] = m)} position={[outer, 0, 0]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[BEAD_R, BEAD_R, BEAD_R * 1.7, 16]} />
          <meshToonMaterial color={TEAMS[side].color} gradientMap={grad} />
          <Outlines thickness={OUTLINE_PX} color={INK} />
        </mesh>
      ))}
      {/* Posts holding the wire at both ends. */}
      {[inner, outer].map((x) => (
        <mesh key={x} position={[x + dir * (x === inner ? -0.01 : 0.01), -0.02, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.04, 8]} />
          <meshToonMaterial color="#6b4226" gradientMap={grad} />
        </mesh>
      ))}
    </group>
  );
}
