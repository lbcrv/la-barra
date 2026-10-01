import { RODS } from "./rods";
import type { Side } from "./teams";

/**
 * Power-ups drop onto the field as a bottle cap. The ball touching it hands the
 * power to whichever side kicked the ball last. Each one changes the ball or
 * the rods for a few seconds; none of them scores on its own.
 *
 * fuego: the taker's kicks leave the boot 60% faster.
 * turbo: the taker's rods slide twice as fast.
 * oxido: the other side's rods rust and slide at half speed.
 * hielo: the field freezes for everyone; the ball barely slows down.
 */
export type Power = "fuego" | "turbo" | "oxido" | "hielo";

export const POWERS: Power[] = ["fuego", "turbo", "oxido", "hielo"];

/** Seconds each power lasts. */
export const DURATION: Record<Power, number> = { fuego: 8, turbo: 7, oxido: 6, hielo: 7 };

/** Seconds of play between one cap and the next, and how long an untouched cap stays. */
export const SPAWN_EVERY = 11;
export const CAP_LIFETIME = 9;

/** Caps land where rallies happen: away from the goals and the walls. */
export const SPAWN_AREA = { x: 0.36, z: 0.24 };

export interface ActivePower {
  power: Power;
  /** The side that took it. */
  side: Side;
  /** Game time (seconds) when it wears off. */
  until: number;
}

export interface Effects {
  /** Multiplier on each side's rod speed. */
  rodSpeed: Record<Side, number>;
  /** Multiplier on the ball's speed right after each side kicks it. */
  kickBoost: Record<Side, number>;
  /** Ball linear damping multiplier: low on ice. */
  ballDamping: number;
}

const other = (s: Side): Side => (s === "red" ? "blue" : "red");

/** What the powers in play add up to right now. Expired ones are ignored. */
export function effects(active: readonly ActivePower[], now: number): Effects {
  const e: Effects = { rodSpeed: { red: 1, blue: 1 }, kickBoost: { red: 1, blue: 1 }, ballDamping: 1 };
  for (const a of active) {
    if (a.until <= now) continue;
    switch (a.power) {
      case "fuego":
        e.kickBoost[a.side] = 1.6;
        break;
      case "turbo":
        e.rodSpeed[a.side] *= 2;
        break;
      case "oxido":
        e.rodSpeed[other(a.side)] *= 0.5;
        break;
      case "hielo":
        e.ballDamping = 0.15;
        break;
    }
  }
  return e;
}

/**
 * Adds a freshly taken power. Taking one that is already running restarts its
 * clock for the new taker instead of stacking.
 */
export function take(active: readonly ActivePower[], power: Power, side: Side, now: number): ActivePower[] {
  return [...active.filter((a) => a.until > now && a.power !== power), { power, side, until: now + DURATION[power] }];
}

/**
 * The open lanes where a cap can land: halfway between two neighbouring rods,
 * inside the rally area, so it never drops through a player or sits inside one.
 */
export const CAP_LANES: number[] = RODS.slice(1)
  .map((rod, i) => (rod.x + RODS[i].x) / 2)
  .filter((x) => Math.abs(x) <= SPAWN_AREA.x);

/** Picks the next cap's power and spot from a random source. */
export function nextCap(random: () => number): { power: Power; x: number; z: number } {
  return {
    power: POWERS[Math.floor(random() * POWERS.length) % POWERS.length],
    x: CAP_LANES[Math.floor(random() * CAP_LANES.length) % CAP_LANES.length],
    z: (random() * 2 - 1) * SPAWN_AREA.z,
  };
}

/** Which side kicked a ball now moving with velocity `vx` along the table. */
export const kickerOf = (vx: number): Side => (vx >= 0 ? "red" : "blue");
