"use client";

import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import { MOUSE, TOUCH, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CABINET, FIELD, WALL } from "@/game/table";

/** Height of the bulb above the field, and the room colour it fades into. */
const BULB_Y = 0.95;
export const ROOM = "#120e0b";

/**
 * A single bulb under a tin shade hanging over the table, the only light in
 * the shop after hours. Everything else falls off into the dark.
 */
export function Lamp() {
  // Seen from behind the goal on a tall screen, the shade would hang right in
  // front of the far half of the table; there only its light remains.
  const { size } = useThree();
  const showFixture = size.width >= size.height;
  return (
    <group position={[0, BULB_Y, 0]}>
      {/* Cord up into the dark. */}
      <mesh position={[0, 0.6, 0]} visible={showFixture}>
        <cylinderGeometry args={[0.003, 0.003, 1.1, 6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Tin shade, open at the bottom. */}
      <mesh position={[0, 0.03, 0]} castShadow={false} visible={showFixture}>
        <coneGeometry args={[0.16, 0.1, 32, 1, true]} />
        <meshStandardMaterial color="#3d4a3f" metalness={0.6} roughness={0.45} side={2} />
      </mesh>
      <mesh visible={showFixture}>
        <sphereGeometry args={[0.035, 16, 12]} />
        <meshStandardMaterial color="#fff2cc" emissive="#ffd48a" emissiveIntensity={4} />
      </mesh>
      <pointLight
        color="#ffd9a3"
        intensity={3.2}
        distance={0}
        decay={2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-radius={4}
      />
    </group>
  );
}

/** Just enough fill that the dark side of the cabinet isn't pure black. */
export function Fill() {
  return (
    <>
      <hemisphereLight args={["#6b5a48", "#0b0907", 0.35]} />
      <color attach="background" args={[ROOM]} />
    </>
  );
}

/** Looking down at the table from where a player stands, at this angle above horizontal. */
const ELEVATION = (58 * Math.PI) / 180;
/** The camera aims a little below the wall tops, near the middle of the field. */
const TARGET = new Vector3(0, WALL.height / 2 - 0.05, 0.02);

/** Held upright, a phone looks down the table from behind red's goal, steeper. */
const PORTRAIT_ELEVATION = (64 * Math.PI) / 180;

/**
 * Where the camera stands so the whole table fits the screen. Wide screens
 * stand on the near long side, red on the left and blue on the right. Tall
 * screens look from behind red's goal, red at the bottom and blue at the top,
 * which is how a phone is held.
 */
function framing(fovDeg: number, aspect: number) {
  const vfov = (fovDeg * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const portrait = aspect < 1;
  const elevation = portrait ? PORTRAIT_ELEVATION : ELEVATION;
  // Across the screen: the whole cabinet plus a margin. Up the screen: its depth seen at an angle.
  const across = (portrait ? FIELD.width : FIELD.length) + 2 * CABINET.rim + (portrait ? 0.12 : 0.2);
  const along = ((portrait ? FIELD.length : FIELD.width) + 2 * CABINET.rim) * Math.sin(elevation) + 0.25;
  const dist = Math.max(across / 2 / Math.tan(hfov / 2), along / 2 / Math.tan(vfov / 2)) + 0.2;
  const up = TARGET.y + dist * Math.sin(elevation);
  const back = dist * Math.cos(elevation);
  return {
    position: portrait ? new Vector3(TARGET.x - back, up, 0) : new Vector3(0, up, TARGET.z + back),
    target: portrait ? new Vector3(TARGET.x, TARGET.y, 0) : TARGET,
    dist,
  };
}

/** How far the player may pull the camera back, relative to the framed distance. */
const MAX_ZOOM_OUT = 1.35;
/** Never lower than this angle above the table, so the view can't go under the rim. */
const LOWEST_VIEW = (22 * Math.PI) / 180;

/**
 * Frames the table for the screen and lets the player move the camera: right
 * button (or two fingers) orbits, the wheel (or a pinch) zooms. The left button
 * and a single finger stay free for play. `resetKey` changing puts the camera
 * back where it started. The room's fog always sits behind the furthest view.
 */
export function CameraRig({ resetKey }: { resetKey: number }) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const fov = "fov" in camera ? camera.fov : 38;
  const frame = useMemo(() => framing(fov, size.width / size.height), [fov, size.width, size.height]);
  const far = frame.dist * MAX_ZOOM_OUT;

  useLayoutEffect(() => {
    camera.position.copy(frame.position);
    camera.lookAt(frame.target);
    camera.updateProjectionMatrix();
    controls.current?.target.copy(frame.target);
    controls.current?.update();
  }, [camera, frame, resetKey]);

  return (
    <>
      <OrbitControls
        ref={controls}
        makeDefault
        target={frame.target}
        enablePan={false}
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.6}
        zoomSpeed={0.7}
        minDistance={0.6}
        maxDistance={far}
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI / 2 - LOWEST_VIEW}
        // Left button and single finger are left unmapped, which the controls ignore.
        mouseButtons={{ MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
        touches={{ TWO: TOUCH.DOLLY_ROTATE }}
      />
      <fog attach="fog" args={[ROOM, far + 0.4, far + 3.5]} />
    </>
  );
}
