"use client";

import { Outlines } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import { BackSide, DoubleSide, PlaneGeometry } from "three";
import { BALL, CABINET, FIELD, GOAL, LID_Y, WALL } from "@/game/table";
import type { Side } from "@/game/teams";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fieldTexture, floorTexture, NET_CELL, netTexture, woodBox, woodTexture } from "./textures";
import { INK, OUTLINE_PX, toonGradient } from "./toon";

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
 * side whose goal the ball fell into. `goals` counts goals scored so far and
 * `goalOf` names the side that let in the last one, so its net can billow.
 */
export const Table = memo(function Table({
  onGoal,
  goals = 0,
  goalOf = null,
}: {
  onGoal: (conceded: Side) => void;
  goals?: number;
  goalOf?: Side | null;
}) {
  const wood = useMemo(() => woodTexture(7), []);
  const darkWood = useMemo(() => woodTexture(11, "#4a2c18"), []);
  const field = useMemo(() => fieldTexture(), []);
  const floor = useMemo(() => floorTexture(), []);
  const grad = toonGradient();

  const side = HW - GOAL.width / 2; // length of each end wall beside the goal mouth, out to the corner
  const legY = -CABINET.depth - CABINET.legHeight / 2;
  const floorY = -CABINET.depth - CABINET.legHeight;
  const outerL = FIELD.length + 2 * (T + CABINET.rim);
  const outerW = FIELD.width + 2 * (T + CABINET.rim);

  const pieces = useMemo(() => {
    type Box = [size: [number, number, number], at: [number, number, number]];
    const light: Box[] = [];
    const dark: Box[] = [];
    for (const s of [-1, 1]) light.push([[FIELD.length + 2 * T, H, T], [0, H / 2, s * (HW + T / 2)]]);
    for (const dir of [-1, 1]) {
      const x = dir * (HL + T / 2);
      for (const s of [-1, 1]) light.push([[T, H, side], [x, H / 2, s * (GOAL.width / 2 + side / 2)]]);
      light.push([[T, H - GOAL.height, GOAL.width], [x, GOAL.height + (H - GOAL.height) / 2, 0]]);
    }
    for (const s of [-1, 1]) {
      dark.push([[outerL, H + CABINET.depth, CABINET.rim], [0, (H - CABINET.depth) / 2, s * (outerW / 2 - CABINET.rim / 2)]]);
      // The end rim, built around the goal pocket so its net shows from above:
      // a block each side of it, one below it, and a lip of wood behind it.
      const endX = s * (outerL / 2 - CABINET.rim / 2);
      const beside = outerW / 2 - CABINET.rim - GOAL.width / 2;
      for (const sz of [-1, 1]) {
        dark.push([[CABINET.rim, H + CABINET.depth, beside], [endX, (H - CABINET.depth) / 2, sz * (GOAL.width / 2 + beside / 2)]]);
      }
      dark.push([[CABINET.rim, GOAL.floor + CABINET.depth, GOAL.width], [endX, (GOAL.floor - CABINET.depth) / 2, 0]]);
      const lip = outerL / 2 - (HL + T + GOAL.depth);
      dark.push([[lip, H - GOAL.floor, GOAL.width], [s * (outerL / 2 - lip / 2), (H + GOAL.floor) / 2, 0]]);
    }
    dark.push([[outerL, 0.02, outerW], [0, -CABINET.depth + 0.01, 0]]);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        dark.push([[CABINET.legSize, CABINET.legHeight, CABINET.legSize], [sx * (outerL / 2 - CABINET.legSize), legY, sz * (outerW / 2 - CABINET.legSize)]]);
      }
    }
    const build = (boxes: Box[]) => {
      const geos = boxes.map(([size, at]) => woodBox(...size).translate(...at));
      const merged = mergeGeometries(geos, false)!;
      geos.forEach((g) => g.dispose());
      return merged;
    };
    return { light: build(light), dark: build(dark) };
  }, [side, legY, outerL, outerW]);
  useEffect(
    () => () => {
      pieces.light.dispose();
      pieces.dark.dispose();
    },
    [pieces],
  );

  return (
    <group>
      {/* Playing surface. */}
      <RigidBody type="fixed" colliders={false} userData={{ name: "field" }}>
        <CuboidCollider args={[HL, 0.02, HW]} position={[0, -0.02, 0]} friction={0.4} restitution={0.25} />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[FIELD.length, FIELD.width]} />
          <meshToonMaterial map={field} gradientMap={grad} />
        </mesh>
      </RigidBody>

      {/* Invisible lid over the whole table, above the players' heads. */}
      <RigidBody type="fixed" colliders={false} userData={{ name: "lid" }}>
        <CuboidCollider args={[HL + T + GOAL.depth, 0.01, HW + T]} position={[0, LID_Y + 0.01, 0]} restitution={0.3} />
      </RigidBody>

      {/* Long side walls: colliders reach up to the lid. */}
      <RigidBody type="fixed" colliders={false} userData={{ name: "side-walls" }}>
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[HL + T, WALL_TOP / 2, T / 2]} position={[0, WALL_TOP / 2, s * (HW + T / 2)]} {...WALL_PHYSICS} />
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
                <CuboidCollider key={s} args={[T / 2, WALL_TOP / 2, side / 2]} position={[x, WALL_TOP / 2, s * (GOAL.width / 2 + side / 2)]} {...WALL_PHYSICS} />
              ))}
              <CuboidCollider
                args={[T / 2, (WALL_TOP - GOAL.height) / 2, GOAL.width / 2]}
                position={[x, GOAL.height + (WALL_TOP - GOAL.height) / 2, 0]}
                {...WALL_PHYSICS}
              />
            </RigidBody>
            <GoalPocket dir={dir} onScore={() => onGoal(team)} hit={goalOf === team ? goals : 0} />
          </group>
        );
      })}

      {/*
        All the wood, drawn as two meshes: the light playing walls and the dark
        cabinet with its legs. One draw call and one outline each, instead of
        twenty-odd boxes with an outline each.
      */}
      <mesh geometry={pieces.light} castShadow receiveShadow>
        <meshToonMaterial map={wood} gradientMap={grad} />
        <Outlines thickness={OUTLINE_PX} color={INK} />
      </mesh>
      <mesh geometry={pieces.dark} castShadow receiveShadow>
        <meshToonMaterial map={darkWood} gradientMap={grad} />
        <Outlines thickness={OUTLINE_PX * 1.3} color={INK} />
      </mesh>

      {/* The shop floor. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, floorY, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshToonMaterial map={floor} gradientMap={grad} />
      </mesh>
    </group>
  );
});

/**
 * The box behind a goal mouth. It starts right at the edge of the field, so
 * there is no gap under the end wall for a slow ball to fall through. Its floor
 * sits below the field so a ball that goes in stays in, and a sensor inside
 * reports the goal.
 */
function GoalPocket({ dir, onScore, hit }: { dir: -1 | 1; onScore: () => void; hit: number }) {
  const depth = T + GOAL.depth; // under the end wall, then the pocket proper
  const cx = dir * (HL + depth / 2);
  const back = dir * (HL + depth);
  const floorY = GOAL.floor;
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
      {/*
        The dark inside of the pocket, seen through the goal mouth: only its
        inner faces are drawn, so the net and the ball show inside it. It runs
        from the edge of the field, so nothing shows under the end wall.
      */}
      <mesh position={[cx, (GOAL.height + floorY) / 2, 0]}>
        <boxGeometry args={[depth, GOAL.height - floorY, GOAL.width - 0.001]} />
        <meshBasicMaterial color="#0d0a08" side={BackSide} />
      </mesh>
      <GoalNet dir={dir} floorY={floorY} hit={hit} />
    </RigidBody>
  );
}

