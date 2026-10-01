import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MAN } from "@/game/rods";
import { seeded } from "./toon";

const SKIN = ["#f0c090", "#d9a06c", "#b77b4b", "#8d5a34", "#6b4226"];
const HAIR = ["#1b1410", "#2c1d14", "#4a2e1c", "#8a8a88"];
type Hair = "short" | "bald" | "afro" | "spiky" | "cap";
const STYLES: Hair[] = ["short", "short", "afro", "spiky", "bald", "cap"];
const EYE_WHITE = "#fffaf0";
const INK = "#1b1410";
const BOOT = "#3a2416";

export interface Look {
  skin: string;
  hair: string;
  style: Hair;
  mustache: boolean;
}

/** A player's look, picked once from a seed so the team is a crowd, not clones. */
export function lookFor(seed: number): Look {
  const r = seeded(seed * 7919 + 13);
  return {
    skin: SKIN[Math.floor(r() * SKIN.length)],
    hair: HAIR[Math.floor(r() * HAIR.length)],
    style: STYLES[Math.floor(r() * STYLES.length)],
    mustache: r() < 0.3,
  };
}

/**
 * A rod's players, merged into three meshes: everything above the waist (which
 * squashes and stretches), the eyes and brows (flat colour, no outline), and
 * the legs and boots (which never stretch, so they can't dip into the field).
 * Colours live in the vertices. Three draw calls per rod instead of about
 * thirty per player.
 */
export interface RodFigures {
  upper: BufferGeometry;
  face: BufferGeometry;
  lower: BufferGeometry;
}

type Part = [geometry: BufferGeometry, color: string, position: [number, number, number], rotation?: [number, number, number], scale?: [number, number, number]];

const m = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const c = new Color();

/** Moves a part into place and paints it with its vertex colour. */
function place([geo, color, pos, rot = [0, 0, 0], scl = [1, 1, 1]]: Part): BufferGeometry {
  const g = geo;
  m.compose(new Vector3(...pos), q.setFromEuler(e.set(...rot)), new Vector3(...scl));
  g.applyMatrix4(m);
  // Color.set already converts from sRGB to the renderer's linear space.
  c.set(color);
  const n = g.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  // Only position, normal and colour are needed; dropping uv keeps every part mergeable.
  g.deleteAttribute("uv");
  return g;
}

