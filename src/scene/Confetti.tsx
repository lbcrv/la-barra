"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, Object3D, type InstancedMesh } from "three";
import { FIELD, GOAL } from "@/game/table";
import { TEAMS, type Side } from "@/game/teams";
import { seeded } from "./toon";

const COUNT = 90;
const LIFE = 1.8;
const GRAVITY = -2.2;

interface Bit {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  age: number;
}

/**
 * Paper confetti bursting out of the goal that was scored in, in the scoring
 * side's colours. `burst` changing (with `side`) fires a new burst.
 */
export function Confetti({ burst, side, goalOf }: { burst: number; side: Side | null; goalOf: Side | null }) {
  const mesh = useRef<InstancedMesh>(null);
  const bits = useRef<Bit[]>([]);
  const dummy = useMemo(() => new Object3D(), []);

  useEffect(() => {
    if (!burst || !side || !goalOf || !mesh.current) return;
    const r = seeded(burst * 31 + 7);
    const x = TEAMS[goalOf].goalX * (FIELD.length / 2);
    const palette = [TEAMS[side].color, "#f6ead0", "#f2b632"].map((c) => new Color(c));
    bits.current = Array.from({ length: COUNT }, (_, i) => {
      mesh.current!.setColorAt(i, palette[i % palette.length]);
      return {
        x,
        y: GOAL.height,
        z: (r() - 0.5) * GOAL.width,
        // Out of the goal mouth, back over the field, and up.
        vx: -TEAMS[goalOf].goalX * (0.3 + r() * 0.7),
        vy: 0.9 + r() * 1.2,
        vz: (r() - 0.5) * 1.2,
        spin: (r() - 0.5) * 20,
        age: 0,
      };
    });
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [burst, side, goalOf]);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const d = Math.min(dt, 1 / 30);
    let alive = 0;
    bits.current.forEach((b, i) => {
      b.age += d;
      b.vy += GRAVITY * d;
      b.vx *= 0.985;
      b.vz *= 0.985;
      b.x += b.vx * d;
      b.y = Math.max(0.002, b.y + b.vy * d);
      b.z += b.vz * d;
      const live = b.age < LIFE;
      if (live) alive++;
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(b.age * b.spin, b.age * b.spin * 0.7, 0);
      dummy.scale.setScalar(live ? 1 - (b.age / LIFE) ** 3 : 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.count = bits.current.length;
    m.visible = alive > 0;
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} visible={false} frustumCulled={false}>
      <planeGeometry args={[0.012, 0.018]} />
      <meshBasicMaterial side={2} toneMapped={false} />
    </instancedMesh>
  );
}
