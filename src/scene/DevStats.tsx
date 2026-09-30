"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useAfterPhysicsStep, useBeforePhysicsStep } from "@react-three/rapier";
import { useEffect, useRef } from "react";

/**
 * Development only: exposes draw calls and how long each frame's JavaScript
 * takes (physics, rods, bot, React), so performance can be checked from a test.
 */
export function DevStats() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const times = useRef<number[]>([]);
  const started = useRef(0);
  const physicsStart = useRef(0);
  const physicsFrame = useRef(0);
  const physics = useRef<number[]>([]);
  useFrame(() => {
    started.current = performance.now();
    physics.current.push(physicsFrame.current);
    if (physics.current.length > 240) physics.current.shift();
    physicsFrame.current = 0;
  }, -1000);
  // Physics time per frame: every step's before-callbacks, the solver and after-callbacks.
  useBeforePhysicsStep(() => {
    physicsStart.current = performance.now();
  });
  useAfterPhysicsStep(() => {
    physicsFrame.current += performance.now() - physicsStart.current;
  });
  // Time the whole frame, physics through rendering, by wrapping the render call.
  useEffect(() => {
    const render = gl.render.bind(gl);
    gl.render = (...args: Parameters<typeof render>) => {
      render(...args);
      times.current.push(performance.now() - started.current);
      if (times.current.length > 240) times.current.shift();
    };
    return () => {
      gl.render = render;
    };
  }, [gl]);
  useEffect(() => {
    (window as unknown as { __stats?: unknown }).__stats = () => {
      const t = [...times.current].sort((a, b) => a - b);
      const byParent: Record<string, number> = {};
      scene.traverseVisible((o) => {
        if (!(o as { isMesh?: boolean }).isMesh) return;
        let p = o.parent;
        let path = o.type;
        for (let k = 0; k < 3 && p; k++, p = p.parent) path = (p.name || p.type) + ">" + path;
        byParent[path] = (byParent[path] ?? 0) + 1;
      });
      const ph = [...physics.current].sort((a, b) => a - b);
      return { byParent, physicsMedianMs: +(ph[ph.length >> 1] ?? 0).toFixed(2), physicsP95Ms: +(ph[Math.floor(ph.length * 0.95)] ?? 0).toFixed(2), calls: gl.info.render.calls, triangles: gl.info.render.triangles, frameJsMedianMs: +(t[t.length >> 1] ?? 0).toFixed(2), frameJsP95Ms: +(t[Math.floor(t.length * 0.95)] ?? 0).toFixed(2) };
    };
  }, [gl, scene]);
  return null;
}
