import type { Level } from "./bot";
import type { Side } from "./teams";

export type Mode = "bot" | "local" | "online";

/** Goals needed to win a match. */
export const TARGET = 5;

export interface Match {
  mode: Mode;
  level: Level;
  score: Record<Side, number>;
  /** "goal" is the pause after a goal before the next ball; "over" once someone reaches the target. */
  phase: "playing" | "goal" | "over";
  /** Who scored last, while the goal is being celebrated, and the winner once it is over. */
  last: Side | null;
}

export const newMatch = (mode: Mode, level: Level): Match => ({
  mode,
  level,
  score: { red: 0, blue: 0 },
  phase: "playing",
  last: null,
});

export const other = (side: Side): Side => (side === "red" ? "blue" : "red");

/** A goal went into `conceded`'s net. Ignored unless the ball is in play. */
export function goal(m: Match, conceded: Side): Match {
  if (m.phase !== "playing") return m;
  const scorer = other(conceded);
  const score = { ...m.score, [scorer]: m.score[scorer] + 1 };
  return { ...m, score, phase: score[scorer] >= TARGET ? "over" : "goal", last: scorer };
}

/** The next ball is in; back to play after a goal. */
export function resume(m: Match): Match {
  return m.phase === "goal" ? { ...m, phase: "playing" } : m;
}

/** A match point: the next goal for `side` wins it. */
export const matchPoint = (m: Match, side: Side) => m.score[side] === TARGET - 1;
