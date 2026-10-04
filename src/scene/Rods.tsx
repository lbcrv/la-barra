"use client";

import { CoefficientCombineRule } from "@dimforge/rapier3d-compat";
import { CuboidCollider, CylinderCollider, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, type RapierRigidBody } from "@react-three/rapier";
import { Outlines } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Color, CylinderGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector3, type BufferGeometry, type Group } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { clampHandle, KEY_SWEEP, ROD_SPEED, type Inputs } from "@/game/input";
import { KICK, restingKick, stepKick } from "@/game/kick";
import { aheadOf, atBoot, PASS, planPass, receiverOf, type PassPlan } from "@/game/pass";
import { activeRod, attackDir, handleSlide, MAN, manOffsets, ROD_Y, RODS, slideToward, stepSlide, type RodSpec, type SlideState } from "@/game/rods";
import { CABINET, FIELD, WALL } from "@/game/table";
import { TEAMS, type Side } from "@/game/teams";
import type { BallHandle } from "./Ball";
import { lookFor, rodFigures } from "./Figure";
import { INK, OUTLINE_PX, toonGradient } from "./toon";

/**
 * Players bounce the ball off painted wood, and the ball slides off the boot
 * instead of gripping it. With grip, a rising boot puts so much backspin on the
 * ball that a shot rolls back to the kicker once it lands.
 */
const MAN_PHYSICS = { restitution: 0.45, friction: 0.02, frictionCombineRule: CoefficientCombineRule.Min };
/** The steel rods: hard and slippery. */
const ROD_RADIUS = 0.0075;
const ROD_PHYSICS = { restitution: 0.5, friction: 0.02, frictionCombineRule: CoefficientCombineRule.Min };

/** Half the cabinet's width, to where the rods come out the sides. */
const CABINET_HALF = FIELD.width / 2 + WALL.thickness + CABINET.rim;
/** How far a rod sticks out on the handle side, and on the other. */
const HANDLE_SIDE = 0.2;
const STUB_SIDE = 0.03;

const Z_AXIS = new Vector3(0, 0, 1);

/** Steps a value toward a target by at most `step`. */
const toward = (from: number, to: number, step: number) => from + Math.max(-step, Math.min(step, to - from));

/** A rod drawn back past any windup is lifted to let a pass roll under it. */
const isLifted = (angle: number) => angle < KICK.windup - 0.1;

/** A pass on its way: where it is going, who played it, and for how long it has rolled. */
interface Flight {
  plan: PassPlan;
  passer: number;
  t: number;
}

/** The rods as the online host last described them. */
export interface RemoteRods {
  slides: number[];
  angles: number[];
  active: Record<Side, number | null>;
}

/**
 * All eight rods. Every physics step each rod slides toward what its side is
 * asking for (the pointer, the keys or the bot), and the side's active rod,
 * the one nearest the ball, turns through its kick.
 */
