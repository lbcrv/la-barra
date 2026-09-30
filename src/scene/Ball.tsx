"use client";

import { Outlines, Trail } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { BallCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { BallState } from "@/game/bot";
import { towardPlay } from "@/game/rods";
import { BALL, FIELD, SERVE } from "@/game/table";
import { INK, OUTLINE_PX, toonGradient } from "./toon";

export interface BallHandle {
  /** Rolls a new ball in through the serving hole on the near side. */
  serve: () => void;
  /** Puts the ball at a point with a velocity. For tests and, later, replays. */
  place: (at: { x: number; z: number }, velocity: { x: number; z: number }) => void;
  /** Takes the ball off the table until the next serve. */
  park: () => void;
  /** Drops a new ball on the centre spot, rolling toward one side. */
  drop: () => void;
  /** Where the ball is now, or null when parked. */
  position: () => { x: number; y: number; z: number } | null;
  /** Position and velocity on the table plane, or null when parked. */
  state: () => BallState | null;
  /** Multiplies the ball's speed, for a power-up kick. */
  boost: (factor: number) => void;
  /** Scales how quickly the ball slows down: below 1 is ice. */
  setDamping: (factor: number) => void;
  /** Online guest: put the ball where the host says it is, or off the table for null. */
  mirror: (at: [number, number, number] | null) => void;
}

/** Where the ball waits between points: under the table, out of sight. */
const PARKED = { x: 0, y: -0.5, z: 0 };

/**
 * A ball that hasn't got DEAD_DISTANCE away from where it was for DEAD_AFTER
 * seconds is dead and served again, like a referee freeing it. Measuring
 * distance rather than speed also catches a ball nudged back and forth
 * between two players without ever getting anywhere.
 */
const DEAD_AFTER = 3.5;
const DEAD_DISTANCE = 0.03;

/**
 * Where no player can touch the ball, the table leans it back into play, like
 * the slight slope real tables have in their dead spots. Below this speed the
 * lean kicks in (m/s), with this much push (m/s²).
 */
const LEAN_BELOW = 0.25;
const LEAN = 0.9;
/** A ball stranded out of everyone's reach this long is dropped again in the middle (s). */
const STRANDED_AFTER = 2;

/** A jump in speed this big in one frame is a hit worth reacting to, in m/s. */
const HIT_JUMP = 0.6;

export const Ball = forwardRef<
  BallHandle,
  {
    onDead: () => void;
    /** The ball was struck or bounced hard; `strength` is the speed it gained, `vx` where it now heads. */
    onHit?: (strength: number, kind: "kick" | "wall", vx: number) => void;
    /** On fire: an orange trail and a glow. */
    hot?: boolean;
  }
>(function Ball({ onDead, onHit, hot = false }, ref) {
  const body = useRef<RapierRigidBody>(null);
  const lastSpeed = useRef(0);
  const still = useRef(0);
  const anchor = useRef<{ x: number; z: number } | null>(null);
  const stranded = useRef(0);
  const live = useRef(false);

  useImperativeHandle(ref, () => ({
    serve() {
      const b = body.current;
      if (!b) return;
      b.setEnabled(true);
      b.setTranslation({ x: SERVE.x + (Math.random() - 0.5) * 0.04, y: SERVE.height, z: SERVE.z }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
      // Rolled in across the table, drifting a little toward one end or the other.
      b.setLinvel({ x: (Math.random() - 0.5) * 0.5, y: 0, z: -SERVE.speed * (0.8 + Math.random() * 0.4) }, true);
      still.current = 0;
      anchor.current = null;
      live.current = true;
    },
    place(at, velocity) {
      const b = body.current;
      if (!b) return;
      b.setEnabled(true);
      b.setTranslation({ x: at.x, y: 0.03, z: at.z }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
      b.setLinvel({ x: velocity.x, y: 0, z: velocity.z }, true);
      still.current = 0;
      anchor.current = null;
      live.current = true;
    },
    position() {
      const b = body.current;
      if (!b || !b.isEnabled()) return null;
      const p = b.translation();
      return { x: p.x, y: p.y, z: p.z };
    },
    state() {
      const b = body.current;
      if (!b || !b.isEnabled()) return null;
      const p = b.translation();
      const v = b.linvel();
      return { x: p.x, z: p.z, vx: v.x, vz: v.z };
    },
    boost(factor) {
      const b = body.current;
      if (!b || !b.isEnabled()) return;
      const v = b.linvel();
      b.setLinvel({ x: v.x * factor, y: v.y, z: v.z * factor }, true);
      // The jump this makes is the power-up's, not a new kick.
      lastSpeed.current = Math.hypot(v.x, v.z) * factor;
    },
    setDamping(factor) {
      body.current?.setLinearDamping(BALL.damping * factor);
    },
    mirror(at) {
      const b = body.current;
      if (!b) return;
      live.current = false;
      if (!at) {
        if (b.isEnabled()) b.setEnabled(false);
        return;
      }
      if (!b.isEnabled()) b.setEnabled(true);
      b.setTranslation({ x: at[0], y: at[1], z: at[2] }, true);
    },
    drop() {
      const b = body.current;
      if (!b) return;
      b.setEnabled(true);
      b.setTranslation({ x: 0, y: 0.06, z: (Math.random() - 0.5) * 0.1 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
      // Rolling toward one side's midfield, so it never sits on the dead centre spot.
      const side = Math.random() < 0.5 ? -1 : 1;
      b.setLinvel({ x: side * (0.3 + Math.random() * 0.15), y: 0, z: (Math.random() - 0.5) * 0.5 }, true);
      still.current = 0;
      stranded.current = 0;
      anchor.current = null;
      live.current = true;
    },
    park() {
      const b = body.current;
      if (!b) return;
      b.setTranslation(PARKED, false);
      b.setLinvel({ x: 0, y: 0, z: 0 }, false);
      b.setAngvel({ x: 0, y: 0, z: 0 }, false);
      // Disabled, it neither falls nor collides while it waits.
      b.setEnabled(false);
      live.current = false;
    },
  }));

  // Start parked: nothing is on the table until the first serve.
  useEffect(() => {
    body.current?.setEnabled(false);
  }, []);

  // A ball that stops where no player can reach it is dead; serve again.
  useFrame((_, dt) => {
    const b = body.current;
    if (!b || !live.current) return;
    const v = b.linvel();
    const speed = Math.hypot(v.x, v.z);
    // A sudden gain in speed is a kick; a sudden loss near a wall is a bounce.
    const jump = speed - lastSpeed.current;
    lastSpeed.current = speed;
    if (onHit && jump > HIT_JUMP) onHit(jump, "kick", v.x);
    else if (onHit && jump < -HIT_JUMP) onHit(-jump, "wall", v.x);
    const p = b.translation();
    if (!anchor.current || Math.hypot(p.x - anchor.current.x, p.z - anchor.current.z) > DEAD_DISTANCE) {
      anchor.current = { x: p.x, z: p.z };
      still.current = 0;
    } else {
      still.current += dt;
    }
    // Out of everyone's reach and slowing down: lean it back into play.
    const onField = Math.abs(p.x) < FIELD.length / 2 - BALL.radius && p.y > 0;
    const lean = onField ? towardPlay(p.x, p.z) : null;
    if (lean && speed < LEAN_BELOW) {
      const push = BALL.mass * LEAN * dt;
      b.applyImpulse({ x: lean.x * push, y: 0, z: lean.z * push }, true);
      stranded.current += dt;
    } else {
      stranded.current = 0;
    }
    // Stuck, stranded, or somehow off the table: either way the point is over.
    if (still.current > DEAD_AFTER || stranded.current > STRANDED_AFTER || p.y < -0.3) {
      live.current = false;
      onDead();
    }
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={[PARKED.x, PARKED.y, PARKED.z]}
      ccd
      linearDamping={BALL.damping}
      angularDamping={BALL.spinDamping}
      userData={{ name: "ball" }}
    >
      <BallCollider args={[BALL.radius]} mass={BALL.mass} restitution={BALL.restitution} friction={BALL.friction} />
      <Trail width={hot ? 0.06 : 0.035} length={hot ? 7 : 4} decay={2.2} color={hot ? "#ff7a1a" : "#fff3cf"} attenuation={(w) => w * w}>
        <mesh castShadow>
          <sphereGeometry args={[BALL.radius, 32, 24]} />
          <meshToonMaterial color={hot ? "#ffd27a" : "#fff6e0"} gradientMap={toonGradient()} emissive="#ff6a00" emissiveIntensity={hot ? 0.6 : 0} />
          <Outlines thickness={OUTLINE_PX} color={INK} />
        </mesh>
      </Trail>
    </RigidBody>
  );
});
