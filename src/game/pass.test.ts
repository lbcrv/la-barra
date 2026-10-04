import { describe, expect, it } from "vitest";
import { atBoot, planPass, receiverOf } from "./pass";
import { MAN, manOffsets, RODS } from "./rods";
import { BALL } from "./table";

const rod = (team: "red" | "blue", role: string) => RODS.find((r) => r.team === team && r.role === role)!;
const centred = RODS.map(() => 0);

describe("receiverOf", () => {
  it("is the next rod of the same side toward the opponent's goal", () => {
    expect(receiverOf(rod("red", "midfield"))).toBe(rod("red", "attack"));
    expect(receiverOf(rod("red", "goalie"))).toBe(rod("red", "defence"));
    expect(receiverOf(rod("blue", "defence"))).toBe(rod("blue", "midfield"));
  });

  it("is nobody from the attack rod", () => {
    expect(receiverOf(rod("red", "attack"))).toBeNull();
    expect(receiverOf(rod("blue", "attack"))).toBeNull();
  });
});

describe("atBoot", () => {
  it("is true for a ball just in front of a player, false for one between players", () => {
    const mid = rod("red", "midfield");
    expect(atBoot(mid, 0, { x: mid.x + 0.03, z: 0 })).toBe(true);
    expect(atBoot(mid, 0, { x: mid.x + 0.03, z: mid.spacing / 2 })).toBe(false);
    expect(atBoot(mid, 0, { x: mid.x - 0.05, z: 0 })).toBe(false);
  });
});

describe("planPass", () => {
  it("passes forward, toward the opponent's goal, to a player on the next rod", () => {
    const mid = rod("red", "midfield");
    const plan = planPass(mid, { x: mid.x + 0.03, z: 0 }, centred)!;
    expect(plan.lateral).toBe(false);
    expect(plan.receiver).toBe(rod("red", "attack").id);
    expect(plan.vx).toBeGreaterThan(0);
    const blue = planPass(rod("blue", "midfield"), { x: rod("blue", "midfield").x - 0.03, z: 0 }, centred)!;
    expect(blue.vx).toBeLessThan(0);
  });

  it("aims around an opponent standing in the straight path", () => {
    // Red's midfield passes to its forwards, past blue's midfield. With a blue
    // player right in front of the middle forward, the pass goes to another one.
    const mid = rod("red", "midfield");
    const att = rod("red", "attack");
    const blueMid = rod("blue", "midfield");
    const slides = RODS.map(() => 0);
    const ball = { x: mid.x + 0.03, z: 0 };
    const plan = planPass(mid, ball, slides)!;
    const zTo = slides[att.id] + manOffsets(att)[plan.man];
    // Where the path crosses blue's midfield, no blue boot is in the way.
    const t = (blueMid.x - ball.x) / (att.x - ball.x);
    const zCross = ball.z + t * (zTo - ball.z);
    for (const o of manOffsets(blueMid)) {
      expect(Math.abs(zCross - o)).toBeGreaterThan(MAN.footWidth / 2 + BALL.radius);
    }
  });

  it("goes sideways along the attack rod, to the forward next to the ball", () => {
    const att = rod("red", "attack");
    const plan = planPass(att, { x: att.x + 0.03, z: 0 }, centred)!;
    expect(plan.lateral).toBe(true);
    expect(plan.receiver).toBe(att.id);
    expect(plan.vx).toBe(0);
    expect(Math.abs(plan.vz)).toBeGreaterThan(0);
    expect(Math.abs(manOffsets(att)[plan.man])).toBeCloseTo(att.spacing);
  });

  it("is a soft roll, slower than a tapped shot", () => {
    const mid = rod("red", "midfield");
    const plan = planPass(mid, { x: mid.x + 0.03, z: 0.05 }, centred)!;
    expect(Math.hypot(plan.vx, plan.vz)).toBeLessThan(1.5);
  });
});
