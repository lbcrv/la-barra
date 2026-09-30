"use client";

import { Outlines } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Object3D, type InstancedMesh } from "three";
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
  // The five beads are one instanced mesh: one draw call and one outline for the wire.
  const beads = useRef<InstancedMesh>(null);
  const xs = useRef<number[]>(Array.from({ length: TARGET }, () => outer));
  const dummy = useMemo(() => {
    const o = new Object3D();
    o.rotation.z = Math.PI / 2;
    return o;
  }, []);

  useFrame((_, dt) => {
    const m = beads.current;
    if (!m) return;
    for (let i = 0; i < TARGET; i++) {
      // Counted beads stack from the inner end; the rest wait at the outer end.
      const target = i < count ? inner + dir * (i * GAP + BEAD_R) : outer - dir * ((TARGET - 1 - i) * GAP + BEAD_R);
      xs.current[i] += (target - xs.current[i]) * Math.min(1, dt * 10);
      dummy.position.set(xs.current[i], 0, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={[0, WIRE_Y, RIM_Z]}>
      <mesh rotation-z={Math.PI / 2} position={[(inner + outer) / 2, 0, 0]}>
        <cylinderGeometry args={[0.0022, 0.0022, Math.abs(outer - inner) + 0.02, 6]} />
        <meshToonMaterial color="#c9ccd2" gradientMap={grad} />
      </mesh>
      <instancedMesh ref={beads} args={[undefined, undefined, TARGET]} castShadow frustumCulled={false}>
        <cylinderGeometry args={[BEAD_R, BEAD_R, BEAD_R * 1.7, 16]} />
        <meshToonMaterial color={TEAMS[side].color} gradientMap={grad} />
        <Outlines thickness={OUTLINE_PX} color={INK} />
      </instancedMesh>
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
