import { describe, expect, it } from "vitest";
import { KICK, restingKick, stepKick, type KickState } from "./kick";

const DT = 1 / 120;

/** Runs the kick for `seconds` with the button held or not, returning every state. */
function run(s: KickState, pressed: boolean, seconds: number): KickState[] {
  const out: KickState[] = [];
  for (let t = 0; t < seconds; t += DT) {
    s = stepKick(s, pressed, DT);
    out.push(s);
  }
  return out;
}

describe("stepKick", () => {
  it("rests until the button goes down", () => {
    expect(stepKick(restingKick(), false, DT)).toEqual(restingKick());
  });

  it("draws the foot back while held, no further than the windup", () => {
    const states = run(restingKick(), true, 1);
    expect(states.at(-1)).toMatchObject({ phase: "windup", angle: KICK.windup });
    expect(Math.min(...states.map((s) => s.angle))).toBe(KICK.windup);
  });

  it("swings through on release, then comes back to rest", () => {
    const held = run(restingKick(), true, 0.2).at(-1)!;
    const after = run(held, false, 2);
    expect(after[0].phase).toBe("strike");
    expect(Math.max(...after.map((s) => s.angle))).toBe(KICK.follow);
    expect(after.at(-1)).toEqual(restingKick());
  });

  it("strikes faster the longer the button was held, up to a full charge", () => {
    const speedAfter = (hold: number) => stepKick(run(restingKick(), true, hold).at(-1)!, false, DT).speed;
    expect(speedAfter(0.05)).toBeLessThan(speedAfter(0.3));
    expect(speedAfter(0.45)).toBeCloseTo(KICK.fullSpeed, 0);
    expect(speedAfter(2)).toBe(KICK.fullSpeed);
  });

  it("accepts a new press once the foot is on its way back", () => {
    let s = stepKick(run(restingKick(), true, 0.1).at(-1)!, false, DT);
    s = run(s, false, 0.2).at(-1)!;
    expect(s.phase).toBe("recover");
    const again = run(s, true, 0.3).at(-1)!;
    expect(again.phase).toBe("windup");
  });
});
