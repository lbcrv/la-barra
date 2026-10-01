import { BALL, FIELD, GOAL, LID_Y, WALL } from "./table";

type Vec = { x: number; y: number; z: number };

/**
 * How far past a wall the ball's centre may be before it counts as gone
 * through it. Ordinary contacts sink in well under this.
 */
const SLACK = 0.004;
/** Speed kept, turned back inward, when the ball is put back. */
const BOUNCE = 0.5;

/**
 * The space the ball's centre may occupy: the field under the lid, plus the
 * goal mouths and the pockets behind them.
 */
function bounds(p: Vec) {
  const r = BALL.radius;
  const HL = FIELD.length / 2;
  const mouth = Math.abs(p.z) < GOAL.width / 2 && p.y < GOAL.height + r;
  const past = Math.abs(p.x) > HL;
  return {
    x: mouth ? HL + WALL.thickness + GOAL.depth - r : HL - r,
    z: past && mouth ? GOAL.width / 2 - r : FIELD.width / 2 - r,
    top: past ? GOAL.height - r : LID_Y - r,
    bottom: past ? GOAL.floor + r : r,
  };
}

/**
 * A ball driven into a wall, the lid or the field by a hard hit, the kind of
 * squeeze between a kicking boot and the wood that a physics step can lose,
 * goes back inside, bouncing off whatever it went through. Returns the
 * corrected position and velocity, or null when the ball is where it should be.
 */
export function keepInside(p: Vec, v: Vec): { p: Vec; v: Vec } | null {
  const b = bounds(p);
  const np = { ...p };
  const nv = { ...v };
  let moved = false;
  for (const axis of ["x", "z"] as const) {
    const limit = b[axis];
    if (Math.abs(p[axis]) > limit + SLACK) {
      const s = Math.sign(p[axis]);
      np[axis] = s * limit;
      nv[axis] = -s * Math.abs(v[axis]) * BOUNCE;
      moved = true;
    }
  }
  if (p.y > b.top + SLACK) {
    np.y = b.top;
    nv.y = -Math.abs(v.y) * BOUNCE;
    moved = true;
  } else if (p.y < b.bottom - SLACK) {
    np.y = b.bottom;
    nv.y = Math.abs(v.y) * BOUNCE;
    moved = true;
  }
  return moved ? { p: np, v: nv } : null;
}
