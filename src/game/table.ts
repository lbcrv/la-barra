/**
 * A real table football table, in metres. Physics runs in these units, so
 * the ball bounces and rolls like the real thing.
 *
 * Axes: x runs along the table from red's goal (-x) to blue's goal (+x),
 * z runs across it toward the camera (+z), y is up. The playing surface is y = 0.
 */
export const FIELD = { length: 1.2, width: 0.68 };

export const WALL = { height: 0.1, thickness: 0.035 };

/**
 * The mouth of each goal, cut into the short walls, and the pocket behind it
 * (kept inside the cabinet rim, open on top under its net). The pocket's floor
 * sits below the field so a ball that goes in stays in.
 */
export const GOAL = { width: 0.2, height: 0.075, depth: 0.06, floor: -0.03 };

export const BALL = {
  radius: 0.0175,
  /** A hard cork ball, about 20 g. */
  mass: 0.02,
  restitution: 0.55,
  friction: 0.25,
  /** Rolling on painted wood slowly bleeds speed. */
  damping: 0.35,
  /** Spin fades fast, so an accidental backspin can't roll a shot back to the kicker. */
  spinDamping: 1.5,
};

/**
 * An invisible lid level with the top of the walls. A hard hit can pop the
 * ball up; on a real table it sometimes flies out, in the game that would only
 * annoy. Level with the painted walls, a ball in the air never even looks as
 * if it is leaving, and with the steel rods in the way it can't fly over them.
 */
export const LID_Y = WALL.height;

/** The wooden cabinet around the field, and the legs it stands on. */
export const CABINET = { rim: 0.07, depth: 0.2, legHeight: 0.62, legSize: 0.07 };

/**
 * Physics steps per second. A full-power kick turns the rod at about 60 rad/s;
 * at this rate the boot moves under 1 cm per step and meets the ball face on.
 * At 360 Hz (1.2 cm a step) shots glanced off the boot, weak and sideways, and
 * stopped scoring, so this stays at 480. It costs well under a millisecond a frame.
 */
export const PHYSICS_HZ = 480;

/** Where the ball comes in: the serving hole on the near side wall, at midfield. */
export const SERVE = { x: 0, z: FIELD.width / 2 - 0.04, height: 0.05, speed: 0.9 };
