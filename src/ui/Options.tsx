"use client";

import { useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { setSoundOn, soundOn, subscribeSound } from "@/scene/sound";
import { IconClose, Key } from "./art";
import { Dialog } from "./Dialog";
import { setSetting, useSettings, type Settings } from "./settings";
import { strings, type Lang } from "./strings";

export type OptionsTab = "look" | "access" | "controls";
const TABS: OptionsTab[] = ["look", "access", "controls"];

/** The options window: sound and picture, accessibility, and the controls guide. */
export function Options({
  lang,
  setLang,
  tab: initialTab = "look",
  onClose,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  tab?: OptionsTab;
  onClose: () => void;
}) {
  const t = strings[lang].settings;
  const [tab, setTab] = useState<OptionsTab>(initialTab);
  const s = useSettings();
  const sound = useSyncExternalStore(subscribeSound, soundOn, () => true);
  const id = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between the tabs, as a tab list should.
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + TABS.length) % TABS.length;
    setTab(TABS[next]);
    tabRefs.current[next]?.focus();
  };

  return (
    <Dialog label={t.title} onClose={onClose} className="max-w-2xl">
      <div className="toon-panel overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b-[3px] border-ink bg-gold px-4 py-3 sm:px-6">
          <h2 className="font-sign text-3xl">{t.title}</h2>
          <button onClick={onClose} className="icon-button" aria-label={t.close}>
            <IconClose />
          </button>
        </header>

        <div role="tablist" aria-label={t.title} className="flex flex-wrap gap-2 border-b-[3px] border-ink px-3 py-3 sm:px-5">
          {TABS.map((k, i) => (
            <button
              key={k}
              ref={(el) => void (tabRefs.current[i] = el)}
              role="tab"
              id={`${id}-tab-${k}`}
              aria-selected={tab === k}
              aria-controls={`${id}-panel`}
              tabIndex={tab === k ? 0 : -1}
              onClick={() => setTab(k)}
              onKeyDown={(e) => onTabKey(e, i)}
              data-autofocus={k === initialTab ? true : undefined}
              className={`min-h-11 cursor-pointer rounded-xl border-[3px] border-ink px-3.5 text-base font-semibold ${tab === k ? "bg-ink text-cream" : "bg-cream"}`}
            >
              {t.tabs[k]}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`} className="max-h-[60dvh] overflow-y-auto px-4 py-2 sm:px-6">
          {tab === "look" && (
            <>
              <Row label={t.sound}>
                <Switch on={sound} onChange={setSoundOn} label={t.sound[0]} yes={t.yes} no={t.no} />
              </Row>
              <Row label={t.volume} wide>
                <div className="flex w-full items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(s.volume * 100)}
                    onChange={(e) => setSetting("volume", Number(e.target.value) / 100)}
                    className="toon-range"
                    aria-label={t.volume[0]}
                    disabled={!sound}
                  />
                  <span className="w-12 text-right text-lg font-semibold tabular-nums">{Math.round(s.volume * 100)}%</span>
                </div>
              </Row>
              <Row label={t.quality}>
                <Choice
                  label={t.quality[0]}
                  value={s.quality}
                  options={[
                    ["high", t.high],
                    ["low", t.low],
                  ]}
                  onChange={(v) => setSetting("quality", v)}
                />
              </Row>
              <Row label={t.language}>
                <Choice
                  label={t.language[0]}
                  value={lang}
                  options={[
                    ["es", "Español"],
                    ["en", "English"],
                  ]}
                  onChange={setLang}
                />
              </Row>
            </>
          )}

          {tab === "access" && (
            <>
              <Toggle k="reduceMotion" label={t.reduceMotion} s={s} yes={t.yes} no={t.no} />
              <Toggle k="shake" label={t.shake} s={s} yes={t.yes} no={t.no} disabled={s.reduceMotion} />
              <Row label={t.textSize}>
                <Choice
                  label={t.textSize[0]}
                  value={String(s.textSize)}
                  options={([1, 1.15, 1.3] as const).map((v) => [String(v), t.sizes[v]] as [string, string])}
                  onChange={(v) => setSetting("textSize", Number(v) as Settings["textSize"])}
                />
              </Row>
              <Toggle k="contrast" label={t.contrast} s={s} yes={t.yes} no={t.no} />
              <Toggle k="subtitles" label={t.subtitles} s={s} yes={t.yes} no={t.no} />
              <Toggle k="hints" label={t.hints} s={s} yes={t.yes} no={t.no} />
              <p className="py-4 text-base leading-snug font-semibold text-ink/75">{t.teamsNote}</p>
            </>
          )}

          {tab === "controls" && <Guide lang={lang} />}
        </div>
      </div>
    </Dialog>
  );
}

/** One option: its name and what it does on the left, the control on the right. */
function Row({ label: [name, note], wide = false, children }: { label: readonly [string, string]; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`flex gap-x-6 gap-y-2 border-b-2 border-dashed border-ink/20 py-4 last:border-b-0 ${wide ? "flex-col" : "flex-wrap items-center justify-between"}`}>
      <div className={`min-w-0 ${wide ? "" : "flex-1 basis-56"}`}>
        <p className="text-lg leading-tight font-semibold">{name}</p>
        {note && <p className="mt-0.5 text-base leading-snug text-ink/70">{note}</p>}
      </div>
      {children}
    </div>
  );
}

function Switch({ on, onChange, label, yes, no, disabled = false }: { on: boolean; onChange: (v: boolean) => void; label: string; yes: string; no: string; disabled?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="w-8 text-right text-base font-semibold" aria-hidden="true">
        {on ? yes : no}
      </span>
      <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} disabled={disabled} className="switch disabled:cursor-not-allowed disabled:opacity-45" />
    </span>
  );
}

function Toggle({ k, label, s, yes, no, disabled }: { k: "reduceMotion" | "shake" | "contrast" | "subtitles" | "hints"; label: readonly [string, string]; s: Settings; yes: string; no: string; disabled?: boolean }) {
  // Reduced motion turns the shake off too; the switch shows that.
  const on = k === "shake" ? s.shake && !s.reduceMotion : s[k];
  return (
    <Row label={label}>
      <Switch on={on} onChange={(v) => setSetting(k, v)} label={label[0]} yes={yes} no={no} disabled={disabled} />
    </Row>
  );
}

/** A small set of choices, one picked: a radio group drawn as joined buttons. */
function Choice<V extends string>({ label, value, options, onChange }: { label: string; value: V; options: [V, string][]; onChange: (v: V) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    onChange(options[next][0]);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="segmented">
      {options.map(([v, text], i) => (
        <button
          key={v}
          ref={(el) => void (refs.current[i] = el)}
          role="radio"
          aria-checked={value === v}
          tabIndex={value === v ? 0 : -1}
          onClick={() => onChange(v)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** How to play: every control for every way to hold the game, and the four rules. */
export function Guide({ lang }: { lang: Lang }) {
  const g = strings[lang].guide;
  const rows: [string, [string, ReactNode][]][] = [
    [
      g.mouse,
      [
        [g.move, g.point],
        [g.kick, g.click],
        [g.pass, g.rightTap],
        [g.camera, g.rightDrag],
      ],
    ],
    [
      g.touch,
      [
        [g.move, g.slide],
        [g.kick, g.tap],
        [g.pass, g.twoTap],
        [g.camera, g.twoDrag],
      ],
    ],
    [
      g.red,
      [
        [g.move, <Keys key="m" keys={["W", "S"]} />],
        [g.kick, <Keys key="k" keys={["D"]} />],
        [g.pass, <Keys key="p" keys={["A"]} />],
      ],
    ],
    [
      g.blue,
      [
        [g.move, <Keys key="m" keys={["↑", "↓"]} />],
        [g.kick, <Keys key="k" keys={["←"]} />],
        [g.pass, <Keys key="p" keys={["→"]} />],
      ],
    ],
  ];
  return (
    <div className="py-3">
      <ol className="space-y-2">
        {g.rules.map((r, i) => (
          <li key={i} className="flex gap-3 text-lg leading-snug">
            <span className="font-sign grid size-7 flex-none place-items-center rounded-full border-[2.5px] border-ink bg-gold text-sm">{i + 1}</span>
            <span>{r}</span>
          </li>
        ))}
      </ol>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {rows.map(([title, items]) => (
          <section key={title} className="rounded-xl border-[3px] border-ink bg-white/60 px-3.5 py-3">
            <h3 className="font-sign text-lg">{title}</h3>
            <dl className="mt-1.5 space-y-1.5">
              {items.map(([what, how]) => (
                <div key={what} className="flex items-center justify-between gap-3">
                  <dt className="text-base font-semibold text-ink/70">{what}</dt>
                  <dd className="text-right text-base font-semibold">{how}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex gap-1.5">
      {keys.map((k) => (
        <Key key={k}>{k}</Key>
      ))}
    </span>
  );
}
