import { attackDir, MAN, manOffsets, RODS, type RodSpec } from "./rods";
import { BALL, FIELD } from "./table";

/**
 * A pass: a soft tap that rolls the ball to a teammate instead of shooting.
 *
 * From any rod but the attack, the ball goes forward to the next rod of the
 * same side, aimed at whichever of its players has the clearest path. That rod
 * lifts its feet so the ball rolls under them, like a real player raising the
 * rod, and traps the ball in front of its boots. On the attack rod there is no
 * rod ahead, so the pass goes sideways to another forward, the classic set-up
 * before a shot.
 */
export const PASS = {
  /** Speed of a forward pass, and of a sideways one along the rod (m/s). */
  speed: 1.1,
  lateralSpeed: 0.7,
  /** Swing speed of the passing tap (rad/s): soft, well under a tapped shot. */
  swing: 10,
  /** The rod angle at which the tap meets the ball and the pass leaves (rad). */
  release: 0.15,
  /** How far the receiving rod lifts its feet, back toward the passer, and how fast (rad, rad/s). */
  lift: -1.35,
  liftSpeed: 20,
  /** Where the receiver traps the ball, in front of its boots, and the window past that (m). */
  trapAhead: 0.036,
  trapWindow: 0.05,
  /** A pass that hasn't arrived after this long has gone astray (s). */
  timeout: 1.2,
};

/** Where a ball sits relative to a rod: how far in front of its boots, along the attack. */
export const aheadOf = (rod: RodSpec, x: number) => (x - rod.x) * attackDir(rod.team);

/** The next rod of the same side toward the opponent's goal, or null from the attack rod. */
export function receiverOf(rod: RodSpec): RodSpec | null {
  const dir = attackDir(rod.team);
  return (
    RODS.filter((r) => r.team === rod.team && (r.x - rod.x) * dir > 0).sort((a, b) => Math.abs(a.x - rod.x) - Math.abs(b.x - rod.x))[0] ??
    null
  );
}

/** Whether one of the rod's players has the ball at its boot, close enough to tap it. */
export function atBoot(rod: RodSpec, slide: number, ball: { x: number; z: number }): boolean {
  const ahead = aheadOf(rod, ball.x);
  if (ahead < -0.01 || ahead > 0.1) return false;
  return manOffsets(rod).some((o) => Math.abs(slide + o - ball.z) < MAN.footWidth / 2 + BALL.radius);
}

export interface PassPlan {
  /** The rod that receives: the next one forward, or the passer's own rod for a sideways pass. */
  receiver: number;
  /** Which of the receiver's players the ball is meant for, by index along the rod. */
  man: number;
  vx: number;
  vz: number;
  lateral: boolean;
}

/** Furthest a player's centre may be from the middle and still take a pass off the wall. */
const Z_LIMIT = FIELD.width / 2 - BALL.radius - 0.005;
/** How much room a path needs past an opponent's foot to count as open (m). */
const OPEN = 0.004;

/**
 * Where to pass from `rod` with the ball at `ball` and the rods at `slides`,
 * or null when there is no one to pass to. Forward passes pick the receiving
 * player whose straight path clears the opponents' feet in between, the
 * nearest such player if several do, and the least blocked one otherwise.
 */
export function planPass(rod: RodSpec, ball: { x: number; z: number }, slides: readonly number[]): PassPlan | null {
  const dir = attackDir(rod.team);
  const target = receiverOf(rod);

  if (!target) {
    // Sideways, to the forward next to the one with the ball.
    const zs = manOffsets(rod).map((o) => slides[rod.id] + o);
    const holder = zs.reduce((best, z, k) => (Math.abs(z - ball.z) < Math.abs(zs[best] - ball.z) ? k : best), 0);
    const options = zs.map((z, k) => ({ z, k })).filter(({ z, k }) => k !== holder && Math.abs(z) <= Z_LIMIT);
    if (options.length === 0) return null;
    const to = options.reduce((a, b) => (Math.abs(b.z - ball.z) < Math.abs(a.z - ball.z) ? b : a));
    return { receiver: rod.id, man: to.k, vx: 0, vz: Math.sign(to.z - ball.z) * PASS.lateralSpeed, lateral: true };
  }

  const tx = target.x + dir * PASS.trapAhead;
  const between = RODS.filter((r) => r.team !== rod.team && (r.x - ball.x) * dir > 0 && (tx - r.x) * dir > 0);
  const reach = MAN.footWidth / 2 + BALL.radius;
  const options = manOffsets(target).map((o, k) => {
    const z = Math.max(-Z_LIMIT, Math.min(Z_LIMIT, slides[target.id] + o));
    let room = Infinity;
    for (const opp of between) {
      const zLine = ball.z + ((opp.x - ball.x) / (tx - ball.x)) * (z - ball.z);
      for (const oo of manOffsets(opp)) room = Math.min(room, Math.abs(zLine - (slides[opp.id] + oo)) - reach);
    }
    return { k, z, room, dz: Math.abs(z - ball.z) };
  });
  const open = options.filter((c) => c.room > OPEN);
  const best = open.length
    ? open.reduce((a, b) => (b.dz < a.dz ? b : a))
    : options.reduce((a, b) => (b.room > a.room ? b : a));
  const dx = tx - ball.x;
  const dz = best.z - ball.z;
  const len = Math.hypot(dx, dz) || 1;
  return { receiver: target.id, man: best.k, vx: (dx / len) * PASS.speed, vz: (dz / len) * PASS.speed, lateral: false };
}
