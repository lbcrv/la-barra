import type { Level } from "@/game/bot";
import type { Match } from "@/game/match";
import type { Call } from "@/game/narrator";
import type { Power } from "@/game/powerups";
import type { Side } from "@/game/teams";

/**
 * Online play, peer to peer. The host's browser runs the physics and plays red;
 * the guest plays blue, sends what its hand is doing, and draws what the host
 * sends back. A room is a four-letter code that both players type or share.
 */

/** Letters that can't be mistaken for each other or for digits when read aloud or typed. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 4;

/** Rooms live on the public PeerJS broker, so ids carry a prefix no other app uses. */
const ID_PREFIX = "la-barra-hn-";

export function makeCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length) % ALPHABET.length];
  return code;
}

/** Cleans what a person typed or pasted into a room code, or null if it can't be one. */
export function readCode(input: string): string | null {
  const code = input
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(/[IL]/g, "")
    .replace(/O/g, "");
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((ch) => ALPHABET.includes(ch)) ? code : null;
}

export const peerId = (code: string) => ID_PREFIX + code;

/** How often the host sends the table, per second. */
export const SNAPSHOT_HZ = 30;
/** How far behind the host the guest draws, so there are always two snapshots to blend. */
export const RENDER_DELAY_MS = 90;

/** Everything the guest needs to draw one instant of the table. */
export interface Snapshot {
  /** Host clock, ms. */
  t: number;
  /** Ball position, or null when it is off the table between points. */
  ball: [number, number, number] | null;
  slides: number[];
  angles: number[];
  /** Which rod of each side has the ball, for the glowing handle. */
  active: [number | null, number | null];
  match: Match | null;
  /** Running powers with the seconds they have left. */
  powers: { power: Power; side: Side; left: number }[];
  cap: { power: Power; x: number; z: number } | null;
}

/** What the guest's hand is doing. */
export interface HandInput {
  /** The handle, -1 to 1, or null while steering by keys. */
  z: number | null;
  dir: -1 | 0 | 1;
  kick: boolean;
}

/** Either side asks "are you there?" every second; the answer's delay is the ping. */
export type Ping = { t: "ping"; at: number } | { t: "pong"; at: number };

export type ToHost = { t: "hello" } | { t: "input"; input: HandInput } | { t: "bye" } | Ping;

export type ToGuest =
  | { t: "start"; level: Level }
  | { t: "snap"; s: Snapshot }
  | { t: "goal"; conceded: Side }
  | { t: "fx"; cue: "kick" | "wall" | "power" | "whistle" | "bead" | "goal"; strength: number }
  | { t: "call"; call: Call }
  | { t: "bye" }
  | Ping;

/** How often each side measures the ping, and when a silent link counts as lost (ms). */
export const PING_EVERY_MS = 1000;
export const PING_LOST_MS = 3000;

/** Ping quality for the signal icon: bars lit, out of three. */
export function pingBars(ms: number | null): 0 | 1 | 2 | 3 {
  if (ms === null) return 0;
  if (ms < 80) return 3;
  if (ms < 160) return 2;
  return 1;
}

/** Rounds to 0.1 mm or 0.001 rad: plenty for drawing, and it keeps packets small. */
export const q = (n: number) => Math.round(n * 10000) / 10000;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * Keeps the last few snapshots and blends between the two around the instant
 * being drawn. The guest draws RENDER_DELAY_MS behind the host, so a late or
 * jittery packet doesn't make the ball stutter.
 */
export class SnapshotBuffer {
  private snaps: Snapshot[] = [];
  /** Host time minus local time, from the latest snapshot. */
  private offset: number | null = null;

  push(s: Snapshot, receivedAt: number) {
    if (this.snaps.length && s.t <= this.snaps[this.snaps.length - 1].t) return;
    this.snaps.push(s);
    if (this.snaps.length > 12) this.snaps.shift();
    const offset = s.t - receivedAt;
    // Follow the clock slowly so one late packet doesn't jerk the timeline.
    this.offset = this.offset === null ? offset : this.offset + (offset - this.offset) * 0.1;
  }

  latest(): Snapshot | null {
    return this.snaps[this.snaps.length - 1] ?? null;
  }

  /** The table as it was RENDER_DELAY_MS ago in host time, blended between snapshots. */
  sample(now: number): Snapshot | null {
    if (this.offset === null || this.snaps.length === 0) return null;
    const t = now + this.offset - RENDER_DELAY_MS;
    const snaps = this.snaps;
    if (t <= snaps[0].t) return snaps[0];
    for (let i = 1; i < snaps.length; i++) {
      const a = snaps[i - 1];
      const b = snaps[i];
      if (t <= b.t) {
        const k = (t - a.t) / (b.t - a.t);
        return {
          ...b,
          t,
          // A ball that just appeared or vanished jumps; otherwise it glides.
          ball: a.ball && b.ball ? [lerp(a.ball[0], b.ball[0], k), lerp(a.ball[1], b.ball[1], k), lerp(a.ball[2], b.ball[2], k)] : b.ball,
          slides: b.slides.map((v, j) => lerp(a.slides[j], v, k)),
          angles: b.angles.map((v, j) => lerp(a.angles[j], v, k)),
        };
      }
    }
    return snaps[snaps.length - 1];
  }
}
