"use client";

import { Outlines } from "@react-three/drei";
import { forwardRef, useMemo } from "react";
import type { Group } from "three";
import { MAN } from "@/game/rods";
import { INK, OUTLINE_PX, seeded, toonGradient } from "./toon";

const SKIN = ["#f0c090", "#d9a06c", "#b77b4b", "#8d5a34", "#6b4226"];
const HAIR = ["#1b1410", "#2c1d14", "#4a2e1c", "#8a8a88"];
type Hair = "short" | "bald" | "afro" | "spiky" | "cap";
const STYLES: Hair[] = ["short", "short", "afro", "spiky", "bald", "cap"];

export interface Look {
  skin: string;
  hair: string;
  style: Hair;
  mustache: boolean;
}

/** A player's look, picked once from a seed so the team is a crowd, not clones. */
export function lookFor(seed: number): Look {
  const r = seeded(seed * 7919 + 13);
  return {
    skin: SKIN[Math.floor(r() * SKIN.length)],
    hair: HAIR[Math.floor(r() * HAIR.length)],
    style: STYLES[Math.floor(r() * STYLES.length)],
    mustache: r() < 0.3,
  };
}

/** A toon material part with its ink outline. */
function Part({
  children,
  color,
  position,
  rotation,
  scale,
  outline = true,
}: {
  children: React.ReactNode;
  color: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  outline?: boolean;
}) {
  const grad = toonGradient();
  return (
    <mesh position={position} rotation={rotation} scale={scale} castShadow>
      {children}
      <meshToonMaterial color={color} gradientMap={grad} />
      {outline && <Outlines thickness={OUTLINE_PX} color={INK} />}
    </mesh>
  );
}

/**
 * One cartoon player, in rod coordinates: the rod runs through the chest, the
 * big head above it, legs and boots hanging to just above the field. Facing
 * +x for red, -x for blue. The look is exaggerated; the colliders are not.
 */
export const Figure = forwardRef<Group, { z: number; jersey: string; shorts: string; facing: 1 | -1; look: Look }>(function Figure(
  { z, jersey, shorts, facing, look },
  ref,
) {
  const legTop = -0.024;
  const bootY = -MAN.reach + MAN.footHeight / 2;
  const legLength = bootY - legTop;
  const f = facing;
  const headY = 0.044;
  const headR = 0.018;

  const hair = useMemo(() => {
    switch (look.style) {
      case "bald":
        return null;
      case "afro":
        return (
          <Part color={look.hair} position={[-f * 0.002, headY + 0.008, 0]} scale={[1, 0.85, 1]}>
            <sphereGeometry args={[headR * 1.18, 18, 12]} />
          </Part>
        );
      case "spiky":
        return (
          <group position={[0, headY + headR * 0.75, 0]}>
            {[-0.008, 0, 0.008].map((dz, i) => (
              <Part key={i} color={look.hair} position={[-f * 0.003, 0.004, dz]} rotation={[dz * 30, 0, f * 0.3]}>
                <coneGeometry args={[0.006, 0.014, 6]} />
              </Part>
            ))}
          </group>
        );
      case "cap":
        return (
          <group position={[0, headY + headR * 0.55, 0]}>
            <Part color={jersey} scale={[1, 0.6, 1]}>
              <sphereGeometry args={[headR * 1.04, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </Part>
            <Part color={jersey} position={[f * headR * 0.9, 0.001, 0]} scale={[1, 0.18, 1]}>
              <cylinderGeometry args={[0.011, 0.011, 0.01, 16, 1, false, 0, Math.PI]} />
            </Part>
          </group>
        );
      default:
        return (
          <Part color={look.hair} position={[-f * 0.002, headY + 0.004, 0]} scale={[1, 0.8, 1]} outline={false}>
            <sphereGeometry args={[headR * 1.04, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </Part>
        );
    }
  }, [look.style, look.hair, jersey, f]);

  return (
    <group ref={ref} position={[0, 0, z]}>
      {/* Jersey: a chunky barrel from the waist up past the rod. */}
      <Part color={jersey} position={[0, 0.004, 0]}>
        <capsuleGeometry args={[0.0145, 0.018, 6, 14]} />
      </Part>
      {/* Arms hanging at the sides, hands out of the sleeves. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0.002, s * 0.019]}>
          <Part color={jersey}>
            <capsuleGeometry args={[0.0055, 0.014, 4, 8]} />
          </Part>
          <Part color={look.skin} position={[f * 0.002, -0.014, 0]}>
            <sphereGeometry args={[0.0055, 10, 8]} />
          </Part>
        </group>
      ))}

      {/* Big head, eyes looking at the opponent's goal. */}
      <Part color={look.skin} position={[0, headY, 0]}>
        <sphereGeometry args={[headR, 22, 16]} />
      </Part>
      {[-1, 1].map((s) => (
        <group key={s} position={[f * headR * 0.82, headY + 0.003, s * 0.0065]}>
          <mesh>
            <sphereGeometry args={[0.0048, 12, 10]} />
            <meshBasicMaterial color="#fffaf0" />
          </mesh>
          <mesh position={[f * 0.0032, 0, 0]}>
            <sphereGeometry args={[0.0024, 10, 8]} />
            <meshBasicMaterial color={INK} />
          </mesh>
          {/* Eyebrows set low: they mean business. */}
          <mesh position={[f * 0.001, 0.0062, 0]} rotation={[s * f * 0.35, 0, 0]}>
            <boxGeometry args={[0.002, 0.0016, 0.0075]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        </group>
      ))}
      {look.mustache && (
        <mesh position={[f * headR * 0.92, headY - 0.006, 0]}>
          <boxGeometry args={[0.003, 0.003, 0.012]} />
          <meshBasicMaterial color={look.hair} />
        </mesh>
      )}
      {hair}

      {/* Shorts, legs and boots. */}
      <Part color={shorts} position={[0, -0.02, 0]}>
        <boxGeometry args={[MAN.thick + 0.004, 0.014, MAN.width + 0.004]} />
      </Part>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Part color={look.skin} position={[0, legTop + legLength / 2, s * 0.0065]}>
            <capsuleGeometry args={[0.0045, Math.max(0.001, legLength - 0.009), 4, 8]} />
          </Part>
          <Part color={jersey} position={[0, bootY + MAN.footHeight / 2 + 0.002, s * 0.0065]} outline={false}>
            <cylinderGeometry args={[0.0052, 0.0052, 0.008, 10]} />
          </Part>
        </group>
      ))}
      <Part color="#4a2c19" position={[f * 0.004, bootY, 0]}>
        <boxGeometry args={[MAN.thick + 0.008, MAN.footHeight, MAN.footWidth]} />
      </Part>
    </group>
  );
});
