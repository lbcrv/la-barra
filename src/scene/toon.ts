import { DataTexture, NearestFilter, RedFormat } from "three";

/** Ink for every outline, the same as the UI's. */
export const INK = "#1b1410";
/** Outline width in screen pixels, so it reads the same near and far. */
export const OUTLINE_PX = 2.4;

let gradient: DataTexture | null = null;

/**
 * Three flat bands of light (shadow, mid, lit) instead of a smooth falloff:
 * the cartoon look. Shared by every toon material.
 */
export function toonGradient(): DataTexture {
  if (gradient) return gradient;
  gradient = new DataTexture(new Uint8Array([90, 175, 255]), 3, 1, RedFormat);
  gradient.minFilter = gradient.magFilter = NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

/** Small seeded PRNG so every player looks the same on every visit. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