export const Rods = memo(function Rods({
  inputsRef,
  ball,
  slidesRef,
  speedRef,
  anglesRef,
  activeRef,
  remoteRef,
  localSide = null,
}: {
  inputsRef: RefObject<Inputs>;
  ball: RefObject<BallHandle | null>;
  /** Where each rod sits, written every step so the bot can see its own players. */
  slidesRef: RefObject<number[]>;
  /** Power-up multiplier on each side's rod speed. */
  speedRef: RefObject<Record<Side, number>>;
  /** Kick angles and active rods, written every step for the online host to send. */
  anglesRef?: RefObject<number[]>;
  activeRef?: RefObject<Record<Side, number | null>>;
  /** Online guest: draw the rods where the host says they are, and simulate nothing. */
  remoteRef?: RefObject<RemoteRods | null>;
  /**
   * Online guest: its own side, whose rods it moves locally from its own hand
   * right away instead of waiting for the host to echo them back a round trip
   * later. The host stays in charge of where the ball goes.
   */
  localSide?: Side | null;
}) {
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  const slides = slidesRef;
  const kicks = useRef(RODS.map(() => restingKick()));
  // Each rod's slide speed, so it eases in and out instead of starting and stopping dead.
  const motion = useRef<SlideState[]>(RODS.map(() => ({ x: 0, v: 0 })));
  const current = useRef<Record<Side, number | null>>({ red: null, blue: null });
  // Mirrors `current` for rendering the highlighted handle; updated only when it changes.
  const [active, setActive] = useState<Record<Side, number | null>>({ red: null, blue: null });
  const turn = useMemo(() => new Quaternion(), []);
  const remoteActive = useRef("");
  // Each rod's upper bodies, for the cartoon squash and stretch.
  const uppers = useRef<(Group | null)[]>([]);
  // Stable ref callbacks, so a rod only re-renders when its own handle lights up.
  const bodyRefs = useMemo(() => RODS.map((_, i) => (b: RapierRigidBody | null) => void (bodies.current[i] = b)), []);
  const upperRefs = useMemo(() => RODS.map((_, i) => (g: Group | null) => void (uppers.current[i] = g)), []);
  // Passing: the presses each side has had answered, the rod tapping a pass
  // right now (if any), each rod's lift as it lets a pass roll under it, and
  // the pass on its way.
  const passesSeen = useRef<Record<Side, number>>({ red: 0, blue: 0 });
  const passing = useRef<Record<Side, number | null>>({ red: null, blue: null });
  const lift = useRef(RODS.map(() => 0));
  const flight = useRef<Flight | null>(null);

  /** Starts a pass from `team`'s active rod, if the ball is there to be passed. */
  function startPass(team: Side) {
    const i = current.current[team];
    const at = ball.current?.position();
    if (i === null || !at) return;
    const rod = RODS[i];
    const k = kicks.current[i];
    // Mid-swing, or still high on the way back: too late to tap again.
    if (k.phase === "strike" || (k.phase === "recover" && k.angle > KICK.rearmAt)) return;
    // Let go of the kick, so a shot being charged turns into the pass instead.
    inputsRef.current[team].kick = false;
    if (receiverOf(rod)) {
      // A soft tap; the ball leaves as the boot comes through.
      kicks.current[i] = { phase: "strike", angle: k.angle, held: 0, speed: PASS.swing };
      passing.current[team] = i;
      return;
    }
    // On the forwards: roll it along the rod, no swing needed.
    if (!atBoot(rod, slides.current[i], at)) return;
    const plan = planPass(rod, at, slides.current);
    if (!plan) return;
    ball.current?.roll(plan.vx, plan.vz);
    flight.current = { plan, passer: i, t: 0 };
  }

  /** Guest prediction: the same handle, slide and kick steps the host runs, for one side only. */
  function predictOwn(team: Side, dt: number) {
    const input = inputsRef.current[team];
    if (input.keyDir !== 0) {
      if (input.handle === null) {
        const mid = RODS.findIndex((r) => r.team === team && r.role === "midfield");
        input.handle = clampHandle(slides.current[mid] / RODS[mid].travel);
      }
      input.handle = clampHandle(input.handle + input.keyDir * KEY_SWEEP * speedRef.current[team] * dt);
    }
    const at = ball.current?.position() ?? null;
    if (at) current.current[team] = activeRod(team, at.x, current.current[team]);
    RODS.forEach((rod, i) => {
      if (rod.team !== team) return;
      const target = input.handle !== null ? handleSlide(rod, input.handle) : motion.current[i].x;
      motion.current[i] = stepSlide(motion.current[i], target, dt, ROD_SPEED * speedRef.current[team]);
      slides.current[i] = motion.current[i].x;
      kicks.current[i] = stepKick(kicks.current[i], input.kick && current.current[team] === i, dt);
      // Passes run on the host: when it lifts one of our rods to let a pass under, show that.
      const hostAngle = remoteRef?.current?.angles[i] ?? 0;
      const angle = isLifted(hostAngle) ? hostAngle : kicks.current[i].angle;
      const body = bodies.current[i];
      if (!body) return;
      body.setTranslation({ x: rod.x, y: ROD_Y, z: slides.current[i] }, true);
      turn.setFromAxisAngle(Z_AXIS, attackDir(rod.team) * angle);
      body.setRotation(turn, true);
    });
  }

  // Online guest: copy the host's rods straight onto the bodies. Physics is paused
  // there, and the renderer still draws each body wherever it is placed.
  useFrame((_, frameDt) => {
    const remote = remoteRef?.current;
    if (!remote) return;
    const dt = Math.min(frameDt, 0.05);
    if (localSide) predictOwn(localSide, dt);
    RODS.forEach((rod, i) => {
      if (rod.team === localSide) return;
      const angle = remote.angles[i];
      // Rebuild just enough kick state for the squash and stretch below. A rod
      // lifted for a pass is just standing aside, not charging a shot.
      const windup = angle < -0.05 && !isLifted(angle);
      kicks.current[i] = { phase: windup ? "windup" : angle > 0.3 ? "strike" : "rest", angle, held: windup ? 0.35 : 0, speed: 0 };
      slides.current[i] = remote.slides[i];
      const body = bodies.current[i];
      if (!body) return;
      body.setTranslation({ x: rod.x, y: ROD_Y, z: remote.slides[i] }, true);
      turn.setFromAxisAngle(Z_AXIS, attackDir(rod.team) * angle);
      body.setRotation(turn, true);
    });
    const a = localSide ? { ...remote.active, [localSide]: current.current[localSide] } : remote.active;
    const key = `${a.red},${a.blue}`;
    if (key !== remoteActive.current) {
      remoteActive.current = key;
      current.current = { ...a };
      setActive({ ...a });
    }
  });


  // Visual only: upper bodies squash as the kick is drawn back and stretch as it
  // lands. Legs never stretch, so boots can't dip into the field; nothing scales
  // along the rod, so players stay where their colliders are.
  useFrame(() => {
    RODS.forEach((_, i) => {
      const k = kicks.current[i];
      let sy = 1;
      if (k.phase === "windup") sy = 1 - 0.14 * Math.min(1, k.held / 0.35);
      else if (k.phase === "strike") sy = 1.16;
      else if (k.phase === "recover") sy = 1 + 0.16 * Math.max(0, k.angle - 0.6);
      uppers.current[i]?.scale.set(1 / Math.sqrt(sy), sy, 1);
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
      flight: flight.current && { ...flight.current },
      lift: lift.current.map((v) => +v.toFixed(2)),
      bodies: bodies.current.map((b) => (b ? { t: b.translation(), r: b.rotation() } : null)),
    });
    (window as unknown as { __kick?: unknown }).__kick = KICK;
  }, [slides]);

  useBeforePhysicsStep((world) => {
    if (remoteRef?.current) return;
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

    // Held keys sweep a side's handle; it starts from where its rods are.
    for (const team of ["red", "blue"] as const) {
      const input = inputsRef.current[team];
      if (input.keyDir === 0) continue;
      if (input.handle === null) {
        const mid = RODS.findIndex((r) => r.team === team && r.role === "midfield");
        input.handle = clampHandle(slides.current[mid] / RODS[mid].travel);
      }
      input.handle = clampHandle(input.handle + input.keyDir * KEY_SWEEP * speedRef.current[team] * dt);
      input.pointerZ = null;
    }

    // A new pass press: answer it once. The count starts over with each match.
    for (const team of ["red", "blue"] as const) {
      const pressed = inputsRef.current[team].passes;
      if (pressed < passesSeen.current[team]) passesSeen.current[team] = pressed;
      if (pressed === passesSeen.current[team]) continue;
      passesSeen.current[team] = pressed;
      startPass(team);
    }

    // The rod a pass is heading for lifts its feet until the ball is in front of them.
    const f = flight.current;
    const receiving = f && !f.plan.lateral && at && aheadOf(RODS[f.plan.receiver], at.x) < PASS.trapAhead ? f.plan.receiver : null;

    RODS.forEach((rod, i) => {
      const input = inputsRef.current[rod.team];
      const boost = speedRef.current[rod.team];
      const now = motion.current[i];
      let target = now.x;
      // A person's hand moves every rod as one; the bot aims a player at a point.
      if (input.handle !== null) target = handleSlide(rod, input.handle);
      else if (input.pointerZ !== null) target = slideToward(rod, input.pointerZ, now.x);
      motion.current[i] = stepSlide(now, target, dt, ROD_SPEED * boost);
      slides.current[i] = motion.current[i].x;

      const kicking = input.kick && current.current[rod.team] === i;
      kicks.current[i] = stepKick(kicks.current[i], kicking, dt);

      // A passing tap lets the ball go as the boot comes through it.
      if (passing.current[rod.team] === i && kicks.current[i].angle >= PASS.release) {
        passing.current[rod.team] = null;
        const now = ball.current?.position();
        const plan = now && atBoot(rod, slides.current[i], now) ? planPass(rod, now, slides.current) : null;
        if (plan) {
          ball.current?.roll(plan.vx, plan.vz);
          flight.current = { plan, passer: i, t: 0 };
        }
      }
      if (passing.current[rod.team] === i && kicks.current[i].phase !== "strike") passing.current[rod.team] = null;

      lift.current[i] = toward(lift.current[i], receiving === i ? PASS.lift : 0, PASS.liftSpeed * dt);
      const angle = kicks.current[i].angle + lift.current[i];

      const body = bodies.current[i];
      if (!body) return;
      body.setNextKinematicTranslation({ x: rod.x, y: ROD_Y, z: slides.current[i] });
      // Turning about +z swings the foot toward +x, which is red's attack.
      turn.setFromAxisAngle(Z_AXIS, attackDir(rod.team) * angle);
      body.setNextKinematicRotation(turn);
      if (anglesRef) anglesRef.current[i] = angle;
    });
    if (activeRef) activeRef.current = current.current;
  });

  // After each step, see the pass through: keep it on its line while the tap
  // is still touching it, trap it in front of the receiver, or give up on it.
  useAfterPhysicsStep((world) => {
    const f = flight.current;
    if (!f || remoteRef?.current) return;
    f.t += world.timestep;
    const b = ball.current?.state();
    if (!b || f.t > PASS.timeout) {
      flight.current = null;
      return;
    }
    const { plan } = f;
    const passer = RODS[f.passer];
    if (kicks.current[f.passer].phase === "strike" && atBoot(passer, slides.current[f.passer], b)) {
      ball.current?.roll(plan.vx, plan.vz);
      return;
    }
    const to = RODS[plan.receiver];
    if (plan.lateral) {
      // Along the rod: stop at the foot of the forward it was meant for.
      const z = slides.current[to.id] + manOffsets(to)[plan.man];
      if ((z - b.z) * Math.sign(plan.vz) <= 0.004) {
        ball.current?.roll(0, 0, true);
        flight.current = null;
      } else if (Math.abs(aheadOf(to, b.x)) > 0.1) {
        flight.current = null;
      }
      return;
    }
    const ahead = aheadOf(to, b.x);
    const forward = b.vx * attackDir(to.team);
    if (ahead >= PASS.trapAhead && ahead <= PASS.trapAhead + PASS.trapWindow) {
      // Through under the lifted feet: the receiver traps it in front of its boots.
      ball.current?.roll(0, 0, true);
      flight.current = null;
    } else if (ahead > PASS.trapAhead + PASS.trapWindow || forward < 0.05) {
      // Ran past, or stopped or turned back by someone on the way.
      flight.current = null;
    }
  });

  return (
    <>
      <Bushings />
      {RODS.map((rod, i) => (
        <Rod key={rod.id} rod={rod} active={active[rod.team] === rod.id} bodyRef={bodyRefs[i]} upperRef={upperRefs[i]} />
      ))}
    </>
  );
});

