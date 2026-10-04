"use client";

import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Bot, type Level } from "@/game/bot";
import { handleFromAim, idleInputs, type Inputs } from "@/game/input";
import { goal, matchPoint, newMatch, resume, type Match, type Mode } from "@/game/match";
import { Narrator, type Call } from "@/game/narrator";
import { effects, kickerOf, take, type ActivePower, type Power } from "@/game/powerups";
import { RODS } from "@/game/rods";
import { PHYSICS_HZ } from "@/game/table";
import { TEAMS, type Side } from "@/game/teams";
import { Hud, Victory } from "@/ui/Hud";
import { Menu } from "@/ui/Menu";
import { Online } from "@/ui/Online";
import { Ping } from "@/ui/Ping";
import { Radio } from "@/ui/Radio";
import { strings, type Lang } from "@/ui/strings";
import { PING_EVERY_MS, PING_LOST_MS, q, readCode, SnapshotBuffer, SNAPSHOT_HZ, type HandInput, type Snapshot, type ToGuest, type ToHost } from "@/net/protocol";
import type { GuestSession, HostSession } from "@/net/session";
import { Aim } from "./Aim";
import { Backdrop } from "./Backdrop";
import { Ball, type BallHandle } from "./Ball";
import { BotDriver } from "./BotDriver";
import { Confetti } from "./Confetti";
import { DevStats } from "./DevStats";
import { PowerField } from "./PowerField";
import { CameraRig, Fill, Lamp } from "./Room";
import { Mirror, SyncMeshes } from "./Mirror";
import { Rods, type RemoteRods } from "./Rods";
import { Scoreboard } from "./Scoreboard";
import { play as sfx, type Cue } from "./sound";
import { Table } from "./Table";

/** Pause after a goal before the next ball rolls in, so the goal can land. */
const NEXT_BALL_MS = 1600;
/** Pause before a match's first ball. */
const FIRST_BALL_MS = 900;

/**
 * Keys for two players sharing a keyboard. Red: W/S slide, D kicks, A passes.
 * Blue: arrow up/down slide, arrow left kicks, arrow right passes. Up slides
 * toward the far side.
 */
const KEYS: Record<string, { team: Side; dir?: -1 | 1; kick?: true; pass?: true }> = {
  KeyW: { team: "red", dir: -1 },
  KeyS: { team: "red", dir: 1 },
  KeyD: { team: "red", kick: true },
  KeyA: { team: "red", pass: true },
  ArrowUp: { team: "blue", dir: -1 },
  ArrowDown: { team: "blue", dir: 1 },
  ArrowLeft: { team: "blue", kick: true },
  ArrowRight: { team: "blue", pass: true },
};

/**
 * A pass by pointer is a quick tap with the right button, or with two fingers.
 * Held longer or dragged further, the same gesture turns the camera instead.
 */
const PASS_TAP = { ms: 300, px: 8 };

/** How long Don Chepe's line stays up, and the least time between two "big shot" calls. */
const LINE_MS = 3200;
const BIG_SHOT_GAP_MS = 6000;
/** A kick that adds this much speed (m/s) is a big shot. */
const BIG_SHOT = 3.2;

const now = () => performance.now() / 1000;

/** Which sides a person plays in each mode; the rest are bots. */
const HUMANS: Record<Mode | "demo", Side[]> = { demo: [], bot: ["red"], local: ["red", "blue"], online: ["red", "blue"] };

