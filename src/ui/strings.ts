export type Lang = "es" | "en";

export const strings = {
  es: {
    title: "La Barra",
    serve: "Clic o barra espaciadora: sacar la pelota",
    camera: "Clic derecho y arrastrar: mover la cámara. Rueda: acercar",
    resetView: "Cámara inicial",
    goal: "Gol",
    lang: "English",
  },
  en: {
    title: "La Barra",
    serve: "Click or space bar: serve the ball",
    camera: "Right-click and drag: move the camera. Wheel: zoom",
    resetView: "Reset view",
    goal: "Goal",
    lang: "Español",
  },
} as const satisfies Record<Lang, unknown>;
