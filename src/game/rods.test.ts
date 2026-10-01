import { describe, expect, it } from "vitest";
import { activeRod, BOOT_REACH, handleSlide, clampSlide, manOffsets, MAN, reachable, RODS, slideToward, stepSlide, towardPlay } from "./rods";
import { FIELD } from "./table";

describe("rod layout", () => {
  it("has the standard eight rods and nine players a side", () => {
    expect(RODS).toHaveLength(8);
    for (const team of ["red", "blue"] as const) {
      const own = RODS.filter((r) => r.team === team);
      expect(own.map((r) => r.men).reduce((a, b) => a + b)).toBe(9);
    }
  });

  it("orders the rods from red's goal to blue's, evenly spaced inside the field", () => {
    const xs = RODS.map((r) => r.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(xs[0]).toBeGreaterThan(-FIELD.length / 2);
    expect(xs[7]).toBeLessThan(FIELD.length / 2);
    expect(RODS[0]).toMatchObject({ team: "red", role: "goalie" });
    expect(RODS[7]).toMatchObject({ team: "blue", role: "goalie" });
  });

  it("never lets an outer player through a side wall", () => {
    for (const rod of RODS) {
      const edge = Math.max(...manOffsets(rod).map(Math.abs)) + rod.travel + MAN.footWidth / 2;
      expect(edge).toBeLessThanOrEqual(FIELD.width / 2);
    }
  });

  it("lets every point across the field be reached by some player on the outfield rods", () => {
    for (const rod of RODS.filter((r) => r.role !== "goalie")) {
      for (let z = -FIELD.width / 2 + 0.03; z <= FIELD.width / 2 - 0.03; z += 0.01) {
        const slide = slideToward(rod, z);
        const nearest = Math.min(...manOffsets(rod).map((o) => Math.abs(slide + o - z)));
        expect(nearest).toBeLessThan(0.02);
      }
    }
  });
});

describe("slideToward", () => {
  const five = RODS.find((r) => r.role === "midfield")!;

  it("centres a player under the target when it can", () => {
    const slide = slideToward(five, 0.05);
    expect(manOffsets(five).some((o) => Math.abs(slide + o - 0.05) < 1e-9)).toBe(true);
  });

  it("stays within the rod's travel", () => {
    expect(Math.abs(slideToward(five, 10))).toBeLessThanOrEqual(five.travel);
    expect(clampSlide(five, -10)).toBe(-five.travel);
  });
});

describe("activeRod", () => {
  it("picks the team's rod nearest the ball", () => {
    expect(RODS[activeRod("red", RODS[3].x + 0.01, null)].role).toBe("midfield");
    expect(RODS[activeRod("blue", RODS[7].x - 0.01, null)].role).toBe("goalie");
  });

  it("holds the current rod until another is clearly nearer", () => {
    const mid = (RODS[3].x + RODS[5].x) / 2;
    expect(activeRod("red", mid + 0.005, 3)).toBe(3);
    expect(activeRod("red", RODS[5].x, 3)).toBe(5);
  });
});

describe("slideToward keeps the same player", () => {
  const five = RODS.find((r) => r.role === "midfield")!;

  it("stays with the player it already has when the target is between two", () => {
    // Midway between two players of the rod at rest: either could take it.
    const mid = five.spacing / 2;
    const fromLeft = slideToward(five, mid, -0.03);
    const fromRight = slideToward(five, mid, 0.03);
    // Each keeps the move short instead of jumping to the other player.
    expect(Math.abs(fromLeft - -0.03)).toBeLessThan(five.spacing / 2 + 1e-9);
    expect(Math.abs(fromRight - 0.03)).toBeLessThan(five.spacing / 2 + 1e-9);
    expect(fromLeft).not.toBeCloseTo(fromRight);
  });

  it("does not rock a rod around a still target", () => {
    const z = five.spacing / 2 + 0.001;
    let s = { x: 0, v: 0 };
    const seen: number[] = [];
    for (let i = 0; i < 480; i++) {
      s = stepSlide(s, slideToward(five, z, s.x), 1 / 480, 2.4);
      seen.push(s.x);
    }
    // Settled: the last quarter second barely moves.
    const tail = seen.slice(-120);
    expect(Math.max(...tail) - Math.min(...tail)).toBeLessThan(1e-6);
  });
});

describe("stepSlide", () => {
  it("reaches the target and stops without overshooting", () => {
    let s = { x: 0, v: 0 };
    let max = 0;
    for (let i = 0; i < 480; i++) {
      s = stepSlide(s, 0.1, 1 / 480, 2.4);
      max = Math.max(max, s.x);
    }
    expect(s).toEqual({ x: 0.1, v: 0 });
    expect(max).toBeLessThanOrEqual(0.1);
  });

  it("speeds up gradually instead of jumping to full speed", () => {
    const s = stepSlide({ x: 0, v: 0 }, 0.3, 1 / 480, 2.4);
    expect(s.v).toBeLessThan(0.5);
    expect(s.v).toBeGreaterThan(0);
  });

  it("never exceeds the top speed", () => {
    let s = { x: 0, v: 0 };
    for (let i = 0; i < 480; i++) {
      s = stepSlide(s, 5, 1 / 480, 2.4);
      expect(Math.abs(s.v)).toBeLessThanOrEqual(2.4 + 1e-9);
    }
  });
});

describe("reachable", () => {
  it("is true right in front of a boot", () => {
    const mid = RODS.find((r) => r.team === "red" && r.role === "midfield")!;
    expect(reachable(mid.x + 0.03, 0.05)).toBe(true);
  });

  it("is false in the gap between two rods' reach", () => {
    // Just past the red midfield boots' forward reach, before blue's midfield back reach.
    const red = RODS.find((r) => r.team === "red" && r.role === "midfield")!;
    const blue = RODS.find((r) => r.team === "blue" && r.role === "midfield")!;
    // Both midfields face the middle: red reaches forward to +x, blue forward to -x.
    const gapStart = red.x + BOOT_REACH.forward;
    const gapEnd = blue.x - BOOT_REACH.forward;
    expect(gapEnd).toBeGreaterThan(gapStart);
    expect(reachable((gapStart + gapEnd) / 2, 0)).toBe(false);
  });

  it("is false in a corner beyond the keeper's travel", () => {
    expect(reachable(-FIELD.length / 2 + 0.02, FIELD.width / 2 - 0.03)).toBe(false);
  });
});

describe("towardPlay", () => {
  it("says nothing for a reachable ball", () => {
    const mid = RODS.find((r) => r.team === "red" && r.role === "midfield")!;
    expect(towardPlay(mid.x + 0.03, 0)).toBeNull();
  });

  it("points a stranded ball at the nearest reachable spot, and following it gets there", () => {
    let x = -FIELD.length / 2 + 0.02;
    let z = FIELD.width / 2 - 0.03;
    for (let i = 0; i < 400 && !reachable(x, z); i++) {
      const d = towardPlay(x, z)!;
      x += d.x * 0.005;
      z += d.z * 0.005;
    }
    expect(reachable(x, z)).toBe(true);
  });
});

describe("handleSlide", () => {
  it("moves every rod the same fraction of its travel, with no jumps", () => {
    for (const rod of RODS) {
      expect(handleSlide(rod, 1)).toBeCloseTo(rod.travel);
      expect(handleSlide(rod, -0.5)).toBeCloseTo(-rod.travel / 2);
      // Continuous: a small move of the hand is a small move of the rod.
      for (let h = -1; h < 1; h += 0.01) {
        expect(Math.abs(handleSlide(rod, h + 0.01) - handleSlide(rod, h))).toBeLessThan(rod.travel * 0.011);
      }
    }
  });
});

describe("a ball behind the players", () => {
  it("counts as out of play, so the table rolls it back into reach", () => {
    // Behind blue's midfield boots and far from every other rod's front.
    const blue = RODS.find((r) => r.team === "blue" && r.role === "midfield")!;
    const red = RODS.find((r) => r.team === "red" && r.role === "attack")!;
    const x = blue.x + 0.03;
    expect(red.x - BOOT_REACH.forward).toBeGreaterThan(x);
    expect(reachable(x, 0)).toBe(false);
    expect(towardPlay(x, 0)).not.toBeNull();
  });
});
