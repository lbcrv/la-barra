"use client";

import { CoefficientCombineRule } from "@dimforge/rapier3d-compat";
import { CuboidCollider, RigidBody, useBeforePhysicsStep, type RapierRigidBody } from "@react-three/rapier";
import { Outlines } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Quaternion, Vector3, type Group } from "three";
import { KEY_SPEED, ROD_SPEED, type Inputs } from "@/game/input";
import { KICK, restingKick, stepKick } from "@/game/kick";
import { activeRod, attackDir, clampSlide, MAN, manOffsets, ROD_Y, RODS, slideToward, type RodSpec } from "@/game/rods";
import { CABINET, FIELD, WALL } from "@/game/table";
import { TEAMS, type Side } from "@/game/teams";
import type { BallHandle } from "./Ball";
import { Figure, lookFor } from "./Figure";
import { INK, OUTLINE_PX, toonGradient } from "./toon";

/**
 * Players bounce the ball off painted wood, and the ball slides off the boot
 * instead of gripping it. With grip, a rising boot puts so much backspin on the
 * ball that a shot rolls back to the kicker once it lands.
 */
const MAN_PHYSICS = { restitution: 0.45, friction: 0.02, frictionCombineRule: CoefficientCombineRule.Min };

/** Half the cabinet's width, to where the rods come out the sides. */
const CABINET_HALF = FIELD.width / 2 + WALL.thickness + CABINET.rim;
/** How far a rod sticks out on the handle side, and on the other. */
const HANDLE_SIDE = 0.2;
const STUB_SIDE = 0.03;

const Z_AXIS = new Vector3(0, 0, 1);

/**
 * All eight rods. Every physics step each rod slides toward what its side is
 * asking for (the pointer, the keys or the bot), and the side's active rod,
 * the one nearest the ball, turns through its kick.
 */
export function Rods({
  inputs,
  ball,
  slidesRef,
}: {
  inputs: RefObject<Inputs>;
  ball: RefObject<BallHandle | null>;
  /** Where each rod sits, written every step so the bot can see its own players. */
  slidesRef: RefObject<number[]>;
}) {
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  const slides = slidesRef;
  const kicks = useRef(RODS.map(() => restingKick()));
  const current = useRef<Record<Side, number | null>>({ red: null, blue: null });
  // Mirrors `current` for rendering the highlighted handle; updated only when it changes.
  const [active, setActive] = useState<Record<Side, number | null>>({ red: null, blue: null });
  const turn = useMemo(() => new Quaternion(), []);
  // Each rod's player groups, for the cartoon squash and stretch.
  const figures = useRef<(Group | null)[][]>(RODS.map(() => []));

  // Visual only: players squash as the kick is drawn back and stretch as it lands.
  useFrame(() => {
    RODS.forEach((_, i) => {
      const k = kicks.current[i];
      let sy = 1;
      if (k.phase === "windup") sy = 1 - 0.14 * Math.min(1, k.held / 0.35);
      else if (k.phase === "strike") sy = 1.16;
      else if (k.phase === "recover") sy = 1 + 0.16 * Math.max(0, k.angle - 0.6);
      const sx = 1 / Math.sqrt(sy);
      for (const g of figures.current[i]) g?.scale.set(sx, sy, sx);
    });
  });

  // Development only: lets a test read what the rods are doing.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __rods?: unknown }).__rods = () => ({
      slides: slides.current.map((v) => +v.toFixed(3)),
      angles: kicks.current.map((k) => +k.angle.toFixed(2)),
      phases: kicks.current.map((k) => k.phase),
      active: { ...current.current },
      bodies: bodies.current.map((b) => (b ? { t: b.translation(), r: b.rotation() } : null)),
    });
    (window as unknown as { __kick?: unknown }).__kick = KICK;
  }, [slides]);

  useBeforePhysicsStep((world) => {
    const dt = world.timestep;
    const at = ball.current?.position() ?? null;

    let changed = false;
    for (const team of ["red", "blue"] as const) {
      const next = at
        ? activeRod(team, at.x, current.current[team])
        : RODS.find((r) => r.team === team && r.role === "midfield")!.id;
      if (next !== current.current[team]) {
        current.current[team] = next;
        changed = true;
      }
    }
    if (changed) setActive({ ...current.current });

    RODS.forEach((rod, i) => {
      const input = inputs.current[rod.team];
      let target = slides.current[i];
      if (input.pointerZ !== null) target = slideToward(rod, input.pointerZ);
      else if (input.keyDir !== 0) target = clampSlide(rod, target + input.keyDir * KEY_SPEED * dt);
      const step = ROD_SPEED * dt;
      slides.current[i] += Math.max(-step, Math.min(step, target - slides.current[i]));

      const kicking = input.kick && current.current[rod.team] === i;
      kicks.current[i] = stepKick(kicks.current[i], kicking, dt);

      const body = bodies.current[i];
      if (!body) return;
      body.setNextKinematicTranslation({ x: rod.x, y: ROD_Y, z: slides.current[i] });
      // Turning about +z swings the foot toward +x, which is red's attack.
      turn.setFromAxisAngle(Z_AXIS, attackDir(rod.team) * kicks.current[i].angle);
      body.setNextKinematicRotation(turn);
    });
  });

  return (
    <>
      {RODS.map((rod, i) => (
        <Rod
          key={rod.id}
          rod={rod}
          active={active[rod.team] === rod.id}
          bodyRef={(b) => (bodies.current[i] = b)}
          figureRef={(k, g) => (figures.current[i][k] = g)}
        />
      ))}
    </>
  );
}

