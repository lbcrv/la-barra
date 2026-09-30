"use client";

import { useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { CABINET, FIELD } from "@/game/table";
import { seeded, toonGradient } from "./toon";

/** The shop floor level, under the table legs. */
const FLOOR_Y = -CABINET.depth - CABINET.legHeight;
/** How far behind the table the shop wall stands, and how tall it is. */
const WALL_Z = -1.5;
const WALL_H = 2.6;
const WALL_W = 5;

/**
 * The shop wall, hand-painted: two-tone paint, the shop's name, and the signs
 * every pulpería has. In-world signage stays in Spanish in both languages.
 */
function wallTexture() {
  const W = 2000;
  const H = 1040;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const r = seeded(4);

  // Lime-green upper wall over a darker wainscot band, as shops paint them.
  g.fillStyle = "#8fc454";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#2f7d4f";
  g.fillRect(0, H * 0.72, W, H * 0.28);
  g.fillStyle = "#f2b632";
  g.fillRect(0, H * 0.7, W, 18);
  // Brush marks and scuffs.
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? "30,50,20" : "255,255,220"},${r() * 0.06})`;
    g.fillRect(r() * W, r() * H, 20 + r() * 120, 3 + r() * 6);
  }

  const sign = (text: string, x: number, y: number, size: number, fill: string, stroke: string, rot = 0) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.font = `900 ${size}px "Alfa Slab One", Georgia, serif`;
    g.textAlign = "center";
    g.lineJoin = "round";
    g.lineWidth = size * 0.16;
    g.strokeStyle = stroke;
    g.strokeText(text, 0, 0);
    g.fillStyle = fill;
    g.fillText(text, 0, 0);
    g.restore();
  };

  // The shop's name on a painted board.
  g.fillStyle = "#f6ead0";
  g.strokeStyle = "#1b1410";
  g.lineWidth = 10;
  g.beginPath();
  g.roundRect(W / 2 - 560, 60, 1120, 190, 26);
  g.fill();
  g.stroke();
  sign("PULPERÍA LA ESQUINA", W / 2, 190, 104, "#d7322a", "#1b1410");

  sign("HOY NO SE FÍA", 330, 420, 70, "#f6ead0", "#1b1410", -0.04);
  sign("MAÑANA SÍ", 330, 500, 60, "#f2b632", "#1b1410", -0.04);
  sign("HAY HIELO", W - 320, 420, 72, "#2563c9", "#f6ead0", 0.05);
  sign("SE VENDEN RECARGAS", W - 360, 520, 50, "#f6ead0", "#1b1410", 0.03);

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Bottles, boxes and bags on the shelves: rows of bright cartoon shapes. */
const PRODUCT_COLOURS = ["#d7322a", "#2563c9", "#f2b632", "#f6ead0", "#2f8f46", "#e06f1f", "#7b3fa0"];

function Shelves() {
  const grad = toonGradient();
  const items = useMemo(() => {
    const r = seeded(9);
    const out: { x: number; y: number; w: number; h: number; d: number; round: boolean; color: string }[] = [];
    for (const [shelfY, from, to] of [
      [0.35, -2.1, -0.75],
      [0.75, -2.1, -0.75],
      [0.35, 0.75, 2.1],
      [0.75, 0.75, 2.1],
    ] as const) {
      let x = from;
      while (x < to) {
        const round = r() < 0.45;
        const w = round ? 0.07 : 0.08 + r() * 0.1;
        const h = round ? 0.2 + r() * 0.08 : 0.1 + r() * 0.16;
        out.push({ x: x + w / 2, y: shelfY, w, h, d: 0.12, round, color: PRODUCT_COLOURS[Math.floor(r() * PRODUCT_COLOURS.length)] });
        x += w + 0.02 + r() * 0.03;
      }
    }
    return out;
  }, []);

  return (
    <group position={[0, FLOOR_Y + 0.9, WALL_Z + 0.12]}>
      {[
        [0.35, -1.42],
        [0.75, -1.42],
        [0.35, 1.42],
        [0.75, 1.42],
      ].map(([y, x], i) => (
        <mesh key={i} position={[x, y - 0.015, 0]}>
          <boxGeometry args={[1.4, 0.03, 0.2]} />
          <meshToonMaterial color="#6b4226" gradientMap={grad} />
        </mesh>
      ))}
      {items.map((it, i) => (
        <mesh key={i} position={[it.x, it.y + it.h / 2, 0]}>
          {it.round ? <cylinderGeometry args={[it.w / 2, it.w / 2, it.h, 12]} /> : <boxGeometry args={[it.w, it.h, it.d]} />}
          <meshToonMaterial color={it.color} gradientMap={grad} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The corner shop around the table: the painted back wall with its signs and
 * shelves, and a matching wall at blue's end for the view a phone gets from
 * behind red's goal.
 */
export function Backdrop() {
  const tex = useMemo(() => wallTexture(), []);
  const grad = toonGradient();
  return (
    <group>
      <mesh position={[0, FLOOR_Y + WALL_H / 2, WALL_Z]}>
        <planeGeometry args={[WALL_W, WALL_H]} />
        <meshToonMaterial map={tex} gradientMap={grad} fog={false} />
      </mesh>
      <Shelves />
      <mesh position={[FIELD.length / 2 + 1.6, FLOOR_Y + WALL_H / 2, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[WALL_W, WALL_H]} />
        <meshToonMaterial map={tex} gradientMap={grad} fog={false} />
      </mesh>
    </group>
  );
}
