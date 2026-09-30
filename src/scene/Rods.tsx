"use client";

import { CoefficientCombineRule } from "@dimforge/rapier3d-compat";
import { CuboidCollider, RigidBody, useBeforePhysicsStep, type RapierRigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Quaternion, Vector3 } from "three";
import { KEY_SPEED, ROD_SPEED, type Inputs } from "@/game/input";
import { KICK, restingKick, stepKick } from "@/game/kick";
import { activeRod, attackDir, clampSlide, MAN, manOffsets, ROD_Y, RODS, slideToward, type RodSpec } from "@/game/rods";
import { CABINET, FIELD, WALL } from "@/game/table";
import { TEAMS, type Side } from "@/game/teams";
import type { BallHandle } from "./Ball";

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
        <Rod key={rod.id} rod={rod} active={active[rod.team] === rod.id} bodyRef={(b) => (bodies.current[i] = b)} />
      ))}
    </>
  );
}

function Rod({ rod, active, bodyRef }: { rod: RodSpec; active: boolean; bodyRef: (b: RapierRigidBody | null) => void }) {
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
      {manOffsets(rod).map((z) => (
        <group key={z}>
          <CuboidCollider args={[MAN.thick / 2, legLength / 2, MAN.width / 2]} position={[0, -legLength / 2, z]} {...MAN_PHYSICS} />
          <CuboidCollider
            args={[MAN.thick / 2 + 0.003, MAN.footHeight / 2, MAN.footWidth / 2]}
            position={[0, -MAN.reach + MAN.footHeight / 2, z]}
            {...MAN_PHYSICS}
          />
          <Figure z={z} color={team.color} worn={team.worn} facing={attackDir(rod.team)} />
        </group>
      ))}

      {/* Steel rod through the cabinet. */}
      <mesh rotation-x={Math.PI / 2} position={[0, 0, centre]} castShadow>
        <cylinderGeometry args={[0.0075, 0.0075, length, 12]} />
        <meshStandardMaterial color="#b9bcc0" metalness={0.9} roughness={0.28} />
      </mesh>
      {/* Rubber handle on the owner's side; it warms up when this rod has the ball. */}
      <mesh rotation-x={Math.PI / 2} position={[0, 0, handleDir * (reachHandle - 0.055)]} castShadow>
        <cylinderGeometry args={[0.017, 0.015, 0.11, 16]} />
        <meshStandardMaterial
          color="#1b1714"
          roughness={0.8}
          emissive={team.color}
          emissiveIntensity={active ? 0.55 : 0}
        />
      </mesh>
    </RigidBody>
  );
}

/**
 * One painted wooden player, in rod coordinates: the rod runs through the
 * chest, the head above it, the legs and boot hanging to just above the field.
 */
function Figure({ z, color, worn, facing }: { z: number; color: string; worn: string; facing: 1 | -1 }) {
  const legLength = MAN.reach - MAN.footHeight;
  return (
    <group position={[0, 0, z]}>
      {/* Shirt: from the waist up past the rod to the shoulders. */}
      <mesh position={[0, 0.006, 0]} castShadow>
        <boxGeometry args={[MAN.thick + 0.004, 0.042, MAN.width]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      {/* Head and painted hair. */}
      <mesh position={[0, 0.037, 0]} castShadow>
        <sphereGeometry args={[0.012, 16, 12]} />
        <meshStandardMaterial color="#c89468" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.041, 0]} scale={[1.02, 0.75, 1.02]}>
        <sphereGeometry args={[0.012, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#231a14" roughness={0.7} />
      </mesh>
      {/* Shorts and legs. */}
      <mesh position={[0, -0.022, 0]} castShadow>
        <boxGeometry args={[MAN.thick, 0.012, MAN.width]} />
        <meshStandardMaterial color={worn} roughness={0.6} />
      </mesh>
      <mesh position={[0, -legLength / 2 - 0.012, 0]} castShadow>
        <boxGeometry args={[MAN.thick * 0.8, legLength - 0.024, MAN.width * 0.8]} />
        <meshStandardMaterial color="#c89468" roughness={0.6} />
      </mesh>
      {/* Boot, a touch forward, the part that hits the ball. */}
      <mesh position={[facing * 0.003, -MAN.reach + MAN.footHeight / 2, 0]} castShadow>
        <boxGeometry args={[MAN.thick + 0.006, MAN.footHeight, MAN.footWidth]} />
        <meshStandardMaterial color="#151210" roughness={0.5} />
      </mesh>
    </group>
  );
}
