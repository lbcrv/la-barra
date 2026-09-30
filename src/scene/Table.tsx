"use client";

import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import { BALL, CABINET, FIELD, GOAL, LID_Y, WALL } from "@/game/table";
import type { Side } from "@/game/teams";
import { fieldTexture, floorTexture, woodTexture } from "./textures";

const HL = FIELD.length / 2;
const HW = FIELD.width / 2;
const T = WALL.thickness;
const H = WALL.height;

/**
 * Wall colliders run up to the invisible lid, higher than the painted walls,
 * so a ball popped into the air can't slip out between wall and lid.
 */
const WALL_TOP = LID_Y;

/** Bounce off the walls: hard wood, a little lively. */
const WALL_PHYSICS = { restitution: 0.7, friction: 0.2 };

/**
 * The table: playing field, side walls, the two goals cut into the ends with a
 * pocket behind each, and the cabinet and legs around it. `onGoal` receives the
 * side whose goal the ball fell into.
 */
export function Table({ onGoal }: { onGoal: (conceded: Side) => void }) {
  const wood = useMemo(() => woodTexture(7), []);
  const darkWood = useMemo(() => woodTexture(11, "#4a2c18"), []);
  const field = useMemo(() => fieldTexture(), []);
  const floor = useMemo(() => floorTexture(), []);

  const side = (HW - GOAL.width / 2) / 2; // length of each end wall beside the goal mouth
  const legY = -CABINET.depth - CABINET.legHeight / 2;
  const floorY = -CABINET.depth - CABINET.legHeight;
  const outerL = FIELD.length + 2 * (T + CABINET.rim);
  const outerW = FIELD.width + 2 * (T + CABINET.rim);

  return (
    <group>
      {/* Playing surface. */}
      <RigidBody type="fixed" colliders={false} userData={{ name: "field" }}>
        <CuboidCollider args={[HL, 0.02, HW]} position={[0, -0.02, 0]} friction={0.4} restitution={0.25} />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[FIELD.length, FIELD.width]} />
          <meshStandardMaterial map={field} roughness={0.75} />
        </mesh>
      </RigidBody>

      {/* Invisible lid over the whole table, above the players' heads. */}
      <RigidBody type="fixed" colliders={false} userData={{ name: "lid" }}>
        <CuboidCollider args={[HL + T + GOAL.depth, 0.01, HW + T]} position={[0, LID_Y + 0.01, 0]} restitution={0.3} />
      </RigidBody>

      {/* Long side walls. */}
      <RigidBody type="fixed" colliders={false} userData={{ name: "side-walls" }}>
        {[-1, 1].map((s) => (
          <group key={s}>
            <CuboidCollider args={[HL + T, WALL_TOP / 2, T / 2]} position={[0, WALL_TOP / 2, s * (HW + T / 2)]} {...WALL_PHYSICS} />
            <mesh position={[0, H / 2, s * (HW + T / 2)]} castShadow receiveShadow>
              <boxGeometry args={[FIELD.length + 2 * T, H, T]} />
              <meshStandardMaterial map={wood} roughness={0.55} />
            </mesh>
          </group>
        ))}
      </RigidBody>

      {/* End walls, with the goal mouth left open and a crossbar above it. */}
      {(["red", "blue"] as const).map((team) => {
        const dir = team === "red" ? -1 : 1;
        const x = dir * (HL + T / 2);
        return (
          <group key={team}>
            <RigidBody type="fixed" colliders={false} userData={{ name: `end-wall-${team}` }}>
              {[-1, 1].map((s) => (
                <group key={s}>
                  <CuboidCollider args={[T / 2, WALL_TOP / 2, side / 2]} position={[x, WALL_TOP / 2, s * (GOAL.width / 2 + side / 2)]} {...WALL_PHYSICS} />
                  <mesh position={[x, H / 2, s * (GOAL.width / 2 + side / 2)]} castShadow receiveShadow>
                    <boxGeometry args={[T, H, side]} />
                    <meshStandardMaterial map={wood} roughness={0.55} />
                  </mesh>
                </group>
              ))}
              <CuboidCollider
                args={[T / 2, (WALL_TOP - GOAL.height) / 2, GOAL.width / 2]}
                position={[x, GOAL.height + (WALL_TOP - GOAL.height) / 2, 0]}
                {...WALL_PHYSICS}
              />
              <mesh position={[x, GOAL.height + (H - GOAL.height) / 2, 0]} castShadow>
                <boxGeometry args={[T, H - GOAL.height, GOAL.width]} />
                <meshStandardMaterial map={wood} roughness={0.55} />
              </mesh>
            </RigidBody>
            <GoalPocket dir={dir} onScore={() => onGoal(team)} />
          </group>
        );
      })}

      {/* Cabinet: the wooden box the field sits in, open at the top. */}
      <group>
        {[-1, 1].map((s) => (
          <mesh key={`long${s}`} position={[0, (H - CABINET.depth) / 2, s * (outerW / 2 - CABINET.rim / 2)]} castShadow receiveShadow>
            <boxGeometry args={[outerL, H + CABINET.depth, CABINET.rim]} />
            <meshStandardMaterial map={darkWood} roughness={0.5} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`end${s}`} position={[s * (outerL / 2 - CABINET.rim / 2), (H - CABINET.depth) / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[CABINET.rim, H + CABINET.depth, outerW - 2 * CABINET.rim]} />
            <meshStandardMaterial map={darkWood} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, -CABINET.depth + 0.01, 0]} receiveShadow>
          <boxGeometry args={[outerL, 0.02, outerW]} />
          <meshStandardMaterial map={darkWood} roughness={0.6} />
        </mesh>
        {/* Legs. */}
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh
              key={`${sx}${sz}`}
              position={[sx * (outerL / 2 - CABINET.legSize), legY, sz * (outerW / 2 - CABINET.legSize)]}
              castShadow
            >
              <boxGeometry args={[CABINET.legSize, CABINET.legHeight, CABINET.legSize]} />
              <meshStandardMaterial map={darkWood} roughness={0.55} />
            </mesh>
          )),
        )}
      </group>

      {/* The shop floor. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, floorY, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial map={floor} roughness={0.95} />
      </mesh>
    </group>
  );
}

/**
 * The box behind a goal mouth. It starts right at the edge of the field, so
 * there is no gap under the end wall for a slow ball to fall through. Its floor
 * sits below the field so a ball that goes in stays in, and a sensor inside
 * reports the goal.
 */
function GoalPocket({ dir, onScore }: { dir: -1 | 1; onScore: () => void }) {
  const depth = T + GOAL.depth; // under the end wall, then the pocket proper
  const cx = dir * (HL + depth / 2);
  const back = dir * (HL + depth);
  const floorY = -0.03;
  return (
    <RigidBody type="fixed" colliders={false} userData={{ name: `pocket${dir}` }}>
      {/* Floor, back and sides of the pocket. */}
      <CuboidCollider args={[depth / 2, 0.01, GOAL.width / 2 + T]} position={[cx, floorY - 0.01, 0]} restitution={0.1} friction={0.8} />
      <CuboidCollider args={[0.01, H / 2 + 0.03, GOAL.width / 2 + T]} position={[back + dir * 0.01, H / 2 - 0.03, 0]} restitution={0.1} />
      {[-1, 1].map((s) => (
        <CuboidCollider key={s} args={[depth / 2, H / 2 + 0.03, 0.01]} position={[cx, H / 2 - 0.03, s * (GOAL.width / 2 + 0.01)]} />
      ))}
      <CuboidCollider args={[GOAL.depth / 2, 0.01, GOAL.width / 2]} position={[dir * (HL + T + GOAL.depth / 2), GOAL.height + 0.01, 0]} />
      {/*
        The goal sensor fills the pocket from its floor to the crossbar, starting
        one ball radius past the line: it trips as soon as the ball's centre
        crosses the goal line, rolling or in the air, before it can bounce back out.
      */}
      <CuboidCollider
        sensor
        args={[depth / 2 - BALL.radius / 2, (GOAL.height - floorY) / 2, GOAL.width / 2]}
        position={[cx + (dir * BALL.radius) / 2, (GOAL.height + floorY) / 2, 0]}
        onIntersectionEnter={onScore}
      />
      {/* The dark inside of the pocket, seen through the goal mouth. */}
      <mesh position={[dir * (HL + T + GOAL.depth / 2), GOAL.height / 2 - 0.015, 0]}>
        <boxGeometry args={[GOAL.depth, GOAL.height + 0.03, GOAL.width]} />
        <meshStandardMaterial color="#0d0a08" roughness={1} />
      </mesh>
    </RigidBody>
  );
}
