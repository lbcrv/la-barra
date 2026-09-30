export type Lang = "es" | "en";

export const strings = {
  es: {
    title: "La Barra",
    controls: "Mouse: mover tus barras. Clic: patear, mantén para más fuerza. Espacio: sacar de nuevo",
    camera: "Clic derecho y arrastrar: mover la cámara. Rueda: acercar",
    resetView: "Cámara inicial",
    goal: "Gol",
    lang: "English",
  },
  en: {
    title: "La Barra",
    controls: "Mouse: move your rods. Click: kick, hold for power. Space: serve again",
    camera: "Right-click and drag: move the camera. Wheel: zoom",
    resetView: "Reset view",
    goal: "Goal",
    lang: "Español",
  },
} as const satisfies Record<Lang, unknown>;
