"use client";

import { useFrame } from "@react-three/fiber";
import { BallCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { BALL, SERVE } from "@/game/table";

export interface BallHandle {
  /** Rolls a new ball in through the serving hole on the near side. */
  serve: () => void;
  /** Puts the ball at a point with a velocity. For tests and, later, replays. */
  place: (at: { x: number; z: number }, velocity: { x: number; z: number }) => void;
  /** Takes the ball off the table until the next serve. */
  park: () => void;
  /** Where the ball is now, or null when parked. */
  position: () => { x: number; y: number; z: number } | null;
}

/** Where the ball waits between points: under the table, out of sight. */
const PARKED = { x: 0, y: -0.5, z: 0 };

/** Seconds a ball may sit still before it counts as dead and is served again. */
const DEAD_AFTER = 4;

export const Ball = forwardRef<BallHandle, { onDead: () => void }>(function Ball({ onDead }, ref) {
  const body = useRef<RapierRigidBody>(null);
  const still = useRef(0);
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
      live.current = true;
    },
    position() {
      const b = body.current;
      if (!b || !b.isEnabled()) return null;
      const p = b.translation();
      return { x: p.x, y: p.y, z: p.z };
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
    still.current = speed < 0.02 ? still.current + dt : 0;
    // Stuck, or somehow off the table: either way the point is over.
    if (still.current > DEAD_AFTER || b.translation().y < -0.3) {
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
      angularDamping={BALL.damping}
      userData={{ ball: true }}
    >
      <BallCollider args={[BALL.radius]} mass={BALL.mass} restitution={BALL.restitution} friction={BALL.friction} />
      <mesh castShadow>
        <sphereGeometry args={[BALL.radius, 32, 24]} />
        <meshStandardMaterial color="#efe6d2" roughness={0.45} />
      </mesh>
    </RigidBody>
  );
});
