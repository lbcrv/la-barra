import { describe, expect, it } from "vitest";
import { Bot, predictZ } from "./bot";
import { RODS, slideToward } from "./rods";
import { BALL, FIELD } from "./table";

const LIMIT = FIELD.width / 2 - BALL.radius;
const DT = 1 / 480;

/** A random source that always returns the same value, so the bot is predictable in tests. */
const fixed = (v: number) => () => v;

/** Rod slides as they'd be once every rod reached `z`. */
const slidesAt = (z: number) => RODS.map((r) => slideToward(r, z));

describe("predictZ", () => {
  it("moves in a straight line between the walls", () => {
    expect(predictZ(0, 0.1, 1)).toBeCloseTo(0.1);
  });

  it("bounces off a side wall", () => {
    // Heading for the near wall, 0.1 past it once unfolded: comes back 0.1 short of it.
    expect(predictZ(LIMIT - 0.05, 0.15, 1)).toBeCloseTo(LIMIT - 0.1);
    expect(predictZ(-LIMIT + 0.05, -0.15, 1)).toBeCloseTo(-LIMIT + 0.1);
  });

  it("never predicts a point outside the field", () => {
    for (let t = 0; t < 5; t += 0.37) {
      expect(Math.abs(predictZ(0.1, 0.9, t))).toBeLessThanOrEqual(LIMIT + 1e-9);
    }
  });
});

describe("Bot", () => {
  it("moves its players toward where an incoming ball will cross", () => {
    const bot = new Bot("blue", "hard", fixed(0.5));
    let input = bot.input;
    for (let i = 0; i < 480; i++) input = bot.think({ x: 0, z: 0.2, vx: 0.5, vz: 0 }, slidesAt(0), DT);
    expect(input.pointerZ).toBeCloseTo(0.2, 2);
  });

  it("kicks a ball sitting just in front of one of its boots, then lets go", () => {
    const bot = new Bot("blue", "hard", fixed(0));
    const goalie = RODS.find((r) => r.team === "blue" && r.role === "goalie")!;
    const ball = { x: goalie.x - 0.02, z: 0, vx: 0, vz: 0 };
    const presses: boolean[] = [];
    for (let i = 0; i < 480; i++) presses.push(bot.think(ball, slidesAt(0), DT).kick);
    expect(presses).toContain(true);
    // Released after charging, so the strike actually happens.
    const first = presses.indexOf(true);
    expect(presses.slice(first).indexOf(false)).toBeGreaterThan(0);
  });

  it("does not kick a ball that is behind its boots", () => {
    const bot = new Bot("blue", "hard", fixed(0));
    const goalie = RODS.find((r) => r.team === "blue" && r.role === "goalie")!;
    const ball = { x: goalie.x + 0.03, z: 0, vx: 0, vz: 0 };
    for (let i = 0; i < 480; i++) expect(bot.think(ball, slidesAt(0), DT).kick).toBe(false);
  });

  it("is slower and less precise on easy than on hard", () => {
    const run = (level: "easy" | "hard") => {
      const bot = new Bot("blue", level, fixed(1));
      let z = 0;
      for (let i = 0; i < 120; i++) z = bot.think({ x: 0, z: 0.25, vx: 0.5, vz: 0 }, slidesAt(0), DT).pointerZ!;
      return z;
    };
    expect(run("hard")).toBeGreaterThan(run("easy"));
  });
});

describe("Bot with a still ball", () => {
  it("holds its hand steady instead of trembling around the ball", () => {
    // Alternating random values would re-roll the aim error every look.
    let flip = 0;
    const bot = new Bot("blue", "normal", () => (flip++ % 2 === 0 ? 0.05 : 0.95));
    const mid = RODS.find((r) => r.team === "blue" && r.role === "midfield")!;
    const ball = { x: mid.x - 0.025, z: 0.06, vx: 0, vz: 0 };
    const seen: number[] = [];
    for (let i = 0; i < 480 * 2; i++) seen.push(bot.think(ball, slidesAt(0.06), DT).pointerZ!);
    const tail = seen.slice(-480);
    expect(Math.max(...tail) - Math.min(...tail)).toBeLessThan(1e-6);
  });
});

describe("Bot reach", () => {
  it("kicks a ball sitting 5 cm in front of a boot, the spot where it used to freeze", () => {
    const bot = new Bot("blue", "hard", fixed(0));
    const mid = RODS.find((r) => r.team === "blue" && r.role === "midfield")!;
    const ball = { x: mid.x - 0.05, z: 0.06, vx: 0, vz: 0 };
    let kicked = false;
    for (let i = 0; i < 480; i++) kicked ||= bot.think(ball, slidesAt(0.06), DT).kick;
    expect(kicked).toBe(true);
  });
});

describe("Bot with a ball behind its players", () => {
  it("doesn't chase it across the table, which only shoved it sideways", () => {
    const bot = new Bot("blue", "hard", fixed(0.5));
    const mid = RODS.find((r) => r.team === "blue" && r.role === "midfield")!;
    // Blue attacks toward -x, so +x is behind its boots.
    const ball = { x: mid.x + 0.025, z: 0.2, vx: 0, vz: 0 };
    let z = 0;
    for (let i = 0; i < 480; i++) z = bot.think(ball, slidesAt(0), DT).pointerZ!;
    expect(Math.abs(z)).toBeLessThan(0.02);
  });
});
