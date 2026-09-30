import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import { FIELD } from "@/game/table";

/** Small seeded PRNG so the table looks the same on every visit. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

function finish(c: HTMLCanvasElement, repeat = 1) {
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  return tex;
}

/** Varnished wood with long grain, a few knots, and the varnish worn pale where hands rest. */
export function woodTexture(seed = 7, base = "#6b4226") {
  const rand = rng(seed);
  const { c, g } = canvas(1024, 512);
  g.fillStyle = base;
  g.fillRect(0, 0, 1024, 512);

  // Grain: long wavy lines, darker and lighter.
  for (let i = 0; i < 260; i++) {
    const y = rand() * 512;
    const amp = 2 + rand() * 6;
    const freq = 0.004 + rand() * 0.01;
    const phase = rand() * 6.28;
    g.strokeStyle = rand() < 0.6 ? `rgba(40,20,8,${0.08 + rand() * 0.18})` : `rgba(210,150,90,${0.05 + rand() * 0.1})`;
    g.lineWidth = 0.6 + rand() * 2.2;
    g.beginPath();
    for (let x = 0; x <= 1024; x += 8) {
      const yy = y + Math.sin(x * freq + phase) * amp;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }

  // Knots, with grain bending around them.
  for (let k = 0; k < 3; k++) {
    const x = 100 + rand() * 820;
    const y = 60 + rand() * 390;
    for (let r = 26; r > 2; r -= 3) {
      g.strokeStyle = `rgba(35,16,6,${0.12 + (26 - r) * 0.012})`;
      g.lineWidth = 1.4;
      g.beginPath();
      g.ellipse(x, y, r * 2.2, r * 0.7, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }

  // Worn varnish and scratches.
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(255,220,170,${rand() * 0.035})`;
    g.fillRect(rand() * 1024, rand() * 512, 1 + rand() * 30, 1 + rand() * 2);
  }
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(230,190,140,${0.05 + rand() * 0.1})`;
    g.lineWidth = 0.5 + rand();
    g.beginPath();
    const x = rand() * 1024;
    const y = rand() * 512;
    g.moveTo(x, y);
    g.lineTo(x + (rand() - 0.5) * 120, y + (rand() - 0.5) * 30);
    g.stroke();
  }
  return finish(c);
}

/**
 * The painted playing field: green with white lines, 1 px per millimetre.
 * The middle is worn pale where the ball runs most, and the lines are chipped.
 */
export function fieldTexture() {
  const rand = rng(21);
  const W = Math.round(FIELD.length * 1000);
  const H = Math.round(FIELD.width * 1000);
  const { c, g } = canvas(W, H);

  g.fillStyle = "#2c6a3b";
  g.fillRect(0, 0, W, H);

  // Brush strokes in the paint.
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rand() < 0.5 ? `rgba(20,60,30,${rand() * 0.12})` : `rgba(90,150,90,${rand() * 0.07})`;
    g.fillRect(rand() * W, rand() * H, 20 + rand() * 180, 2 + rand() * 4);
  }

  // Worn pale through the middle, where every rally passes.
  const wear = g.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.45);
  wear.addColorStop(0, "rgba(190,200,150,0.22)");
  wear.addColorStop(1, "rgba(190,200,150,0)");
  g.fillStyle = wear;
  g.fillRect(0, 0, W, H);

  // Lines.
  g.strokeStyle = "rgba(238,232,214,0.92)";
  g.lineWidth = 6;
  const m = 22;
  g.strokeRect(m, m, W - 2 * m, H - 2 * m);
  g.beginPath();
  g.moveTo(W / 2, m);
  g.lineTo(W / 2, H - m);
  g.stroke();
  g.beginPath();
  g.arc(W / 2, H / 2, 95, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "rgba(238,232,214,0.92)";
  g.beginPath();
  g.arc(W / 2, H / 2, 8, 0, Math.PI * 2);
  g.fill();
  for (const end of [0, 1]) {
    const dir = end === 0 ? 1 : -1;
    const x0 = end === 0 ? m : W - m;
    // Penalty area and goal area.
    g.strokeRect(Math.min(x0, x0 + dir * 150), H / 2 - 190, 150, 380);
    g.strokeRect(Math.min(x0, x0 + dir * 60), H / 2 - 115, 60, 230);
  }

  // Chipped paint: flecks of green over the lines, and bare wood showing through.
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = `rgba(44,106,59,${0.5 + rand() * 0.5})`;
    g.fillRect(rand() * W, rand() * H, 1 + rand() * 5, 1 + rand() * 4);
  }
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(150,125,85,${0.18 + rand() * 0.22})`;
    const r = 0.8 + rand() * 2.2;
    g.beginPath();
    g.ellipse(rand() * W, rand() * H, r * 1.6, r, rand() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const tex = finish(c);
  tex.repeat.set(1, 1);
  return tex;
}

/** Cement floor of the shop, stained and scuffed. */
export function floorTexture() {
  const rand = rng(3);
  const { c, g } = canvas(512, 512);
  g.fillStyle = "#3a332c";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(${rand() < 0.5 ? "0,0,0" : "120,105,90"},${rand() * 0.08})`;
    g.fillRect(rand() * 512, rand() * 512, 2 + rand() * 6, 2 + rand() * 6);
  }
  g.strokeStyle = "rgba(0,0,0,0.35)";
  g.lineWidth = 2;
  for (let i = 0; i <= 512; i += 256) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 512);
    g.moveTo(0, i);
    g.lineTo(512, i);
    g.stroke();
  }
  return finish(c, 6);
}
