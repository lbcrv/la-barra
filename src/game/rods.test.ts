import { describe, expect, it } from "vitest";
import { activeRod, clampSlide, manOffsets, MAN, RODS, slideToward } from "./rods";
import { FIELD } from "./table";

describe("rod layout", () => {
  it("has the standard eight rods and eleven players a side", () => {
    expect(RODS).toHaveLength(8);
    for (const team of ["red", "blue"] as const) {
      const own = RODS.filter((r) => r.team === team);
      expect(own.map((r) => r.men).reduce((a, b) => a + b)).toBe(11);
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
