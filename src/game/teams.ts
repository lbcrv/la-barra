export type Side = "red" | "blue";

export interface Team {
  name: string;
  /** Three letters for the bead counter and tight spaces. */
  short: string;
  /** Painted colour of the players, and the shade it wears down to. */
  color: string;
  worn: string;
  /** The goal this team defends: red's is at -x, blue's at +x. */
  goalX: -1 | 1;
}

/** Invented neighbourhood clubs. Never a real club, crest or brand. */
export const TEAMS: Record<Side, Team> = {
  red: { name: "Atlético La Esquina", short: "ESQ", color: "#b3261e", worn: "#8e2a22", goalX: -1 },
  blue: { name: "Real Pulpería", short: "PUL", color: "#1f4f9c", worn: "#2a4775", goalX: 1 },
};
