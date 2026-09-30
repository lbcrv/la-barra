export type Side = "red" | "blue";

export interface Team {
  name: string;
  /** Three letters for the bead counter and tight spaces. */
  short: string;
  /** Jersey colour, and the shorts worn with it. */
  color: string;
  shorts: string;
  /** The goal this team defends: red's is at -x, blue's at +x. */
  goalX: -1 | 1;
}

/** Invented neighbourhood clubs. Never a real club, crest or brand. */
export const TEAMS: Record<Side, Team> = {
  red: { name: "Atlético La Esquina", short: "ESQ", color: "#d7322a", shorts: "#f6ead0", goalX: -1 },
  blue: { name: "Real Pulpería", short: "PUL", color: "#2563c9", shorts: "#f6ead0", goalX: 1 },
};
