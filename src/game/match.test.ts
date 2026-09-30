import { describe, expect, it } from "vitest";
import { goal, matchPoint, newMatch, resume, TARGET } from "./match";

describe("match", () => {
  it("credits a goal to the side that didn't concede and pauses for it", () => {
    const m = goal(newMatch("bot", "normal"), "blue");
    expect(m.score).toEqual({ red: 1, blue: 0 });
    expect(m).toMatchObject({ phase: "goal", last: "red" });
  });

  it("ignores a second goal during the pause, like a ball rattling in the pocket", () => {
    const m = goal(goal(newMatch("bot", "normal"), "blue"), "blue");
    expect(m.score.red).toBe(1);
  });

  it("goes back to play once the next ball is in", () => {
    expect(resume(goal(newMatch("local", "normal"), "red")).phase).toBe("playing");
  });

  it("ends when a side reaches the target, with that side as winner", () => {
    let m = newMatch("bot", "hard");
    for (let i = 0; i < TARGET; i++) {
      expect(m.phase).not.toBe("over");
      m = resume(goal(m, "red"));
    }
    expect(m).toMatchObject({ phase: "over", last: "blue" });
    expect(m.score.blue).toBe(TARGET);
  });

  it("knows a match point", () => {
    let m = newMatch("bot", "easy");
    for (let i = 0; i < TARGET - 1; i++) m = resume(goal(m, "blue"));
    expect(matchPoint(m, "red")).toBe(true);
    expect(matchPoint(m, "blue")).toBe(false);
  });
});