const Rod = memo(function Rod({
  rod,
  active,
  bodyRef,
  upperRef,
}: {
  rod: RodSpec;
  active: boolean;
  bodyRef: (b: RapierRigidBody | null) => void;
  upperRef: (g: Group | null) => void;
}) {
  const grad = toonGradient();
  const figures = useMemo(() => {
    const offsets = manOffsets(rod);
    const team = TEAMS[rod.team];
    return rodFigures(offsets, attackDir(rod.team), team.color, team.shorts, offsets.map((_, k) => lookFor(rod.id * 10 + k)));
  }, [rod]);
  useEffect(() => () => Object.values(figures).forEach((g) => g.dispose()), [figures]);
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
      {/* The steel rod across the field: a ball in the air bounces off it instead of passing through. */}
      <CylinderCollider args={[FIELD.width / 2 + rod.travel, ROD_RADIUS]} rotation={[Math.PI / 2, 0, 0]} {...ROD_PHYSICS} />
      {manOffsets(rod).map((z) => (
        <group key={z}>
          <CuboidCollider args={[MAN.thick / 2, legLength / 2, MAN.width / 2]} position={[0, -legLength / 2, z]} {...MAN_PHYSICS} />
          <CuboidCollider
            args={[MAN.thick / 2 + 0.003, MAN.footHeight / 2, MAN.footWidth / 2]}
            position={[0, -MAN.reach + MAN.footHeight / 2, z]}
            {...MAN_PHYSICS}
          />
        </group>
      ))}

      {/* The players, three merged meshes for the whole rod. */}
      <group ref={upperRef}>
        <mesh geometry={figures.upper} castShadow>
          <meshToonMaterial vertexColors gradientMap={grad} />
          <Outlines thickness={OUTLINE_PX} color={INK} />
        </mesh>
        <mesh geometry={figures.face}>
          <meshBasicMaterial vertexColors toneMapped={false} />
        </mesh>
      </group>
      <mesh geometry={figures.lower} castShadow>
        <meshToonMaterial vertexColors gradientMap={grad} />
        <Outlines thickness={OUTLINE_PX} color={INK} />
      </mesh>

      {/* Steel rod through the cabinet. */}
      <mesh rotation-x={Math.PI / 2} position={[0, 0, centre]} castShadow>
        <cylinderGeometry args={[ROD_RADIUS, ROD_RADIUS, length, 12]} />
        {/* Thin enough that an outline adds a draw call and little else. */}
        <meshToonMaterial color="#8f969f" gradientMap={grad} />
      </mesh>
      {/* Rubber handle on the owner's side; it warms up when this rod has the ball. */}
      <mesh rotation-x={Math.PI / 2} position={[0, 0, handleDir * (reachHandle - 0.055)]} castShadow>
        <cylinderGeometry args={[0.017, 0.015, 0.11, 16]} />
        <meshToonMaterial color={active ? team.color : "#2a211b"} gradientMap={grad} emissive={team.color} emissiveIntensity={active ? 0.35 : 0} />
        <Outlines thickness={OUTLINE_PX} color={INK} />
      </mesh>
    </RigidBody>
  );
});

