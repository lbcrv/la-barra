"use client";

import { memo, useMemo } from "react";
import { BoxGeometry, CanvasTexture, Color, CylinderGeometry, Float32BufferAttribute, SRGBColorSpace, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CABINET, FIELD } from "@/game/table";
import { seeded, toonGradient } from "./toon";

/** The shop floor level, under the table legs. */
const FLOOR_Y = -CABINET.depth - CABINET.legHeight;
/** How far behind the table the shop wall stands, and how tall it is. */
const WALL_Z = -1.5;
const WALL_H = 2.6;
const WALL_W = 5;

/** Where the shelves hang on the back wall, in metres from the wall's centre and the floor. */
const SHELVES = [
  { x: -1.42, y: 0.35 },
  { x: -1.42, y: 0.75 },
  { x: 1.42, y: 0.35 },
  { x: 1.42, y: 0.75 },
];
const SHELF_W = 1.4;
const SHELF_BASE = 0.9;

/**
 * A shop wall, hand-painted, with no lettering: two-tone paint with a gold
 * stripe, a string of papel picado along the top, and things hung only where
 * nothing in front can cover them. The back wall keeps a wall clock in the
 * clear space between its shelves; the side walls get framed pictures.
 */
function wallTexture(variant: "back" | "side") {
  const W = 2000;
  const H = 1040;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const r = seeded(variant === "back" ? 4 : 5);

  // Lime-green upper wall over a darker wainscot band, as shops paint them.
  g.fillStyle = "#8fc454";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#2f7d4f";
  g.fillRect(0, H * 0.72, W, H * 0.28);
  g.fillStyle = "#f2b632";
  g.fillRect(0, H * 0.7, W, 18);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? "30,50,20" : "255,255,220"},${r() * 0.06})`;
    g.fillRect(r() * W, r() * H, 20 + r() * 120, 3 + r() * 6);
  }

  papelPicado(g, W, r);
  if (variant === "back") {
    clock(g, W / 2, 330, 105);
  } else {
    framedPicture(g, W * 0.3, 420, 300, 220, r);
    framedPicture(g, W * 0.7, 400, 240, 300, r);
  }

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const PAPEL = ["#d7322a", "#2563c9", "#f2b632", "#f6ead0", "#2f8f46", "#e06f1f"];

/** A string of cut-paper flags sagging along the top of the wall. */
function papelPicado(g: CanvasRenderingContext2D, W: number, r: () => number) {
  const top = 40;
  const sag = 26;
  const flag = { w: 92, h: 118 };
  const count = Math.floor(W / (flag.w + 16));
  const yAt = (x: number) => top + sag * Math.sin((x / W) * Math.PI * 3) ** 2;
  g.strokeStyle = "#1b1410";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(0, yAt(0));
  for (let x = 20; x <= W; x += 20) g.lineTo(x, yAt(x));
  g.stroke();
  for (let i = 0; i < count; i++) {
    const x = 20 + i * (flag.w + 16);
    const y = yAt(x + flag.w / 2);
    g.fillStyle = PAPEL[i % PAPEL.length];
    g.strokeStyle = "#1b1410";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + flag.w, y);
    // Scalloped bottom edge.
    for (let k = 4; k >= 0; k--) g.lineTo(x + (flag.w * k) / 4, y + flag.h - (k % 2 === 0 ? 18 : 0));
    g.closePath();
    g.fill();
    g.stroke();
    // Cut-outs showing the wall through.
    g.fillStyle = "#8fc454";
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      g.arc(x + 18 + r() * (flag.w - 36), y + 22 + r() * (flag.h - 56), 5 + r() * 6, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function clock(g: CanvasRenderingContext2D, x: number, y: number, rad: number) {
  g.fillStyle = "#1b1410";
  g.beginPath();
  g.arc(x + 8, y + 8, rad, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f6ead0";
  g.strokeStyle = "#1b1410";
  g.lineWidth = 12;
  g.beginPath();
  g.arc(x, y, rad, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const inner = i % 3 === 0 ? rad * 0.72 : rad * 0.82;
    g.lineWidth = i % 3 === 0 ? 7 : 4;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
    g.lineTo(x + Math.cos(a) * rad * 0.9, y + Math.sin(a) * rad * 0.9);
    g.stroke();
  }
  // Ten to four in the afternoon, as the shop fills up for a game.
  const hand = (turns: number, len: number, width: number) => {
    const a = turns * Math.PI * 2 - Math.PI / 2;
    g.strokeStyle = "#1b1410";
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  };
  hand(3.83 / 12, rad * 0.5, 10);
  hand(50 / 60, rad * 0.72, 7);
  g.fillStyle = "#d7322a";
  g.beginPath();
  g.arc(x, y, 9, 0, Math.PI * 2);
  g.fill();
}

/** A framed picture: a neighbourhood team lined up on a green pitch, drawn as shapes. */
function framedPicture(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, r: () => number) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  g.fillStyle = "#1b1410";
  g.fillRect(x + 8, y + 8, w, h);
  g.fillStyle = "#6b4226";
  g.fillRect(x, y, w, h);
  g.strokeStyle = "#1b1410";
  g.lineWidth = 6;
  g.strokeRect(x, y, w, h);
  const m = 22;
  const iw = w - 2 * m;
  const ih = h - 2 * m;
  g.fillStyle = "#9fd8f0";
  g.fillRect(x + m, y + m, iw, ih * 0.5);
  g.fillStyle = "#2f8f46";
  g.fillRect(x + m, y + m + ih * 0.5, iw, ih * 0.5);
  const kit = r() < 0.5 ? "#d7322a" : "#2563c9";
  const n = 5;
  for (let i = 0; i < n; i++) {
    const px = x + m + ((i + 0.5) * iw) / n;
    const py = y + m + ih * 0.55;
    g.fillStyle = kit;
    g.fillRect(px - 11, py, 22, 30);
    g.fillStyle = ["#f0c090", "#b77b4b", "#8d5a34"][i % 3];
    g.beginPath();
    g.arc(px, py - 8, 10, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = "#1b1410";
  g.lineWidth = 4;
  g.strokeRect(x + m, y + m, iw, ih);
}

/** Bottles, boxes and bags on the shelves: bright cartoon shapes, all merged into one mesh. */
const PRODUCT_COLOURS = ["#d7322a", "#2563c9", "#f2b632", "#f6ead0", "#2f8f46", "#e06f1f", "#7b3fa0"];

function shelvesGeometry() {
  const r = seeded(9);
  const parts: BufferGeometry[] = [];
  const add = (geo: BufferGeometry, x: number, y: number, colour: string) => {
    geo.translate(x, y, 0);
    const col = new Color(colour);
    const n = geo.getAttribute("position").count;
    const colors = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) colors.set([col.r, col.g, col.b], k * 3);
    geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geo.deleteAttribute("uv");
    parts.push(geo);
  };
  for (const shelf of SHELVES) {
    add(new BoxGeometry(SHELF_W, 0.03, 0.2), shelf.x, shelf.y - 0.015, "#6b4226");
    let x = shelf.x - SHELF_W / 2 + 0.02;
    while (x < shelf.x + SHELF_W / 2 - 0.1) {
      const round = r() < 0.45;
      const w = round ? 0.07 : 0.08 + r() * 0.1;
      const h = round ? 0.2 + r() * 0.08 : 0.1 + r() * 0.16;
      const colour = PRODUCT_COLOURS[Math.floor(r() * PRODUCT_COLOURS.length)];
      add(round ? new CylinderGeometry(w / 2, w / 2, h, 12) : new BoxGeometry(w, h, 0.12), x + w / 2, shelf.y + h / 2, colour);
      x += w + 0.02 + r() * 0.03;
    }
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

function Shelves() {
  const grad = toonGradient();
  const geometry = useMemo(() => shelvesGeometry(), []);
  return (
    <mesh geometry={geometry} position={[0, FLOOR_Y + SHELF_BASE, WALL_Z + 0.12]}>
      <meshToonMaterial vertexColors gradientMap={grad} />
    </mesh>
  );
}

/** Half the room's size along the table (x) and across it toward the camera (z). */
const ROOM_X = FIELD.length / 2 + 1.6;
const ROOM_Z_NEAR = 2.3;

/**
 * The corner shop all around the table, so the camera never looks into a void:
 * the back wall with the shop's name, signs and shelves, a tournament poster at
 * red's end, the signs again at blue's end, and a plain wall behind the player.
 * Each wall faces inward and is one-sided, so when the camera swings behind one
 * it simply disappears instead of blocking the view.
 */
export const Backdrop = memo(function Backdrop() {
  const back = useMemo(() => wallTexture("back"), []);
  const side = useMemo(() => wallTexture("side"), []);
  const grad = toonGradient();
  const y = FLOOR_Y + WALL_H / 2;
  const walls: { tex: typeof back; pos: [number, number, number]; rot: number; w: number }[] = [
    { tex: back, pos: [0, y, WALL_Z], rot: 0, w: WALL_W },
    { tex: side, pos: [ROOM_X, y, (WALL_Z + ROOM_Z_NEAR) / 2], rot: -Math.PI / 2, w: ROOM_Z_NEAR - WALL_Z },
    { tex: side, pos: [-ROOM_X, y, (WALL_Z + ROOM_Z_NEAR) / 2], rot: Math.PI / 2, w: ROOM_Z_NEAR - WALL_Z },
    { tex: side, pos: [0, y, ROOM_Z_NEAR], rot: Math.PI, w: WALL_W },
  ];
  return (
    <group>
      {walls.map((wall, i) => (
        <mesh key={i} position={wall.pos} rotation-y={wall.rot}>
          <planeGeometry args={[wall.w, WALL_H]} />
          <meshToonMaterial map={wall.tex} gradientMap={grad} fog={false} />
        </mesh>
      ))}
      <Shelves />
    </group>
  );
});
