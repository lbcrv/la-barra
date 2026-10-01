import { describe, expect, it } from "vitest";
import { CAP_LANES, DURATION, effects, kickerOf, nextCap, SPAWN_AREA, take } from "./powerups";
import { RODS } from "./rods";

describe("effects", () => {
  it("is neutral with nothing in play", () => {
    expect(effects([], 0)).toEqual({ rodSpeed: { red: 1, blue: 1 }, kickBoost: { red: 1, blue: 1 }, ballDamping: 1 });
  });

  it("applies each power to the right side", () => {
    const e = effects(
      [
        { power: "fuego", side: "red", until: 10 },
        { power: "oxido", side: "red", until: 10 },
        { power: "turbo", side: "blue", until: 10 },
      ],
      5,
    );
    expect(e.kickBoost).toEqual({ red: 1.6, blue: 1 });
    // Blue is turbo but rusted by red: the two cancel.
    expect(e.rodSpeed).toEqual({ red: 1, blue: 1 });
  });

  it("freezes the field for both sides", () => {
    expect(effects([{ power: "hielo", side: "blue", until: 3 }], 1).ballDamping).toBeLessThan(0.5);
  });

  it("ignores powers that have worn off", () => {
    expect(effects([{ power: "turbo", side: "red", until: 4 }], 4).rodSpeed.red).toBe(1);
  });
});

describe("take", () => {
  it("runs a power for its duration", () => {
    expect(take([], "fuego", "red", 10)).toEqual([{ power: "fuego", side: "red", until: 10 + DURATION.fuego }]);
  });

  it("restarts a power already running for the new taker instead of stacking", () => {
    const once = take([], "oxido", "red", 0);
    const twice = take(once, "oxido", "blue", 2);
    expect(twice).toEqual([{ power: "oxido", side: "blue", until: 2 + DURATION.oxido }]);
  });

  it("drops expired powers", () => {
    const old = take([], "turbo", "red", 0);
    expect(take(old, "hielo", "blue", 100).map((a) => a.power)).toEqual(["hielo"]);
  });
});

describe("caps", () => {
  it("land inside the rally area", () => {
    let seed = 0.13;
    const random = () => (seed = (seed * 9301 + 0.49297) % 1);
    for (let i = 0; i < 50; i++) {
      const cap = nextCap(random);
      expect(Math.abs(cap.x)).toBeLessThanOrEqual(SPAWN_AREA.x);
      expect(Math.abs(cap.z)).toBeLessThanOrEqual(SPAWN_AREA.z);
    }
  });

  it("land between rods, clear of every player's swing", () => {
    expect(CAP_LANES.length).toBeGreaterThan(2);
    let seed = 0.71;
    const random = () => (seed = (seed * 9301 + 0.49297) % 1);
    for (let i = 0; i < 50; i++) {
      const cap = nextCap(random);
      const nearestRod = Math.min(...RODS.map((r) => Math.abs(r.x - cap.x)));
      expect(nearestRod).toBeGreaterThan(0.06);
    }
  });

  it("credit the side whose kick sent the ball", () => {
    expect(kickerOf(1.2)).toBe("red");
    expect(kickerOf(-0.4)).toBe("blue");
  });
});
