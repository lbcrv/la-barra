import type { TeamInput } from "./input";
import { activeRod, attackDir, MAN, manOffsets, RODS } from "./rods";
import { BALL, FIELD } from "./table";
import type { Side } from "./teams";

export type Level = "easy" | "normal" | "hard";

export interface BallState {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

/** How each level plays. Slower hands, more error and softer shots make it beatable. */
export const LEVELS: Record<
  Level,
  { reaction: number; error: number; handSpeed: number; hold: [number, number]; kickChance: number }
> = {
  // Seconds between looks at the ball, aim error in metres, how fast it moves its hand,
  // how long it charges a shot (min, max seconds), and how often it takes a chance it sees.
  easy: { reaction: 0.28, error: 0.035, handSpeed: 0.7, hold: [0.05, 0.15], kickChance: 0.55 },
  normal: { reaction: 0.16, error: 0.018, handSpeed: 1.3, hold: [0.1, 0.3], kickChance: 0.8 },
  hard: { reaction: 0.08, error: 0.007, handSpeed: 2.2, hold: [0.25, 0.45], kickChance: 0.97 },
};

/** The ball stays this far from the side walls. */
const Z_LIMIT = FIELD.width / 2 - BALL.radius;

/**
 * Where across the table the ball will be after `t` seconds, bouncing off the
 * side walls. Unfolds the path into a straight line and folds it back.
 */
export function predictZ(z: number, vz: number, t: number): number {
  const span = 2 * Z_LIMIT;
  let p = (z + Z_LIMIT + vz * t) % (2 * span);
  if (p < 0) p += 2 * span;
  const folded = p > span ? 2 * span - p : p;
  return folded - Z_LIMIT;
}

/** The aim error is rolled again once the ball has moved this far (m). */
const REROLL_AFTER = 0.05;
/** Below this speed (m/s) a ball near the bot's rod counts as under control. */
const SETTLED_SPEED = 0.15;

/**
 * How close in front of a boot the ball must be, along the attack, for a kick
 * to land. The boot swings up to about 6 cm forward before it clears the ball;
 * a shorter reach left balls sitting just out of it that the bot never kicked.
 */
export const REACH = { min: -0.004, max: 0.06 };
/** How well a player must line up with the ball across the table. */
const ALIGN = MAN.footWidth / 2 + BALL.radius * 0.6;

/**
 * A table football opponent. It looks at the ball every so often (slower on
 * easier levels), guesses where the ball will cross its rods, slides its
 * players there with some error, and kicks when the ball sits in front of a
 * boot. It writes to the same input the keyboard and mouse use, so its rods
 * obey the same physics and speed limits as a person's.
 */
export class Bot {
  private since = Infinity;
  private target = 0;
  private hand = 0;
  private holding = 0;
  private holdFor = 0;
  private active: number | null = null;
  // The aim error sticks until the ball really moves, like a hand that is
  // simply a bit off; re-rolling it at every look made the rod tremble.
  private error = 0;
  private errorAt: { x: number; z: number } | null = null;
  readonly input: TeamInput = { pointerZ: 0, keyDir: 0, kick: false };

  constructor(
    readonly team: Side,
    readonly level: Level,
    private readonly random: () => number = Math.random,
  ) {}

  /** One decision step. `slides` are the current rod positions, indexed like RODS. */
  think(ball: BallState | null, slides: readonly number[], dt: number): TeamInput {
    const cfg = LEVELS[this.level];
    this.since += dt;

    if (!ball) {
      this.target = 0;
    } else if (this.since >= cfg.reaction) {
      this.since = 0;
      const moved = !this.errorAt || Math.hypot(ball.x - this.errorAt.x, ball.z - this.errorAt.z) > REROLL_AFTER;
      if (moved) {
        this.error = (this.random() * 2 - 1) * cfg.error;
        this.errorAt = { x: ball.x, z: ball.z };
      }
      // A slow ball within reach gets a steadier hand: that's when a player traps and aims.
      const settled = Math.hypot(ball.vx, ball.vz) < SETTLED_SPEED && this.nearOwnRod(ball.x);
      this.target = this.aim(ball) + this.error * (settled ? 0.25 : 1);
    }

    // The hand moves toward the target at a human speed, not instantly.
    const step = cfg.handSpeed * dt;
    this.hand += Math.max(-step, Math.min(step, this.target - this.hand));
    this.input.pointerZ = this.hand;

    this.input.kick = ball ? this.kick(ball, slides, dt) : false;
    return this.input;
  }

  /**
   * Where to put the players across the table: where the ball will be when it
   * reaches the rod in front of it, or right on it when it is slow or close.
   */
  private aim(ball: BallState): number {
    const dir = attackDir(this.team);
    const own = RODS.filter((r) => r.team === this.team);
    // The first of our rods the ball will meet, travelling the way it goes.
    const heading = Math.sign(ball.vx) || -dir;
    const ahead = own
      .filter((r) => (r.x - ball.x) * heading > 0)
      .sort((a, b) => Math.abs(a.x - ball.x) - Math.abs(b.x - ball.x))[0];
    if (!ahead || Math.abs(ball.vx) < 0.05) return ball.z;
    const t = (ahead.x - ball.x) / ball.vx;
    return predictZ(ball.z, ball.vz, Math.min(t, 1.5));
  }

  private nearOwnRod(x: number): boolean {
    return RODS.some((r) => r.team === this.team && Math.abs(r.x - x) < 0.06);
  }

  /** Holds the button while charging, releases to strike, and decides when a chance is on. */
  private kick(ball: BallState, slides: readonly number[], dt: number): boolean {
    const cfg = LEVELS[this.level];
    this.active = activeRod(this.team, ball.x, this.active);

    if (this.holding > 0) {
      this.holding += dt;
      if (this.holding < this.holdFor) return true;
      this.holding = 0;
      return false;
    }

    const rod = RODS[this.active];
    const ahead = (ball.x - rod.x) * attackDir(this.team);
    const lined = manOffsets(rod).some((o) => Math.abs(slides[rod.id] + o - ball.z) < ALIGN);
    if (ahead < REACH.min || ahead > REACH.max || !lined) return false;
    // Not every chance is taken, and the decision is made once per look.
    if (this.since !== 0 || this.random() > cfg.kickChance) return false;

    const [lo, hi] = cfg.hold;
    this.holdFor = lo + this.random() * (hi - lo);
    this.holding = dt;
    return true;
  }
}
