import { describe, expect, it } from "vitest";
import { keepInside } from "./contain";
import { BALL, FIELD, LID_Y } from "./table";

const still = { x: 0, y: 0, z: 0 };

describe("keepInside", () => {
  it("leaves a ball on the field alone", () => {
    expect(keepInside({ x: 0.2, y: BALL.radius, z: -0.1 }, still)).toBeNull();
  });

  it("puts a ball driven through a side wall back inside, bouncing off it", () => {
    const fix = keepInside({ x: 0.1, y: 0.02, z: FIELD.width / 2 + 0.01 }, { x: 1, y: 0, z: 3 })!;
    expect(fix.p.z).toBeCloseTo(FIELD.width / 2 - BALL.radius);
    expect(fix.v.z).toBeLessThan(0);
    expect(fix.v.x).toBe(1);
  });

  it("keeps a ball under the lid", () => {
    const fix = keepInside({ x: 0, y: LID_Y + 0.02, z: 0 }, { x: 0, y: 2, z: 0 })!;
    expect(fix.p.y).toBeCloseTo(LID_Y - BALL.radius);
    expect(fix.v.y).toBeLessThan(0);
  });

  it("lets a ball into the goal mouth, but not through an end wall beside it", () => {
    expect(keepInside({ x: FIELD.length / 2 + 0.03, y: 0.01, z: 0 }, still)).toBeNull();
    const fix = keepInside({ x: FIELD.length / 2 + 0.01, y: 0.02, z: 0.2 }, { x: 2, y: 0, z: 0 })!;
    expect(fix.p.x).toBeCloseTo(FIELD.length / 2 - BALL.radius);
    expect(fix.v.x).toBeLessThan(0);
  });
});
