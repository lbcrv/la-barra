export type Lang = "es" | "en";

export const strings = {
  es: {
    title: "La Barra",
    serve: "Clic o barra espaciadora: sacar la pelota",
    goal: "Gol",
    lang: "English",
  },
  en: {
    title: "La Barra",
    serve: "Click or space bar: serve the ball",
    goal: "Goal",
    lang: "Español",
  },
} as const satisfies Record<Lang, unknown>;
