"use client";

import { Dialog } from "./Dialog";
import { Board } from "./Menu";
import { strings, type Lang } from "./strings";

/** The match on hold: keep playing, change options, start over or leave. */
export function Pause({
  lang,
  online,
  onResume,
  onOptions,
  onRestart,
  onQuit,
}: {
  lang: Lang;
  /** Online the table keeps going; the window says so. */
  online: boolean;
  onResume: () => void;
  onOptions: () => void;
  /** Null for the online guest, who can't restart the host's match. */
  onRestart: (() => void) | null;
  onQuit: () => void;
}) {
  const t = strings[lang];
  return (
    <Dialog label={t.pause.title} onClose={onResume} className="max-w-sm">
      <Board className="text-center">
        <h2 className="font-chalk text-5xl text-gold">{t.pause.title}</h2>
        {online && <p className="mt-1 text-base font-semibold text-chalk/85">{t.pause.online}</p>}
        <div className="mt-5 grid gap-3">
          <button onClick={onResume} className="toon-button bg-gold text-lg text-ink" data-autofocus>
            {t.pause.resume}
          </button>
          <button onClick={onOptions} className="toon-button bg-cream text-ink">
            {t.options}
          </button>
          {onRestart && (
            <button onClick={onRestart} className="toon-button bg-cream text-ink">
              {t.pause.restart}
            </button>
          )}
          <button onClick={onQuit} className="toon-button bg-red text-cream">
            {t.pause.quit}
          </button>
        </div>
      </Board>
    </Dialog>
  );
}
