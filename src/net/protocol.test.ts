import { describe, expect, it } from "vitest";
import { CODE_LENGTH, makeCode, peerId, readCode, RENDER_DELAY_MS, SnapshotBuffer, type Snapshot } from "./protocol";

const snap = (t: number, x: number, slide = 0): Snapshot => ({
  t,
  ball: [x, 0.017, 0],
  slides: [slide, 0, 0, 0, 0, 0, 0, 0],
  angles: [0, 0, 0, 0, 0, 0, 0, 0],
  active: [null, null],
  match: null,
  powers: [],
  cap: null,
});

describe("room codes", () => {
  it("are four easy-to-read letters", () => {
    for (let i = 0; i < 100; i++) {
      const code = makeCode();
      expect(code).toMatch(new RegExp(`^[A-Z]{${CODE_LENGTH}}$`));
      expect(code).not.toMatch(/[ILO]/);
    }
  });

  it("read back from whatever the player typed or pasted", () => {
    expect(readCode(" kpa x ")).toBe("KPAX");
    expect(readCode("https://x.app/?sala=QRST")).toBeNull();
    expect(readCode("QRST")).toBe("QRST");
    expect(readCode("ABC")).toBeNull();
  });

  it("map to ids nobody else on the broker uses", () => {
    expect(peerId("KPAX")).toBe("la-barra-hn-KPAX");
  });
});

describe("SnapshotBuffer", () => {
  it("draws a moment between two snapshots, blended", () => {
    const buf = new SnapshotBuffer();
    // Host and guest clocks agree here; snapshots every 33 ms.
    buf.push(snap(1000, 0.0, 0), 1000);
    buf.push(snap(1033, 0.1, 0.03), 1033);
    const s = buf.sample(1033 - 16.5 + RENDER_DELAY_MS)!;
    expect(s.ball![0]).toBeCloseTo(0.05, 3);
    expect(s.slides[0]).toBeCloseTo(0.015, 3);
  });

  it("works across different clocks", () => {
    const buf = new SnapshotBuffer();
    // The guest's clock is 5 s behind the host's.
    buf.push(snap(10000, 0.0), 5000);
    buf.push(snap(10033, 0.1), 5033);
    expect(buf.sample(5016.5 + RENDER_DELAY_MS)!.ball![0]).toBeCloseTo(0.05, 3);
  });

  it("holds the last snapshot when packets stop, instead of guessing", () => {
    const buf = new SnapshotBuffer();
    buf.push(snap(1000, 0.0), 1000);
    buf.push(snap(1033, 0.1), 1033);
    expect(buf.sample(5000)!.ball![0]).toBe(0.1);
  });

  it("ignores snapshots that arrive out of order", () => {
    const buf = new SnapshotBuffer();
    buf.push(snap(1033, 0.1), 1033);
    buf.push(snap(1000, 0.0), 1040);
    expect(buf.latest()!.ball![0]).toBe(0.1);
  });
});
