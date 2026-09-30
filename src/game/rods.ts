import { FIELD } from "./table";
import type { Side } from "./teams";

/** Height of the rod axis above the field; the players hang from it. */
export const ROD_Y = 0.078;

/** The painted wooden player, measured from the rod axis. */
export const MAN = {
  /** From the rod down to the bottom of the foot, which just clears the field. */
  reach: ROD_Y - 0.004,
  /** Front-to-back thickness of the legs and foot (along x). */
  thick: 0.02,
  /** Shoulder width (along z), and the foot, a little wider to hit the ball square. */
  width: 0.026,
  footWidth: 0.03,
  footHeight: 0.026,
  /** Head and torso above the rod. */
  above: 0.045,
};

export interface RodSpec {
  id: number;
  team: Side;
  /** Position along the table. */
  x: number;
  role: "goalie" | "defence" | "midfield" | "attack";
  men: number;
  /** Distance between neighbouring players on the rod. */
  spacing: number;
  /** How far the rod slides each way from centre before the bumpers stop it. */
  travel: number;
}

const SPACING = { goalie: 0, defence: 0.24, midfield: 0.12, attack: 0.185 } as const;
const MEN = { goalie: 1, defence: 2, midfield: 5, attack: 3 } as const;

/** Travel that lets the outer players just reach the side walls. */
function travelFor(role: RodSpec["role"]): number {
  if (role === "goalie") return 0.12; // bumpers keep the keeper near the goal
  const spread = (MEN[role] - 1) * SPACING[role];
  return (FIELD.width - spread - MAN.footWidth) / 2 - 0.004;
}

/** The standard eight-rod layout, from red's goal (-x) to blue's goal (+x). */
const LAYOUT: [Side, RodSpec["role"]][] = [
  ["red", "goalie"],
  ["red", "defence"],
  ["blue", "attack"],
  ["red", "midfield"],
  ["blue", "midfield"],
  ["red", "attack"],
  ["blue", "defence"],
  ["blue", "goalie"],
];

const GAP = FIELD.length / LAYOUT.length;

export const RODS: RodSpec[] = LAYOUT.map(([team, role], id) => ({
  id,
  team,
  role,
  x: -FIELD.length / 2 + GAP / 2 + id * GAP,
  men: MEN[role],
  spacing: SPACING[role],
  travel: travelFor(role),
}));

/** Where each player sits along the rod, relative to the rod's centre. */
export function manOffsets(rod: RodSpec): number[] {
  const first = (-(rod.men - 1) * rod.spacing) / 2;
  return Array.from({ length: rod.men }, (_, i) => first + i * rod.spacing);
}

export function clampSlide(rod: RodSpec, slide: number): number {
  return Math.max(-rod.travel, Math.min(rod.travel, slide));
}

/**
 * The slide that puts one of the rod's players as close as it can get to `z`
 * across the table. With several players, whichever can reach it best is used.
 */
export function slideToward(rod: RodSpec, z: number): number {
  let best = 0;
  let bestMiss = Infinity;
  for (const offset of manOffsets(rod)) {
    const slide = clampSlide(rod, z - offset);
    const miss = Math.abs(slide + offset - z);
    if (miss < bestMiss - 1e-9) {
      best = slide;
      bestMiss = miss;
    }
  }
  return best;
}

/** The direction a team attacks along x: red toward blue's goal at +x. */
export const attackDir = (team: Side): 1 | -1 => (team === "red" ? 1 : -1);

/**
 * The rod of `team` that should kick: the one nearest the ball along the table.
 * The current rod keeps control until another is clearly nearer, so control
 * doesn't flicker when the ball sits between two rods.
 */
export function activeRod(team: Side, ballX: number, current: number | null, hysteresis = 0.02): number {
  const own = RODS.filter((r) => r.team === team);
  const nearest = own.reduce((a, b) => (Math.abs(b.x - ballX) < Math.abs(a.x - ballX) ? b : a));
  if (current === null) return nearest.id;
  const cur = RODS[current];
  if (cur.team !== team) return nearest.id;
  return Math.abs(nearest.x - ballX) < Math.abs(cur.x - ballX) - hysteresis ? nearest.id : current;
}