const bushingGeometry = (() => {
  const parts: BufferGeometry[] = [];
  const m = new Matrix4();
  const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
  const brass = new Color("#c9a24a");
  const collar = new Color("#8a6d2c");
  const paint = (g: BufferGeometry, c: Color) => {
    const n = g.getAttribute("position").count;
    const colors = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) colors.set([c.r, c.g, c.b], k * 3);
    g.setAttribute("color", new Float32BufferAttribute(colors, 3));
    g.deleteAttribute("uv");
    return g;
  };
  for (const rod of RODS) {
    for (const side of [-1, 1]) {
      const z = side * (CABINET_HALF + 0.004);
      // Flange against the wood, then the collar the rod runs in.
      const flange = new CylinderGeometry(0.017, 0.017, 0.004, 20);
      flange.applyMatrix4(m.compose(new Vector3(rod.x, ROD_Y, z), q, new Vector3(1, 1, 1)));
      parts.push(paint(flange, brass));
      const ring = new CylinderGeometry(0.0115, 0.0115, 0.01, 16);
      ring.applyMatrix4(m.compose(new Vector3(rod.x, ROD_Y, z + side * 0.006), q, new Vector3(1, 1, 1)));
      parts.push(paint(ring, collar));
    }
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  return merged;
})();

/**
 * The bearings where each rod passes through the cabinet: a flanged ring on
 * both outer faces, all sixteen merged into one mesh. They stay put while the
 * rods slide and turn inside them.
 */
function Bushings() {
  const grad = toonGradient();
  return (
    <mesh geometry={bushingGeometry}>
      <meshToonMaterial vertexColors gradientMap={grad} />
      <Outlines thickness={OUTLINE_PX * 0.8} color={INK} />
    </mesh>
  );
}
