import type { DataConnection, Peer } from "peerjs";
import { isStateMessage, makeCode, peerId, type ToGuest, type ToHost } from "./protocol";

export type Role = "host" | "guest";

/**
 * not-found: no room with that code. unreachable: the room exists but the two
 * browsers couldn't open a link. network: couldn't reach the broker at all.
 */
export type SessionError = "not-found" | "unreachable" | "network" | "closed";

export interface Session<Out, In> {
  role: Role;
  code: string;
  send: (msg: Out) => void;
  close: () => void;
  /** Whether the link runs through the TURN relay rather than directly; null until known. */
  relayed: () => Promise<boolean | null>;
  /** Set by the caller. */
  onMessage: (msg: In) => void;
  onClose: (reason: SessionError) => void;
}

export type HostSession = Session<ToGuest, ToHost>;
export type GuestSession = Session<ToHost, ToGuest>;

/** Tries this many codes when one is already taken on the broker. */
const CODE_TRIES = 4;
/** How long a guest waits to reach a room before giving up (ms). Relayed links can take a few seconds. */
const JOIN_TIMEOUT = 20000;

/**
 * Two channels per match. "events" is reliable and in order: goals, kick-off,
 * Don Chepe, leaving. "state" is unordered: snapshots, the guest's hand and
 * pings, where only the newest matters and waiting for a lost packet to be
 * resent would hold up every packet behind it.
 */
const EVENTS = "events";
const STATE = "state";

const FALLBACK_ICE: RTCConfiguration = { iceServers: [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }] };

/**
 * STUN and TURN servers from our /api/ice route. PeerJS's own default relays
 * no longer exist, so without a relay of our own two players on different
 * networks often couldn't connect at all.
 */
async function iceConfig(): Promise<RTCConfiguration> {
  try {
    const res = await fetch("/api/ice", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) return FALLBACK_ICE;
    const config = (await res.json()) as RTCConfiguration;
    return FORCE_RELAY ? { ...config, iceTransportPolicy: "relay" } : config;
  } catch {
    return FALLBACK_ICE;
  }
}

/**
 * `?relay` in the address forces every link through the TURN relay, the path
 * players on restrictive networks take. Read once at load, before the lobby
 * cleans the address bar. For testing that path from one machine.
 */
const FORCE_RELAY = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("relay");

/** PeerJS touches `window` on import, so it only loads in the browser, when needed. */
async function newPeer(id?: string): Promise<Peer> {
  const [{ Peer }, config] = await Promise.all([import("peerjs"), iceConfig()]);
  return id ? new Peer(id, { debug: 0, config }) : new Peer({ debug: 0, config });
}

/** Whether the connection's chosen candidate pair goes through a TURN relay. */
async function usesRelay(conn: DataConnection): Promise<boolean | null> {
  const pc = conn.peerConnection;
  if (!pc) return null;
  const stats = await pc.getStats();
  let pairId: string | undefined;
  stats.forEach((s) => {
    if (s.type === "transport" && s.selectedCandidatePairId) pairId = s.selectedCandidatePairId;
  });
  let pair: RTCIceCandidatePairStats | undefined;
  stats.forEach((s) => {
    if (s.type === "candidate-pair" && (s.id === pairId || (!pairId && s.nominated && s.state === "succeeded"))) pair = s;
  });
  if (!pair) return null;
  const local = stats.get(pair.localCandidateId);
  const remote = stats.get(pair.remoteCandidateId);
  return local?.candidateType === "relay" || remote?.candidateType === "relay";
}

function wire<Out extends { t: string }, In>(peer: Peer, events: DataConnection, state: DataConnection, role: Role, code: string): Session<Out, In> {
  let closed = false;
  const session: Session<Out, In> = {
    role,
    code,
    send: (msg) => {
      const conn = isStateMessage(msg.t) ? state : events;
      if (conn.open) conn.send(msg);
    },
    close: () => {
      closed = true;
      try {
        events.close();
        state.close();
      } finally {
        peer.destroy();
      }
    },
    relayed: () => usesRelay(events).catch(() => null),
    onMessage: () => {},
    onClose: () => {},
  };
  for (const conn of [events, state]) {
    conn.on("data", (data) => session.onMessage(data as In));
    conn.on("close", () => end("closed"));
    conn.on("error", () => end("network"));
  }
  function end(reason: SessionError) {
    if (closed) return;
    closed = true;
    session.onClose(reason);
    peer.destroy();
  }
  peer.on("disconnected", () => {
    // Losing the broker doesn't drop an open peer link; only try to get it back.
    if (!closed && !peer.destroyed) peer.reconnect();
  });
  return session;
}

/**
 * Opens a room and waits for a guest. `onCode` fires as soon as the room
 * exists, so the code can be shown while waiting; the promise resolves when
 * the guest's two channels are both open. Call `cancel` to stop waiting.
 */
export function hostRoom(onCode: (code: string) => void): { ready: Promise<HostSession>; cancel: () => void } {
  let peer: Peer | null = null;
  let cancelled = false;

  const ready = (async () => {
    for (let attempt = 0; attempt < CODE_TRIES; attempt++) {
      const code = makeCode();
      peer = await newPeer(peerId(code));
      const outcome = await new Promise<"open" | "taken" | "error">((resolve) => {
        peer!.on("open", () => resolve("open"));
        peer!.on("error", (err) => resolve((err as { type?: string }).type === "unavailable-id" ? "taken" : "error"));
      });
      if (cancelled) throw new Error("cancelled");
      if (outcome === "taken") {
        peer.destroy();
        continue;
      }
      if (outcome === "error") throw new Error("network");
      onCode(code);
      const p = peer;
      const { events, state } = await new Promise<{ events: DataConnection; state: DataConnection }>((resolve) => {
        const open: Record<string, DataConnection> = {};
        p.on("connection", (c) => {
          c.on("open", () => {
            open[c.label] = c;
            if (open[EVENTS] && open[STATE]) resolve({ events: open[EVENTS], state: open[STATE] });
          });
        });
      });
      if (cancelled) throw new Error("cancelled");
      return wire<ToGuest, ToHost>(p, events, state, "host", code);
    }
    throw new Error("network");
  })();

  return {
    ready,
    cancel: () => {
      cancelled = true;
      peer?.destroy();
    },
  };
}

/** Joins the room with this code. Rejects with "not-found", "unreachable" or "network". */
export async function joinRoom(code: string): Promise<GuestSession> {
  const peer = await newPeer();
  return new Promise<GuestSession>((resolve, reject) => {
    // The broker answers at once when a room doesn't exist, so running out of
    // time means the room is there but no link could be opened to it.
    let brokerReached = false;
    const timer = window.setTimeout(() => {
      peer.destroy();
      reject(new Error(brokerReached ? "unreachable" : "network"));
    }, JOIN_TIMEOUT);
    peer.on("error", (err) => {
      window.clearTimeout(timer);
      peer.destroy();
      reject(new Error((err as { type?: string }).type === "peer-unavailable" ? "not-found" : "network"));
    });
    peer.on("open", () => {
      brokerReached = true;
      const events = peer.connect(peerId(code), { label: EVENTS, reliable: true, serialization: "json" });
      const state = peer.connect(peerId(code), { label: STATE, reliable: false, serialization: "json" });
      let opened = 0;
      const onOpen = () => {
        if (++opened < 2) return;
        window.clearTimeout(timer);
        const session = wire<ToHost, ToGuest>(peer, events, state, "guest", code);
        session.send({ t: "hello" });
        resolve(session);
      };
      events.on("open", onOpen);
      state.on("open", onOpen);
    });
  });
}
