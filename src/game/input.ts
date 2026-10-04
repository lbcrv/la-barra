import { FIELD } from "./table";
import type { Side } from "./teams";

/**
 * What one side is asking its rods to do this instant. The mouse, the keyboard
 * and, later, the bot all write here; the rods read it every physics step.
 */
export interface TeamInput {
  /**
   * A person's hand on the handles, from -1 (far side) to 1 (near side): every
   * rod of the side sits at that fraction of its travel, like pushing real
   * handles. No player is ever swapped for another, so the rods never jump.
   */
  handle: number | null;
  /** The bot's aim: the point across the table one of its players should reach. */
  pointerZ: number | null;
  /** Keys held: -1 slides toward the far side, 1 toward the near side. */
  keyDir: -1 | 0 | 1;
  /** Kick button held. */
  kick: boolean;
  /**
   * Pass presses so far. A count rather than a held flag: a pass is one tap,
   * and a count can't be lost between two physics steps or two network packets.
   */
  passes: number;
}

export type Inputs = Record<Side, TeamInput>;

export const idleInputs = (): Inputs => ({
  red: { handle: null, pointerZ: null, keyDir: 0, kick: false, passes: 0 },
  blue: { handle: null, pointerZ: null, keyDir: 0, kick: false, passes: 0 },
});

/** Top speed of a rod sliding in its bearings, in m/s. */
export const ROD_SPEED = 3;
/** How fast a held key sweeps the handle across its travel, in full travels per second. */
export const KEY_SWEEP = 2.2;

/**
 * The pointer's reach across the table that maps to the handle's full travel.
 * A little short of the walls, so the ends are easy to get to.
 */
export const AIM_SPAN = FIELD.width / 2 - 0.07;

export const clampHandle = (h: number) => Math.max(-1, Math.min(1, h));

/** Where the pointer, at `z` across the table, puts the handle. */
export const handleFromAim = (z: number) => clampHandle(z / AIM_SPAN);