function Rod({
  rod,
  active,
  bodyRef,
  figureRef,
}: {
  rod: RodSpec;
  active: boolean;
  bodyRef: (b: RapierRigidBody | null) => void;
  figureRef: (index: number, g: Group | null) => void;
}) {
  const grad = toonGradient();
  const team = TEAMS[rod.team];
  // Red stands on the near side (+z), blue on the far side.
  const handleDir = rod.team === "red" ? 1 : -1;
  const reachHandle = CABINET_HALF + HANDLE_SIDE;
  const reachStub = CABINET_HALF + STUB_SIDE;
  const length = reachHandle + reachStub;
  const centre = (handleDir * (reachHandle - reachStub)) / 2;
  const legLength = MAN.reach - MAN.footHeight;

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[rod.x, ROD_Y, 0]}
      userData={{ name: `rod${rod.id}-${rod.team}-${rod.role}` }}
    >
      {manOffsets(rod).map((z, k) => (
        <group key={z}>
          <CuboidCollider args={[MAN.thick / 2, legLength / 2, MAN.width / 2]} position={[0, -legLength / 2, z]} {...MAN_PHYSICS} />
          <CuboidCollider
            args={[MAN.thick / 2 + 0.003, MAN.footHeight / 2, MAN.footWidth / 2]}
            position={[0, -MAN.reach + MAN.footHeight / 2, z]}
            {...MAN_PHYSICS}
          />
          <Figure
            ref={(g) => figureRef(k, g)}
            z={z}
            jersey={team.color}
            shorts={team.shorts}
            facing={attackDir(rod.team)}
            look={lookFor(rod.id * 10 + k)}
          />
        </group>
      ))}

      {/* Steel rod through the cabinet. */}
      <mesh rotation-x={Math.PI / 2} position={[0, 0, centre]} castShadow>
        <cylinderGeometry args={[0.0075, 0.0075, length, 12]} />
        <meshToonMaterial color="#8f969f" gradientMap={grad} />
        <Outlines thickness={OUTLINE_PX * 0.8} color={INK} />
      </mesh>
      {/* Rubber handle on the owner's side; it warms up when this rod has the ball. */}
      <mesh rotation-x={Math.PI / 2} position={[0, 0, handleDir * (reachHandle - 0.055)]} castShadow>
        <cylinderGeometry args={[0.017, 0.015, 0.11, 16]} />
        <meshToonMaterial color={active ? team.color : "#2a211b"} gradientMap={grad} emissive={team.color} emissiveIntensity={active ? 0.35 : 0} />
        <Outlines thickness={OUTLINE_PX} color={INK} />
      </mesh>
    </RigidBody>
  );
}