/** One player's parts, split by section, at `z` along the rod, facing `f` (+1 toward +x). */
function playerParts(z: number, f: 1 | -1, jersey: string, shorts: string, look: Look) {
  const upper: Part[] = [];
  const face: Part[] = [];
  const lower: Part[] = [];
  const headY = 0.044;
  const headR = 0.018;
  const legTop = -0.026;
  const bootY = -MAN.reach + 0.006;

  // Jersey barrel and arms.
  upper.push([new CapsuleGeometry(0.0145, 0.018, 4, 12), jersey, [0, 0.004, z]]);
  for (const s of [-1, 1]) {
    upper.push([new CapsuleGeometry(0.0055, 0.014, 3, 8), jersey, [0, 0.002, z + s * 0.019]]);
    upper.push([new SphereGeometry(0.0055, 8, 6), look.skin, [f * 0.002, -0.012, z + s * 0.019]]);
  }
  // Big head.
  upper.push([new SphereGeometry(headR, 18, 12), look.skin, [0, headY, z]]);

  // Hair.
  switch (look.style) {
    case "afro":
      upper.push([new SphereGeometry(headR * 1.18, 14, 10), look.hair, [-f * 0.002, headY + 0.008, z], undefined, [1, 0.85, 1]]);
      break;
    case "spiky":
      for (const dz of [-0.008, 0, 0.008]) {
        upper.push([new ConeGeometry(0.006, 0.014, 5), look.hair, [-f * 0.003, headY + headR * 0.75 + 0.004, z + dz], [dz * 30, 0, f * 0.3]]);
      }
      upper.push([new SphereGeometry(headR * 1.03, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), look.hair, [-f * 0.002, headY + 0.002, z]]);
      break;
    case "cap":
      upper.push([new SphereGeometry(headR * 1.04, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), jersey, [0, headY + headR * 0.3, z], undefined, [1, 0.75, 1]]);
      upper.push([new CylinderGeometry(0.011, 0.011, 0.003, 12, 1, false, 0, Math.PI), jersey, [f * headR * 0.85, headY + headR * 0.4, z], [0, f === 1 ? -Math.PI / 2 : Math.PI / 2, 0]]);
      break;
    case "short":
      upper.push([new SphereGeometry(headR * 1.04, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), look.hair, [-f * 0.002, headY + 0.003, z], undefined, [1, 0.8, 1]]);
      break;
    case "bald":
      break;
  }

  // Eyes looking at the opponent's goal, and eyebrows set low: they mean business.
  for (const s of [-1, 1]) {
    const ez = z + s * 0.0065;
    face.push([new SphereGeometry(0.0048, 10, 8), EYE_WHITE, [f * headR * 0.82, headY + 0.003, ez]]);
    face.push([new SphereGeometry(0.0024, 8, 6), INK, [f * (headR * 0.82 + 0.0032), headY + 0.003, ez]]);
    face.push([new BoxGeometry(0.002, 0.0016, 0.0075), INK, [f * (headR * 0.82 + 0.001), headY + 0.0092, ez], [s * f * 0.35, 0, 0]]);
  }
  if (look.mustache) face.push([new BoxGeometry(0.003, 0.003, 0.012), look.hair, [f * headR * 0.92, headY - 0.006, z]]);

  // Shorts, legs, socks in team colour, and small boots pointing at the opponent.
  lower.push([new BoxGeometry(MAN.thick + 0.004, 0.014, MAN.width + 0.004), shorts, [0, -0.021, z]]);
  const legLen = bootY - legTop;
  for (const s of [-1, 1]) {
    const lz = z + s * 0.0065;
    lower.push([new CapsuleGeometry(0.0045, Math.max(0.001, -legLen - 0.009), 3, 8), look.skin, [0, legTop + legLen / 2, lz]]);
    lower.push([new CylinderGeometry(0.0052, 0.0052, 0.01, 8), jersey, [0, bootY + 0.011, lz]]);
    lower.push([new CapsuleGeometry(0.0055, 0.012, 3, 8), BOOT, [f * 0.004, bootY, lz], [0, 0, Math.PI / 2]]);
  }

  // Draw the figure at its size: the body shrinks toward the waist, so it still
  // meets the shorts, and the legs only get thinner, since their length is set
  // by the rod's height above the field.
  const k = MAN.figure;
  const waist = -0.02;
  const shrink =
    (keepHeight: boolean) =>
    ([geo, color, [x, y, pz], rot, [sx, sy, sz] = [1, 1, 1]]: Part): Part => [
      geo,
      color,
      [x * k, keepHeight ? y : waist + (y - waist) * k, z + (pz - z) * k],
      rot,
      [sx * k, keepHeight ? sy : sy * k, sz * k],
    ];
  return { upper: upper.map(shrink(false)), face: face.map(shrink(false)), lower: lower.map(shrink(true)) };
}

/** Builds a whole rod's players as three merged meshes. */
export function rodFigures(offsets: number[], facing: 1 | -1, jersey: string, shorts: string, looks: Look[]): RodFigures {
  const all = offsets.map((z, i) => playerParts(z, facing, jersey, shorts, looks[i]));
  const merge = (key: keyof ReturnType<typeof playerParts>) => {
    const geos = all.flatMap((p) => p[key]).map(place);
    const merged = mergeGeometries(geos, false)!;
    geos.forEach((g) => g.dispose());
    return merged;
  };
  return { upper: merge("upper"), face: merge("face"), lower: merge("lower") };
}
