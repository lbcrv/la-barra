"use client";

import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import { Plane, Vector3 } from "three";
import { FIELD } from "@/game/table";

const FIELD_PLANE = new Plane(new Vector3(0, 1, 0), 0);
const hit = new Vector3();

/**
 * Turns the mouse or finger into a point on the field. While `aimingRef` is on,
 * every frame reports how far across the table it points.
 */
export function Aim({ aimingRef, onAim }: { aimingRef: RefObject<boolean>; onAim: (z: number) => void }) {
  useFrame(({ raycaster, pointer, camera }) => {
    if (!aimingRef.current) return;
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(FIELD_PLANE, hit)) return;
    onAim(Math.max(-FIELD.width / 2, Math.min(FIELD.width / 2, hit.z)));
  });
  return null;
}
