import type { Side } from "./teams";

/**
 * What one side is asking its rods to do this instant. The mouse, the keyboard
 * and, later, the bot all write here; the rods read it every physics step.
 */
export interface TeamInput {
  /** Where across the table the player is pointing, or null when steering by keys. */
  pointerZ: number | null;
  /** Keys held: -1 slides toward the far side, 1 toward the near side. */
  keyDir: -1 | 0 | 1;
  /** Kick button held. */
  kick: boolean;
}

export type Inputs = Record<Side, TeamInput>;

export const idleInputs = (): Inputs => ({
  red: { pointerZ: null, keyDir: 0, kick: false },
  blue: { pointerZ: null, keyDir: 0, kick: false },
});

/** Top speed of a rod sliding in its bearings, in m/s. Fast, but not instant. */
export const ROD_SPEED = 2.4;
/** Slide speed while a key is held. */
export const KEY_SPEED = 0.9;
