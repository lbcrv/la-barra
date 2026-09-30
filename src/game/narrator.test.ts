import { describe, expect, it } from "vitest";
import { Narrator } from "./narrator";

const name = (s: "red" | "blue") => (s === "red" ? "Atlético La Esquina" : "Real Pulpería");

describe("Narrator", () => {
  it("names the scoring team", () => {
    const n = new Narrator(() => 0);
    expect(n.line({ kind: "goal", scorer: "blue" }, "es", name)).toContain("Real Pulpería");
  });

  it("never says the same line twice in a row", () => {
    const n = new Narrator(() => 0);
    const a = n.line({ kind: "bigShot" }, "es", name);
    const b = n.line({ kind: "bigShot" }, "es", name);
    expect(a).not.toBe(b);
  });

  it("speaks both languages and never leaves a placeholder", () => {
    const n = new Narrator(Math.random);
    for (const lang of ["es", "en"] as const) {
      for (let i = 0; i < 20; i++) {
        for (const call of [
          { kind: "kickoff" },
          { kind: "goal", scorer: "red" },
          { kind: "matchPoint", side: "blue" },
          { kind: "win", winner: "red" },
          { kind: "power", power: "oxido", side: "red" },
        ] as const) {
          expect(n.line(call, lang, name)).not.toContain("{team}");
        }
      }
    }
  });
});