/** How far the back of the net billows out when a goal goes in (m), and how fast it settles (1/s). */
const BILLOW = { depth: 0.008, decay: 4, wobble: 18 };

/** A net panel whose UVs count mesh squares, so the cord is the same size on every panel. */
function netPanel(w: number, h: number, segments = 1) {
  const g = new PlaneGeometry(w, h, segments, segments);
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / NET_CELL, (uv.getY(i) * h) / NET_CELL);
  return g;
}

/**
 * The net lining a goal pocket: roof, sides and back, just inside its walls.
 * The back billows out when the ball goes in and wobbles back into place.
 */
function GoalNet({ dir, floorY, hit }: { dir: -1 | 1; floorY: number; hit: number }) {
  const tex = useMemo(() => netTexture(), []);
  const inset = 0.002;
  const front = HL + T; // the back face of the end wall, where the net hangs from
  const height = GOAL.height - floorY;
  const midY = (GOAL.height + floorY) / 2;
  const midX = dir * (front + GOAL.depth / 2);
  const panels = useMemo(
    () => ({ back: netPanel(GOAL.width, height, 10), roof: netPanel(GOAL.depth, GOAL.width), side: netPanel(GOAL.depth, height) }),
    [height],
  );
  useEffect(() => () => Object.values(panels).forEach((g) => g.dispose()), [panels]);
  useEffect(() => () => tex.dispose(), [tex]);

  // When this net last caught a goal, in seconds of the frame clock.
  const struck = useRef<number | null>(null);
  const seen = useRef(hit);
  useFrame(({ clock }) => {
    if (hit !== seen.current) {
      seen.current = hit;
      if (hit > 0) struck.current = clock.elapsedTime;
    }
    if (struck.current === null) return;
    const t = clock.elapsedTime - struck.current;
    const settled = t > 1.5;
    const out = settled ? 0 : BILLOW.depth * Math.exp(-BILLOW.decay * t) * Math.sin(BILLOW.wobble * t);
    // Pushed out most in the middle, held at the edges where the net is tied on.
    const pos = panels.back.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const u = (2 * pos.getX(i)) / GOAL.width;
      const v = (2 * pos.getY(i)) / height;
      pos.setZ(i, out * (1 - u * u) * (1 - v * v));
    }
    pos.needsUpdate = true;
    if (settled) struck.current = null;
  });

  // Only the opaque pocket and ball sit behind the net, so it needs no depth writes.
  const cord = <meshBasicMaterial map={tex} transparent depthWrite={false} side={DoubleSide} />;
  return (
    <group>
      {/* Back: the plane's +z turned to face out of the table, so billowing is +z. */}
      <mesh geometry={panels.back} position={[dir * (front + GOAL.depth - inset), midY, 0]} rotation-y={(dir * Math.PI) / 2}>
        {cord}
      </mesh>
      <mesh geometry={panels.roof} position={[midX, GOAL.height - inset, 0]} rotation-x={Math.PI / 2}>
        {cord}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={panels.side} position={[midX, midY, s * (GOAL.width / 2 - inset)]}>
          {cord}
        </mesh>
      ))}
    </group>
  );
}
