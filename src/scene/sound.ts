/**
 * Table sounds synthesized with Web Audio: no files to ship or license.
 * kick: a boot on the ball. wall: the ball against the wood. goal: the ball
 * dropping into the pocket and the shop cheering. bead: an abacus bead
 * sliding home. power: an arcade chime. whistle: start and end of a match.
 */
export type Cue = "kick" | "wall" | "goal" | "bead" | "power" | "whistle";

const STORAGE_KEY = "la-barra:sound";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let enabled: boolean | null = null;
const listeners = new Set<() => void>();

export function soundOn(): boolean {
  if (enabled === null) {
    try {
      enabled = localStorage.getItem(STORAGE_KEY) !== "off";
    } catch {
      enabled = true;
    }
  }
  return enabled;
}

export function setSoundOn(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Remembered for this visit only.
  }
  listeners.forEach((l) => l());
}

export function subscribeSound(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Browsers allow audio only after the player interacts, so the context is made on first use. */
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function burst(a: AudioContext, at: number, o: { type: BiquadFilterType; freq: number; q?: number; peak: number; attack: number; decay: number; to?: number }) {
  const src = a.createBufferSource();
  src.buffer = noise;
  const f = a.createBiquadFilter();
  f.type = o.type;
  f.frequency.setValueAtTime(o.freq, at);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, at + o.attack + o.decay);
  f.Q.value = o.q ?? 1;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(o.peak, at + o.attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + o.attack + o.decay);
  src.connect(f).connect(g).connect(master!);
  src.start(at, Math.random() * 1.5, o.attack + o.decay + 0.05);
}

function tone(a: AudioContext, at: number, o: { type: OscillatorType; from: number; to?: number; peak: number; decay: number; attack?: number }) {
  const osc = a.createOscillator();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.from, at);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + o.decay);
  const g = a.createGain();
  const attack = o.attack ?? 0.002;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(o.peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + o.decay);
  osc.connect(g).connect(master!);
  osc.start(at);
  osc.stop(at + attack + o.decay + 0.05);
}

/** Plays a cue. `strength` (0 to 1) scales hits so soft taps are quiet. */
export function play(cue: Cue, strength = 1) {
  if (!soundOn()) return;
  const a = audio();
  if (!a || !master || !noise) return;
  const t = a.currentTime + 0.005;
  const s = Math.max(0.15, Math.min(1, strength));

  switch (cue) {
    case "kick":
      // Hollow wooden boot on a cork ball.
      tone(a, t, { type: "triangle", from: 420 + s * 180, to: 160, peak: 0.55 * s, decay: 0.07 });
      burst(a, t, { type: "bandpass", freq: 1800, q: 1.2, peak: 0.35 * s, attack: 0.001, decay: 0.03 });
      break;
    case "wall":
      tone(a, t, { type: "sine", from: 190, to: 110, peak: 0.4 * s, decay: 0.08 });
      burst(a, t, { type: "lowpass", freq: 900, peak: 0.25 * s, attack: 0.002, decay: 0.05 });
      break;
    case "goal":
      // The ball rattling into the pocket, then the shop cheers.
      for (let i = 0; i < 4; i++) {
        tone(a, t + i * 0.06, { type: "triangle", from: 300 - i * 30, to: 150, peak: 0.35 / (i + 1), decay: 0.06 });
      }
      burst(a, t + 0.12, { type: "bandpass", freq: 900, to: 1400, q: 0.6, peak: 0.28, attack: 0.25, decay: 1.4 });
      burst(a, t + 0.15, { type: "bandpass", freq: 2200, q: 0.8, peak: 0.12, attack: 0.3, decay: 1.2 });
      whistle(a, t + 0.1, 0.35);
      break;
    case "bead":
      tone(a, t, { type: "square", from: 1800, peak: 0.06, decay: 0.03 });
      tone(a, t + 0.04, { type: "triangle", from: 900, peak: 0.12, decay: 0.05 });
      break;
    case "power":
      [523, 659, 784, 1047].forEach((f, i) => tone(a, t + i * 0.06, { type: "square", from: f, peak: 0.08, decay: 0.09 }));
      break;
    case "whistle":
      whistle(a, t, 0.55);
      break;
  }
}

/** A referee's pea whistle: a warbling high tone. */
function whistle(a: AudioContext, at: number, length: number) {
  const osc = a.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(2900, at);
  const lfo = a.createOscillator();
  lfo.frequency.value = 38;
  const depth = a.createGain();
  depth.gain.value = 140;
  lfo.connect(depth).connect(osc.frequency);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.13, at + 0.02);
  g.gain.setValueAtTime(0.13, at + length - 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(g).connect(master!);
  osc.start(at);
  lfo.start(at);
  osc.stop(at + length + 0.05);
  lfo.stop(at + length + 0.05);
}
