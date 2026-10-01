import { FIELD } from "./table";
import type { Side } from "./teams";

/** Height of the rod axis above the field; the players hang from it. */
export const ROD_Y = 0.078;

/** The painted wooden player, measured from the rod axis. */
export const MAN = {
  /** From the rod down to the bottom of the foot, which just clears the field. */
  reach: ROD_Y - 0.004,
  /** Front-to-back thickness of the legs and foot (along x). Kept thick so a fast kick still meets the ball face on. */
  thick: 0.02,
  /**
   * Leg width (along z), and the foot, a little wider to hit the ball square.
   * Slimmer than a real table's men, so a pass between two of them has room.
   */
  width: 0.021,
  footWidth: 0.024,
  footHeight: 0.026,
  /** Head and torso above the rod. */
  above: 0.036,
  /** How big the painted figure is drawn against its original model, to match the slimmer legs. */
  figure: 0.8,
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

/**
 * Nine a side: the midfield has three men instead of a real table's five, so
 * there is room to get the ball past it. They stand wider to cover the field.
 */
const SPACING = { goalie: 0, defence: 0.24, midfield: 0.2, attack: 0.185 } as const;
const MEN = { goalie: 1, defence: 2, midfield: 3, attack: 3 } as const;

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

/** A player this close to the target counts as on it. */
const ON_TARGET = 0.004;

/**
 * The slide that puts one of the rod's players as close as it can get to `z`
 * across the table. Of the players that can reach it, the one needing the
 * shortest move from `from` (where the rod is now) is used. That keeps the rod
 * with the same player while the target moves, instead of jumping a whole
 * player-spacing whenever the target crosses the midpoint between two players,
 * which rocked the rod from side to side around a ball caught between them.
 */
export function slideToward(rod: RodSpec, z: number, from = 0): number {
  let best = 0;
  let bestMiss = Infinity;
  let bestMove = Infinity;
  for (const offset of manOffsets(rod)) {
    const slide = clampSlide(rod, z - offset);
    const miss = Math.abs(slide + offset - z);
    const move = Math.abs(slide - from);
    const reaches = miss < ON_TARGET;
    const bestReaches = bestMiss < ON_TARGET;
    const better = reaches && bestReaches ? move < bestMove - 1e-9 : miss < bestMiss - 1e-9;
    if (better) {
      best = slide;
      bestMiss = miss;
      bestMove = move;
    }
  }
  return best;
}

/** How a rod slides: top speed and how hard a wrist can start and stop it. */
export const SLIDE = {
  /** Time to close the gap to the target, like a hand easing onto it (s). Short: rods should feel direct. */
  settle: 0.016,
  /** Acceleration and braking limit (m/s²): a quick wrist. */
  accel: 140,
};

/** Where a rod sits for a handle position (-1 to 1): the same fraction of its own travel. */
export const handleSlide = (rod: RodSpec, handle: number) => clampSlide(rod, handle * rod.travel);

export interface SlideState {
  x: number;
  v: number;
}

/**
 * One step of a rod sliding toward `target` at up to `maxSpeed`, speeding up
 * and slowing down no faster than a wrist can. Settles on the target without
 * overshooting it. Pure; returns the new state.
 */
export function stepSlide(s: SlideState, target: number, dt: number, maxSpeed: number): SlideState {
  const gap = target - s.x;
  // The speed that closes the gap in `settle` seconds, but no faster than the
  // rod can stop from within the remaining distance.
  const stoppable = Math.sqrt(2 * SLIDE.accel * Math.abs(gap));
  const want = Math.sign(gap) * Math.min(maxSpeed, Math.abs(gap) / SLIDE.settle, stoppable);
  const dv = Math.max(-SLIDE.accel * dt, Math.min(SLIDE.accel * dt, want - s.v));
  let v = s.v + dv;
  let x = s.x + v * dt;
  // Never overshoot, and don't creep forever: land on the target and stop.
  if ((target - x) * gap <= 0 || (Math.abs(target - x) < 1e-5 && Math.abs(v) < 0.01)) {
    x = target;
    v = 0;
  }
  return { x, v };
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

/**
 * Where a boot can play the ball, along the table from its rod: up to 6 cm in
 * front on the swing, and just a hair behind the boot's face. A ball further
 * behind the players can only be shoved sideways, never kicked, so it counts
 * as out of play: counting it as reachable left balls sitting behind a rod
 * for good, with no lean and no new ball.
 */
export const BOOT_REACH = { forward: 0.06, back: 0.004 };
/** A player within this distance across the table can take the ball. */
const TOUCH_ACROSS = 0.02;

/** Whether any player of either team could kick a ball at (x, z) with their rod in the right place. */
export function reachable(x: number, z: number): boolean {
  return RODS.some((rod) => {
    const along = (x - rod.x) * attackDir(rod.team);
    if (along < -BOOT_REACH.back || along > BOOT_REACH.forward) return false;
    return manOffsets(rod).some((o) => Math.abs(clampSlide(rod, z - o) + o - z) < TOUCH_ACROSS);
  });
}

/**
 * The way a ball at (x, z) should roll to get back into play: toward the
 * nearest spot some player can reach, first along the table at the same
 * distance across, and toward the middle if no spot along that line is
 * reachable (a corner beyond the keepers). A unit vector, or null if the
 * ball is already reachable.
 */
export function towardPlay(x: number, z: number): { x: number; z: number } | null {
  if (reachable(x, z)) return null;
  const limit = FIELD.length / 2;
  for (let d = 0.005; d <= 0.2; d += 0.005) {
    for (const s of [-1, 1]) {
      const nx = x + s * d;
      if (Math.abs(nx) < limit && reachable(nx, z)) return { x: s, z: 0 };
    }
  }
  // Nowhere along this line: roll toward the middle of the table.
  const len = Math.hypot(x, z) || 1;
  return { x: -x / len, z: -z / len };
}