export function Game() {
  const [lang, setLang] = useState<Lang>("es");
  // Null while the menu is up and the bots play a demo behind it.
  const [match, setMatch] = useState<Match | null>(null);
  const [view, setView] = useState(0);
  // Each goal fires a confetti burst from the net it went into.
  const [burst, setBurst] = useState<{ n: number; scorer: Side | null; conceded: Side | null }>({ n: 0, scorer: null, conceded: null });
  const shake = useRef(0);
  const [powers, setPowers] = useState<ActivePower[]>([]);
  const powersRef = useRef<ActivePower[]>([]);
  const rodSpeed = useRef<Record<Side, number>>({ red: 1, blue: 1 });
  const [hot, setHot] = useState(false);
  // The side that touched the ball last, credited with any cap it rolls over.
  const lastKicker = useRef<Side | null>(null);
  const [line, setLine] = useState<{ text: string; id: number } | null>(null);
  const narrator = useRef(new Narrator());
  const langRef = useRef<Lang>("es");
  const lineTimer = useRef(0);
  const lastBigShot = useRef(0);

  const ball = useRef<BallHandle>(null);
  const inputs = useRef<Inputs>(idleInputs());
  const slides = useRef<number[]>(RODS.map(() => 0));
  const bots = useRef<Bot[]>([new Bot("red", "normal"), new Bot("blue", "normal")]);
  const matchRef = useRef<Match | null>(null);
  const timers = useRef<number[]>([]);
  // Red follows the mouse once it moves over the table, until a key takes over.
  const aiming = useRef(false);
  // One goal per ball: a ball can rattle around the pocket.
  const scored = useRef(false);

  // Online play. The host simulates and plays red; the guest mirrors and plays blue.
  const [role, setRole] = useState<"local" | "host" | "guest">("local");
  const roleRef = useRef<"local" | "host" | "guest">("local");
  const session = useRef<HostSession | GuestSession | null>(null);
  // An invite link (?sala=ABCD) opens the lobby straight into that room.
  const [lobby, setLobby] = useState<{ code: string | null; notice: string | null } | null>(() => {
    const code = readCode(new URLSearchParams(window.location.search).get("sala") ?? "");
    return code ? { code, notice: null } : null;
  });
  const angles = useRef<number[]>(RODS.map(() => 0));
  const activeRods = useRef<Record<Side, number | null>>({ red: null, blue: null });
  const capOut = useRef<{ power: Power; x: number; z: number } | null>(null);
  const [remoteCap, setRemoteCap] = useState<{ power: Power; x: number; z: number } | null>(null);
  const remoteRods = useRef<RemoteRods | null>(null);
  const buffer = useRef(new SnapshotBuffer());
  const lastMatchJson = useRef("");
  const lastCapJson = useRef("");
  const lastPowersKey = useRef("");
  const [ping, setPing] = useState<number | null>(null);
  const [relayed, setRelayed] = useState<boolean | null>(null);
  const lastInputSeq = useRef(0);
  const guestPasses = useRef(0);
  const lastPong = useRef(0);
  // A right-button or two-finger tap that may turn out to be a pass, and the fingers down.
  const passTap = useRef<{ at: number; x: number; y: number } | null>(null);
  const touches = useRef(new Set<number>());

  /** Answers a ping, or takes in a pong; shared by host and guest. */
  const onPing = useCallback((msg: { t: "ping" | "pong"; at: number }) => {
    const s = session.current;
    if (!s) return;
    if (msg.t === "ping") {
      s.send({ t: "pong", at: msg.at });
      return;
    }
    const rtt = performance.now() - msg.at;
    lastPong.current = performance.now();
    // Smooth a little so the number doesn't flicker on every packet.
    setPing((p) => (p === null ? rtt : p + (rtt - p) * 0.3));
  }, []);
  /** The side the local mouse and keys play. */
  const mine: Side = role === "guest" ? "blue" : "red";

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const update = useCallback((m: Match | null) => {
    matchRef.current = m;
    setMatch(m);
  }, []);

  const serve = useCallback(() => {
    if (scored.current) return;
    lastKicker.current = null;
    ball.current?.serve();
  }, []);

  /** A dead or stranded ball: drop a new one in the middle, no key needed. */
  const restartBall = useCallback(() => {
    if (scored.current || roleRef.current === "guest") return;
    lastKicker.current = null;
    ball.current?.drop();
  }, []);

  /** Sends to the guest when hosting; does nothing otherwise. */
  const toGuest = useCallback((msg: ToGuest) => {
    if (roleRef.current === "host") (session.current as HostSession | null)?.send(msg);
  }, []);

  /** Plays a sound here and, when hosting, on the guest's side too. */
  const fx = useCallback(
    (cue: Cue, strength = 1) => {
      sfx(cue, strength);
      if (cue !== "goal") toGuest({ t: "fx", cue, strength: q(strength) });
    },
    [toGuest],
  );

  /** Don Chepe says something, during matches only; the guest hears it in its own language. */
  const say = useCallback((call: Call) => {
    if (!matchRef.current) return;
    toGuest({ t: "call", call });
    const text = narrator.current.line(call, langRef.current, (side) => TEAMS[side].name);
    setLine((l) => ({ text, id: (l?.id ?? 0) + 1 }));
    window.clearTimeout(lineTimer.current);
    lineTimer.current = window.setTimeout(() => setLine(null), LINE_MS);
  }, [toGuest]);

  const setActivePowers = useCallback((next: ActivePower[]) => {
    powersRef.current = next;
    setPowers(next);
  }, []);

  /** Clears the table and hands each side to a person or a bot for the new mode. */
  const setUp = useCallback(
    (mode: Mode | "demo", level: Level) => {
      clearTimers();
      scored.current = false;
      ball.current?.park();
      inputs.current = idleInputs();
      aiming.current = false;
      setActivePowers([]);
      lastKicker.current = null;
      window.clearTimeout(lineTimer.current);
      setLine(null);
      // Back to the playing view, wherever the demo left the camera.
      setView((v) => v + 1);
      const humans = HUMANS[mode];
      bots.current = (["red", "blue"] as const)
        .filter((s) => !humans.includes(s))
        .map((s) => new Bot(s, mode === "demo" ? "normal" : level));
      later(FIRST_BALL_MS, () => ball.current?.serve());
    },
    [clearTimers, later, setActivePowers],
  );

  const play = useCallback(
    (mode: Mode, level: Level) => {
      setUp(mode, level);
      update(newMatch(mode, level));
      fx("whistle");
      say({ kind: "kickoff" });
      toGuest({ t: "start", level });
    },
    [setUp, update, say, fx, toGuest],
  );

  const toMenu = useCallback(() => {
    setUp("demo", "normal");
    update(null);
  }, [setUp, update]);

  const onGoal = useCallback(
    (conceded: Side) => {
      if (scored.current || roleRef.current === "guest") return;
      scored.current = true;
      toGuest({ t: "goal", conceded });
      shake.current = 1;
      setBurst((b) => ({ n: b.n + 1, scorer: conceded === "red" ? "blue" : "red", conceded }));
      const m = matchRef.current;
      const next = m ? goal(m, conceded) : null;
      if (next) {
        update(next);
        sfx("goal");
        later(350, () => fx("bead"));
        if (next.phase === "over") {
          say({ kind: "win", winner: next.last! });
          later(900, () => fx("whistle"));
        } else {
          say({ kind: "goal", scorer: next.last! });
        }
      }
      later(NEXT_BALL_MS, () => {
        ball.current?.park();
        scored.current = false;
        if (next?.phase === "over") return;
        if (next) {
          update(resume(next));
          const leader = (["red", "blue"] as const).find((side) => matchPoint(next, side));
          if (leader) say({ kind: "matchPoint", side: leader });
        }
        serve();
      });
    },
    [later, update, say, serve, fx, toGuest],
  );

  const onHit = useCallback(
    (strength: number, kind: "kick" | "wall", vx: number) => {
      if (kind === "wall") {
        fx("wall", strength / 3);
        return;
      }
      const kicker = kickerOf(vx);
      lastKicker.current = kicker;
      fx("kick", strength / 4);
      const boost = effects(powersRef.current, now()).kickBoost[kicker];
      if (boost > 1) ball.current?.boost(boost);
      if (strength > 2) shake.current = Math.max(shake.current, Math.min(0.45, strength / 10));
      if (strength > BIG_SHOT && performance.now() - lastBigShot.current > BIG_SHOT_GAP_MS) {
        lastBigShot.current = performance.now();
        say({ kind: "bigShot" });
      }
    },
    [say, fx],
  );

  const onTake = useCallback(
    (power: Power) => {
      const side = lastKicker.current;
      if (!side) return;
      setActivePowers(take(powersRef.current, power, side, now()));
      fx("power");
      say({ kind: "power", power, side });
    },
    [say, setActivePowers, fx],
  );

  // Powers run on the clock: apply their effects and drop them as they wear off.
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = now();
      const e = effects(powersRef.current, t);
      rodSpeed.current = e.rodSpeed;
      ball.current?.setDamping(e.ballDamping);
      setHot(e.kickBoost.red > 1 || e.kickBoost.blue > 1);
      const live = powersRef.current.filter((p) => p.until > t);
      if (live.length !== powersRef.current.length) setActivePowers(live);
    }, 100);
    return () => window.clearInterval(id);
  }, [setActivePowers]);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const setOnlineRole = useCallback((r: "local" | "host" | "guest") => {
    roleRef.current = r;
    setRole(r);
  }, []);

  /** Ends online play and goes back to the menu, or to the lobby with a notice. */
  const leaveOnline = useCallback(
    (notice: string | null) => {
      const s = session.current;
      session.current = null;
      if (s) {
        s.onClose = () => {};
        s.send({ t: "bye" } as never);
        s.close();
      }
      remoteRods.current = null;
      setRemoteCap(null);
      setOnlineRole("local");
      toMenu();
      setLobby(notice ? { code: null, notice } : null);
    },
    [setOnlineRole, toMenu],
  );

  const startHosting = useCallback(
    (s: HostSession) => {
      session.current = s;
      setLobby(null);
      setOnlineRole("host");
      s.onClose = () => leaveOnline(strings[langRef.current].net.left);
      s.onMessage = (msg: ToHost) => {
        if (msg.t === "input") {
          const i: HandInput = msg.input;
          // The fast channel keeps no order; an older hand arriving late is ignored.
          if (i.seq <= lastInputSeq.current) return;
          lastInputSeq.current = i.seq;
          // Count each of the guest's passes once, whatever this side's count is at.
          const newPasses = Math.max(0, i.passes - guestPasses.current);
          guestPasses.current = Math.max(guestPasses.current, i.passes);
          const blue = inputs.current.blue;
          inputs.current.blue = { handle: i.z, pointerZ: null, keyDir: i.dir, kick: i.kick, passes: blue.passes + newPasses };
        } else if (msg.t === "ping" || msg.t === "pong") onPing(msg);
        else if (msg.t === "bye") leaveOnline(strings[langRef.current].net.left);
      };
      play("online", "normal");
    },
    [leaveOnline, play, setOnlineRole, onPing],
  );

  /** Guest: take in the host's table. Positions are blended per frame by <Mirror>; the rest is state. */
  const receiveSnapshot = useCallback(
    (snap: Snapshot) => {
      buffer.current.push(snap, performance.now());
      const matchJson = JSON.stringify(snap.match);
      if (matchJson !== lastMatchJson.current) {
        lastMatchJson.current = matchJson;
        update(snap.match);
      }
      const capJson = JSON.stringify(snap.cap);
      if (capJson !== lastCapJson.current) {
        lastCapJson.current = capJson;
        setRemoteCap(snap.cap);
      }
      const powersKey = snap.powers.map((p) => `${p.power}${p.side}${Math.round(p.left)}`).join();
      if (powersKey !== lastPowersKey.current) {
        lastPowersKey.current = powersKey;
        const t = now();
        setActivePowers(snap.powers.map((p) => ({ power: p.power, side: p.side, until: t + p.left })));
      }
    },
    [update, setActivePowers],
  );

  const startGuest = useCallback(
    (s: GuestSession) => {
      session.current = s;
      setLobby(null);
      setOnlineRole("guest");
      clearTimers();
      ball.current?.park();
      bots.current = [];
      inputs.current = idleInputs();
      aiming.current = false;
      buffer.current = new SnapshotBuffer();
      lastMatchJson.current = "";
      remoteRods.current = { slides: RODS.map(() => 0), angles: RODS.map(() => 0), active: { red: null, blue: null } };
      setView((v) => v + 1);
      s.onClose = () => leaveOnline(strings[langRef.current].net.left);
      s.onMessage = (msg: ToGuest) => {
        switch (msg.t) {
          case "snap":
            receiveSnapshot(msg.s);
            break;
          case "fx":
            sfx(msg.cue, msg.strength);
            break;
          case "call": {
            const text = narrator.current.line(msg.call, langRef.current, (side) => TEAMS[side].name);
            setLine((l) => ({ text, id: (l?.id ?? 0) + 1 }));
            window.clearTimeout(lineTimer.current);
            lineTimer.current = window.setTimeout(() => setLine(null), LINE_MS);
            break;
          }
          case "goal":
            shake.current = 1;
            sfx("goal");
            setBurst((b) => ({ n: b.n + 1, scorer: msg.conceded === "red" ? "blue" : "red", conceded: msg.conceded }));
            break;
          case "start":
            setLine(null);
            break;
          case "bye":
            leaveOnline(strings[langRef.current].net.left);
            break;
          case "ping":
          case "pong":
            onPing(msg);
            break;
        }
      };
    },
    [clearTimers, leaveOnline, setOnlineRole, receiveSnapshot, onPing],
  );

  // Host: send the table to the guest SNAPSHOT_HZ times a second.
  useEffect(() => {
    if (role !== "host") return;
    const id = window.setInterval(() => {
      const s = session.current as HostSession | null;
      if (!s) return;
      const b = ball.current?.position() ?? null;
      const t = now();
      s.send({
        t: "snap",
        s: {
          t: performance.now(),
          ball: b ? [q(b.x), q(b.y), q(b.z)] : null,
          slides: slides.current.map(q),
          angles: angles.current.map(q),
          active: [activeRods.current.red, activeRods.current.blue],
          match: matchRef.current,
          powers: powersRef.current.filter((p) => p.until > t).map((p) => ({ power: p.power, side: p.side, left: q(p.until - t) })),
          cap: capOut.current ? { power: capOut.current.power, x: q(capOut.current.x), z: q(capOut.current.z) } : null,
        },
      });
    }, 1000 / SNAPSHOT_HZ);
    return () => window.clearInterval(id);
  }, [role]);

  // Both sides: measure the round trip every second, and notice when answers stop.
  useEffect(() => {
    if (role === "local") return;
    lastPong.current = performance.now();
    lastInputSeq.current = 0;
    guestPasses.current = 0;
    let checks = 0;
    const id = window.setInterval(() => {
      session.current?.send({ t: "ping", at: performance.now() } as never);
      // Which path the link took settles in the first seconds; look a few times.
      if (checks++ < 5) void session.current?.relayed().then(setRelayed);
      if (performance.now() - lastPong.current > PING_LOST_MS) setPing(null);
    }, PING_EVERY_MS);
    return () => {
      window.clearInterval(id);
      setPing(null);
      setRelayed(null);
    };
  }, [role]);

  // Guest: send what the hand is doing, whenever it changes and at least every quarter second.
  useEffect(() => {
    if (role !== "guest") return;
    let last = "";
    let lastAt = 0;
    let inputSeq = 0;
    const id = window.setInterval(() => {
      const s = session.current as GuestSession | null;
      if (!s) return;
      const b = inputs.current.blue;
      const input: HandInput = { seq: 0, z: b.handle === null ? null : q(b.handle), dir: b.keyDir, kick: b.kick, passes: b.passes };
      const json = JSON.stringify(input);
      if (json === last && performance.now() - lastAt < 250) return;
      last = json;
      lastAt = performance.now();
      s.send({ t: "input", input: { ...input, seq: ++inputSeq } });
    }, 1000 / SNAPSHOT_HZ);
    return () => window.clearInterval(id);
  }, [role]);

  // Once read, the invite code leaves the address bar so a reload doesn't rejoin.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("sala")) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // The demo starts once the physics world is ready.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!ball.current) return;
      window.clearInterval(id);
      toMenu();
    }, 100);
    return () => {
      window.clearInterval(id);
      clearTimers();
    };
  }, [toMenu, clearTimers]);

  // Development only: lets a test script drive the table.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __barra?: unknown }).__barra = {
      place: (x: number, z: number, vx: number, vz: number) => ball.current?.place({ x, z }, { x: vx, z: vz }),
      position: () => ball.current?.position(),
      aim: (z: number) => {
        aiming.current = false;
        inputs.current.red.handle = null;
        inputs.current.red.pointerZ = z;
      },
      pass: () => void inputs.current.red.passes++,
      inputs: () => JSON.parse(JSON.stringify(inputs.current)),
      play,
      match: () => matchRef.current,
    };
  }, [play]);

  useEffect(() => {
    // Keys held per side, so releasing W while S is still down keeps sliding toward S.
    const held: Record<Side, Set<-1 | 1>> = { red: new Set(), blue: new Set() };
    const slideDir = (team: Side): -1 | 0 | 1 => {
      const h = held[team];
      return h.has(-1) === h.has(1) ? 0 : h.has(-1) ? -1 : 1;
    };
    const human = (team: Side) => {
      const m = matchRef.current;
      if (roleRef.current === "guest") return !!m;
      return !!m && HUMANS[m.mode].includes(team);
    };
    // Online, each player's keys drive their own side; the guest sees the table
    // from the other side, so "up" slides the other way.
    const route = (key: (typeof KEYS)[string]) => {
      if (roleRef.current === "guest") return { ...key, team: "blue" as Side, dir: key.dir ? ((-key.dir) as -1 | 1) : undefined };
      if (roleRef.current === "host") return { ...key, team: "red" as Side };
      return key;
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && matchRef.current?.phase === "playing" && roleRef.current !== "guest") {
        e.preventDefault();
        serve();
        return;
      }
      const raw = KEYS[e.code];
      if (!raw || !human(raw.team)) return;
      const key = route(raw);
      e.preventDefault();
      const input = inputs.current[key.team];
      if (key.kick) input.kick = true;
      // One pass per press: a held key's repeats don't count.
      if (key.pass && !e.repeat) input.passes++;
      if (key.dir) {
        held[key.team].add(key.dir);
        input.keyDir = slideDir(key.team);
        input.pointerZ = null;
        if (key.team === (roleRef.current === "guest" ? "blue" : "red")) aiming.current = false;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const raw = KEYS[e.code];
      if (!raw || !human(raw.team)) return;
      const key = route(raw);
      const input = inputs.current[key.team];
      if (key.kick) input.kick = false;
      if (key.dir) {
        held[key.team].delete(key.dir);
        input.keyDir = slideDir(key.team);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      touches.current.delete(e.pointerId);
      const side: Side = roleRef.current === "guest" ? "blue" : "red";
      const mine = roleRef.current !== "local" || human("red");
      // A quick right-button or two-finger tap is a pass. Counted before the
      // kick lets go, so a shot the first finger started charging becomes the pass.
      const tap = passTap.current;
      if (tap) {
        passTap.current = null;
        if (mine && performance.now() - tap.at < PASS_TAP.ms) inputs.current[side].passes++;
      }
      if (e.button !== 0) return;
      if (mine) inputs.current[side].kick = false;
    };
    // Dragged too far, the tap was the camera turning.
    const onPointerMove = (e: PointerEvent) => {
      const tap = passTap.current;
      if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > PASS_TAP.px) passTap.current = null;
    };
    const onPointerCancel = (e: PointerEvent) => {
      touches.current.delete(e.pointerId);
      passTap.current = null;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [serve]);

  // The local mouse plays red, or blue for the online guest.
  const mouseSide: Side = mine;
  const mousePlays = !!match && (role !== "local" || HUMANS[match.mode].includes("red"));
  const toggleLang = () => setLang((l) => (l === "es" ? "en" : "es"));

  return (
    <div className="relative h-dvh w-full select-none">
      <Canvas
        shadows="percentage"
        camera={{ fov: 38, near: 0.05, far: 20 }}
        // Sharp enough on high-density screens without rendering four times the pixels.
        dpr={[1, 1.5]}
        // Left button kicks; a quick tap of the right one passes, and dragging it turns the camera.
        onPointerMove={() => {
          if (mousePlays) aiming.current = true;
        }}
        onPointerDown={(e) => {
          if (!mousePlays) return;
          const tap = { at: performance.now(), x: e.clientX, y: e.clientY };
          if (e.pointerType === "touch") {
            touches.current.add(e.pointerId);
            // A second finger: a pass if both come off quickly, the camera if they move.
            if (touches.current.size === 2) {
              passTap.current = tap;
              return;
            }
          }
          if (e.button === 2) {
            passTap.current = tap;
            return;
          }
          if (e.button !== 0) return;
          aiming.current = true;
          inputs.current[mouseSide].kick = true;
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Fill />
        <CameraRig resetKey={view} spin={!match && !lobby} shakeRef={shake} flip={role === "guest"} />
        <Backdrop />
        <Scoreboard score={match?.score ?? { red: 0, blue: 0 }} />
        <Confetti burst={burst.n} side={burst.scorer} goalOf={burst.conceded} />
        <PowerField
          running={match?.phase === "playing" && role !== "guest"}
          ballRef={ball}
          onTake={onTake}
          capOutRef={capOut}
          mirror={role === "guest" ? remoteCap : undefined}
        />
        <Lamp />
        <Aim
          aimingRef={aiming}
          onAim={(z) => {
            const input = inputs.current[mouseSide];
            input.handle = handleFromAim(z);
            input.pointerZ = null;
          }}
        />
        <Suspense fallback={null}>
          {/* The online guest simulates nothing: it draws what the host sends. */}
          <Physics gravity={[0, -9.81, 0]} timeStep={1 / PHYSICS_HZ} paused={role === "guest"}>
            <Table onGoal={onGoal} goals={burst.n} goalOf={burst.conceded} />
            <Ball ref={ball} onDead={restartBall} onHit={onHit} hot={hot} />
            <BotDriver botsRef={bots} inputsRef={inputs} ballRef={ball} slidesRef={slides} />
            <Rods
              inputsRef={inputs}
              ball={ball}
              slidesRef={slides}
              speedRef={rodSpeed}
              anglesRef={angles}
              activeRef={activeRods}
              remoteRef={remoteRods}
              localSide={role === "guest" ? "blue" : null}
            />
            {process.env.NODE_ENV !== "production" && <DevStats />}
            {role === "guest" && (
              <>
                <Mirror bufferRef={buffer} ballRef={ball} rodsRef={remoteRods} />
                <SyncMeshes />
              </>
            )}
          </Physics>
        </Suspense>
      </Canvas>

      {!match && !lobby && role === "local" && (
        <Menu lang={lang} onLang={toggleLang} onPlay={play} online={() => setLobby({ code: null, notice: null })} />
      )}
      {lobby && role === "local" && (
        <Online
          lang={lang}
          initialCode={lobby.code}
          notice={lobby.notice}
          onHost={startHosting}
          onJoin={startGuest}
          onBack={() => setLobby(null)}
        />
      )}
      {match && (
        <Hud
          lang={lang}
          match={match}
          onMenu={() => (role === "local" ? toMenu() : leaveOnline(null))}
          onCamera={() => setView((v) => v + 1)}
          onLang={toggleLang}
          powers={powers}
        />
      )}
      {match && <Radio lang={lang} line={line} />}
      {role !== "local" && <Ping ms={ping} lang={lang} relayed={relayed} />}
      {match?.phase === "over" && (
        <Victory
          lang={lang}
          match={match}
          onRematch={role === "guest" ? null : () => play(match.mode, match.level)}
          onMenu={() => (role === "local" ? toMenu() : leaveOnline(null))}
        />
      )}
    </div>
  );
}
