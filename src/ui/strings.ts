import type { Level } from "@/game/bot";

export type Lang = "es" | "en";

export const strings = {
  es: {
    title: "La Barra",
    tagline: "Futbolito de pulpería",
    vsBot: "Contra la compu",
    local: "2 jugadores",
    localNote: "En el mismo teclado",
    online: "En línea",
    onlineNote: "Con código de sala",
    levels: { easy: "Fácil", normal: "Normal", hard: "Difícil" } satisfies Record<Level, string>,
    firstTo: (n: number) => `Gana el primero en llegar a ${n}`,
    controlsMouse: "Mouse: mover tus barras. Clic: patear, mantén para más fuerza",
    controlsRed: "Rojo: W / S para mover, D para patear",
    controlsBlue: "Azul: flechas arriba / abajo para mover, flecha izquierda para patear",
    controlsCamera: "Clic derecho y arrastrar: mover la cámara. Rueda: acercar. Espacio: sacar de nuevo",
    goal: "¡GOOOL!",
    matchPoint: "Punto de partido",
    won: (team: string) => `¡Ganó ${team}!`,
    rematch: "Revancha",
    menu: "Menú",
    resetView: "Cámara",
    lang: "English",
  },
  en: {
    title: "La Barra",
    tagline: "Corner-shop table football",
    vsBot: "Against the computer",
    local: "2 players",
    localNote: "On one keyboard",
    online: "Online",
    onlineNote: "With a room code",
    levels: { easy: "Easy", normal: "Normal", hard: "Hard" } satisfies Record<Level, string>,
    firstTo: (n: number) => `First to ${n} wins`,
    controlsMouse: "Mouse: move your rods. Click: kick, hold for power",
    controlsRed: "Red: W / S to move, D to kick",
    controlsBlue: "Blue: arrow up / down to move, arrow left to kick",
    controlsCamera: "Right-click and drag: move the camera. Wheel: zoom. Space: serve again",
    goal: "GOOOAL!",
    matchPoint: "Match point",
    won: (team: string) => `${team} wins!`,
    rematch: "Rematch",
    menu: "Menu",
    resetView: "Camera",
    lang: "Español",
  },
} as const satisfies Record<Lang, unknown>;

export type Strings = (typeof strings)[Lang];
