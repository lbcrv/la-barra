import type { Power } from "./powerups";
import type { Side } from "./teams";

/** Don Chepe calls the game from the shop's radio. */
export const NARRATOR = "Don Chepe";

export type Call =
  | { kind: "kickoff" }
  | { kind: "goal"; scorer: Side }
  | { kind: "bigShot" }
  | { kind: "power"; power: Power; side: Side }
  | { kind: "matchPoint"; side: Side }
  | { kind: "win"; winner: Side };

type Lang = "es" | "en";

/** `{team}` is replaced with the club name. Short enough to read at a glance. */
const LINES: Record<Exclude<Call["kind"], "power">, Record<Lang, string[]>> = {
  kickoff: {
    es: ["¡Rueda la pelota en la pulpería!", "¡Arrancó el clásico del barrio!", "Pónganle ojo, que esto se pone bueno.", "¡A jugar, muchachos, que la doña quiere cerrar temprano!"],
    en: ["The ball is rolling at the corner shop!", "The neighbourhood derby is on!", "Keep your eyes peeled, this gets good.", "Play ball, the owner wants to close early!"],
  },
  goal: {
    es: ["¡GOOOL de {team}!", "¡Púchica, qué golazo de {team}!", "¡Se la metió hasta la cocina!", "¡Adentro! {team} no perdona.", "¡A la gran! Ni la vio venir el portero.", "¡Qué cachimbazo, maje!"],
    en: ["GOAL for {team}!", "What a strike from {team}!", "Buried it right into the kitchen!", "In! {team} don't forgive.", "Good grief, the keeper never saw it.", "What a rocket!"],
  },
  bigShot: {
    es: ["¡Uy, qué fogonazo!", "¡Casi rompe la mesa!", "¡Tiro de cañón!", "¡Eso llevaba veneno!"],
    en: ["Whoa, what a blast!", "Nearly broke the table!", "Cannon shot!", "That one had venom on it!"],
  },
  matchPoint: {
    es: ["¡Uno más y {team} se lleva la tarde!", "¡Punto de partido para {team}!", "A {team} le falta uno. ¡Nervios!"],
    en: ["One more and {team} take the afternoon!", "Match point, {team}!", "{team} need one more. Nerves!"],
  },
  win: {
    es: ["¡Se acabó! {team} se queda con la mesa.", "¡Ganó {team}! Que pague el que perdió las cocas.", "¡{team} campeón del barrio!"],
    en: ["It's over! {team} keep the table.", "{team} win! Loser buys the sodas.", "{team}, champions of the neighbourhood!"],
  },
};

const POWER_LINES: Record<Power, Record<Lang, string>> = {
  fuego: { es: "¡{team} agarró el fuego! Tiros que queman.", en: "{team} grabbed the fire! Shots that burn." },
  turbo: { es: "¡Turbo para {team}! Esas barras vuelan.", en: "Turbo for {team}! Those rods fly." },
  oxido: { es: "¡Óxido! Al rival de {team} se le trabaron las barras.", en: "Rust! {team}'s rivals have stiff rods." },
  hielo: { es: "¡Hielo! La mesa quedó como pista de patinaje.", en: "Ice! The table is a skating rink now." },
};

/** Picks lines without repeating the last one of each kind. */
export class Narrator {
  private last = new Map<string, number>();

  constructor(private readonly random: () => number = Math.random) {}

  line(call: Call, lang: Lang, teamName: (side: Side) => string): string {
    if (call.kind === "power") return POWER_LINES[call.power][lang].replace("{team}", teamName(call.side));
    const pool = LINES[call.kind][lang];
    const prev = this.last.get(call.kind);
    let i = Math.floor(this.random() * pool.length) % pool.length;
    if (pool.length > 1 && i === prev) i = (i + 1) % pool.length;
    this.last.set(call.kind, i);
    const side = "scorer" in call ? call.scorer : "winner" in call ? call.winner : "side" in call ? call.side : null;
    return side ? pool[i].replace("{team}", teamName(side)) : pool[i];
  }
}
