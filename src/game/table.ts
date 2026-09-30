/**
 * A real table football table, in metres. Physics runs in these units, so
 * the ball bounces and rolls like the real thing.
 *
 * Axes: x runs along the table from red's goal (-x) to blue's goal (+x),
 * z runs across it toward the camera (+z), y is up. The playing surface is y = 0.
 */
export const FIELD = { length: 1.2, width: 0.68 };

export const WALL = { height: 0.1, thickness: 0.035 };

/** The mouth of each goal, cut into the short walls, and the pocket behind it (kept inside the cabinet rim). */
export const GOAL = { width: 0.2, height: 0.075, depth: 0.06 };

export const BALL = {
  radius: 0.0175,
  /** A hard cork ball, about 20 g. */
  mass: 0.02,
  restitution: 0.55,
  friction: 0.25,
  /** Rolling on painted wood slowly bleeds speed. */
  damping: 0.35,
};

/** The wooden cabinet around the field, and the legs it stands on. */
export const CABINET = { rim: 0.07, depth: 0.2, legHeight: 0.62, legSize: 0.07 };

/** Where the ball comes in: the serving hole on the near side wall, at midfield. */
export const SERVE = { x: 0, z: FIELD.width / 2 - 0.04, height: 0.05, speed: 0.9 };
