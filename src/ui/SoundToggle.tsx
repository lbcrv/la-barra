"use client";

import { useSyncExternalStore } from "react";
import { setSoundOn, soundOn, subscribeSound } from "@/scene/sound";
import { strings, type Lang } from "./strings";

export function SoundToggle({ lang, className = "hud-link" }: { lang: Lang; className?: string }) {
  // The server renders it on; the browser then reads the saved choice.
  const on = useSyncExternalStore(subscribeSound, soundOn, () => true);
  return (
    <button onClick={() => setSoundOn(!on)} aria-pressed={on} className={className}>
      {on ? strings[lang].sound.on : strings[lang].sound.off}
    </button>
  );
}
