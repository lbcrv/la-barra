"use client";

import { Outlines } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { Group } from "three";
import { CAP_LIFETIME, nextCap, SPAWN_EVERY, type Power } from "@/game/powerups";
import { BALL } from "@/game/table";
import type { BallHandle } from "./Ball";
import { INK, OUTLINE_PX, toonGradient } from "./toon";

/** Each power's cap colour, the colour of its emblem, and how the emblem is drawn. */
export const CAP_STYLE: Record<Power, { cap: string; mark: string }> = {
  fuego: { cap: "#e06f1f", mark: "#f2b632" },
  turbo: { cap: "#f2b632", mark: "#1b1410" },
  oxido: { cap: "#8a4b2a", mark: "#d9a06c" },
  hielo: { cap: "#9fd8f0", mark: "#f6ead0" },
};

const CAP_R = 0.016;
/** The ball takes the cap when their centres are this close on the table. */
const TOUCH = CAP_R + BALL.radius;

interface Cap {
  power: Power;
  x: number;
  z: number;
  born: number;
}

/**
 * Drops a bottle cap on the field every so often while `running`; when the
 * ball rolls over it, reports which power was taken. Game time only advances
 * while running, so caps don't pile up during goals and menus.
 */
export function PowerField({
  running,
  ballRef,
  onTake,
  capOutRef,
  mirror,
}: {
  running: boolean;
  ballRef: RefObject<BallHandle | null>;
  onTake: (power: Power) => void;
  /** The cap on the table, written every frame for the online host to send. */
  capOutRef?: RefObject<{ power: Power; x: number; z: number } | null>;
  /** Online guest: show this cap instead of running the drops. */
  mirror?: { power: Power; x: number; z: number } | null;
}) {
  const clock = useRef(0);
  const nextAt = useRef(SPAWN_EVERY * 0.6);
  const [cap, setCap] = useState<Cap | null>(null);
  const capRef = useRef<Cap | null>(null);
  const group = useRef<Group>(null);

  const place = (c: Cap | null) => {
    capRef.current = c;
    setCap(c);
  };

  // Development only: lets a test drop a cap anywhere.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __cap?: unknown }).__cap = (power: Power, x: number, z: number) => {
      capRef.current = { power, x, z, born: clock.current };
      setCap(capRef.current);
    };
  }, []);

  useFrame((_, dt) => {
    if (capOutRef) capOutRef.current = capRef.current;
    if (mirror !== undefined) {
      const g = group.current;
      if (g) {
        clock.current += dt;
        g.position.y = 0.012 + Math.sin(clock.current * 5) * 0.003;
        g.rotation.y = clock.current * 2.4;
      }
      return;
    }
    if (!running) return;
    clock.current += Math.min(dt, 0.1);
    const now = clock.current;
    const c = capRef.current;

    if (!c && now >= nextAt.current) {
      place({ ...nextCap(Math.random), born: now });
      return;
    }
    if (!c) return;

    if (now - c.born > CAP_LIFETIME) {
      place(null);
      nextAt.current = now + SPAWN_EVERY;
      return;
    }
    const b = ballRef.current?.position();
    if (b && Math.hypot(b.x - c.x, b.z - c.z) < TOUCH) {
      place(null);
      nextAt.current = now + SPAWN_EVERY;
      onTake(c.power);
      return;
    }
    // Drop in from above, then bob and spin while it waits.
    const g = group.current;
    if (g) {
      const age = now - c.born;
      const drop = Math.max(0, 1 - age / 0.4);
      g.position.y = 0.012 + drop * drop * 0.25 + Math.sin(age * 5) * 0.003;
      g.rotation.y = age * 2.4;
      // Blink during its last two seconds.
      g.visible = CAP_LIFETIME - age > 2 || Math.floor(age * 8) % 2 === 0;
    }
  });

  const shown = mirror !== undefined ? mirror : cap;
  if (!shown) return null;
  return (
    <group ref={group} position={[shown.x, mirror !== undefined ? 0.012 : 0.25, shown.z]}>
      <CapModel power={shown.power} />
    </group>
  );
}

/** A crimped bottle cap standing on edge, with its power's emblem painted on both faces. */
function CapModel({ power }: { power: Power }) {
  const grad = toonGradient();
  const s = CAP_STYLE[power];
  return (
    <group rotation-x={Math.PI / 2}>
      <mesh>
        <cylinderGeometry args={[CAP_R, CAP_R * 1.05, 0.006, 21]} />
        <meshToonMaterial color={s.cap} gradientMap={grad} emissive={s.cap} emissiveIntensity={0.25} />
        <Outlines thickness={OUTLINE_PX} color={INK} />
      </mesh>
      {[1, -1].map((side) => (
        <group key={side} position={[0, side * 0.0032, 0]} rotation-x={side === 1 ? 0 : Math.PI}>
          <Emblem power={power} color={s.mark} />
        </group>
      ))}
    </group>
  );
}

function Emblem({ power, color }: { power: Power; color: string }) {
  const m = <meshBasicMaterial color={color} toneMapped={false} />;
  switch (power) {
    case "fuego":
      return (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.0005, 0]}>
          <circleGeometry args={[CAP_R * 0.55, 3]} />
          {m}
        </mesh>
      );
    case "turbo":
      return (
        <group position={[0, 0.0005, 0]}>
          {[-0.004, 0.004].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation-x={-Math.PI / 2} rotation-z={-Math.PI / 2}>
              <circleGeometry args={[CAP_R * 0.4, 3]} />
              {m}
            </mesh>
          ))}
        </group>
      );
    case "oxido":
      return (
        <group position={[0, 0.0005, 0]}>
          {[
            [-0.004, -0.003, 0.0035],
            [0.005, 0.002, 0.003],
            [-0.001, 0.006, 0.0025],
          ].map(([x, z, r], i) => (
            <mesh key={i} position={[x, 0, z]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[r, 10]} />
              {m}
            </mesh>
          ))}
        </group>
      );
    case "hielo":
      return (
        <group position={[0, 0.0005, 0]} rotation-x={-Math.PI / 2}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation-z={(i * Math.PI) / 3}>
              <planeGeometry args={[CAP_R * 1.2, 0.0022]} />
              {m}
            </mesh>
          ))}
        </group>
      );
  }
}
