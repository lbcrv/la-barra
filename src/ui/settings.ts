"use client";

import { useSyncExternalStore } from "react";

/**
 * The player's options, kept in this browser between visits. Sound on and off
 * lives with the sound itself (`scene/sound.ts`); everything else is here.
 */
export interface Settings {
  /** Master volume, 0 to 1. */
  volume: number;
  /** "low" drops the shadows and renders fewer pixels, for slower machines. */
  quality: "high" | "low";
  /** Camera shake on goals and big shots. */
  shake: boolean;
  /** Fewer animations: no pop-in lettering, no confetti, no shake. */
  reduceMotion: boolean;
  /** Text size, as a scale on the whole interface. */
  textSize: 1 | 1.15 | 1.3;
  /** Solid backing behind every piece of text drawn over the table. */
  contrast: boolean;
  /** Don Chepe's lines on screen. */
  subtitles: boolean;
  /** The controls reminder at the bottom of the screen during a match. */
  hints: boolean;
}

const KEY = "la-barra:settings";

function defaults(): Settings {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return { volume: 0.8, quality: "high", shake: !reduce, reduceMotion: !!reduce, textSize: 1, contrast: false, subtitles: true, hints: true };
}

/** What the server renders with, before the browser reads the saved choices. */
const SERVER: Settings = { volume: 0.8, quality: "high", shake: true, reduceMotion: false, textSize: 1, contrast: false, subtitles: true, hints: true };

let current: Settings | null = null;
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  if (!current) {
    current = defaults();
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Settings> | null;
      if (saved && typeof saved === "object") current = { ...current, ...saved };
    } catch {
      // Nothing saved, or storage is blocked: the defaults stand.
    }
  }
  return current;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  current = { ...getSettings(), [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Remembered for this visit only.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, () => SERVER);
}
