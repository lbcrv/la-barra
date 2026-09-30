import type { DataConnection, Peer } from "peerjs";
import { makeCode, peerId, type ToGuest, type ToHost } from "./protocol";

export type Role = "host" | "guest";

export type SessionError = "not-found" | "network" | "closed";

export interface Session<Out, In> {
  role: Role;
  code: string;
  send: (msg: Out) => void;
  close: () => void;
  /** Set by the caller. */
  onMessage: (msg: In) => void;
  onClose: (reason: SessionError) => void;
}

export type HostSession = Session<ToGuest, ToHost>;
export type GuestSession = Session<ToHost, ToGuest>;

/** Tries this many codes when one is already taken on the broker. */
const CODE_TRIES = 4;
/** How long a guest waits to reach a room before giving up (ms). */
const JOIN_TIMEOUT = 12000;

/** PeerJS touches `window` on import, so it only loads in the browser, when needed. */
async function newPeer(id?: string): Promise<Peer> {
  const { Peer } = await import("peerjs");
  return id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
}

function wire<Out, In>(peer: Peer, conn: DataConnection, role: Role, code: string): Session<Out, In> {
  let closed = false;
  const session: Session<Out, In> = {
    role,
    code,
    send: (msg) => {
      if (conn.open) conn.send(msg);
    },
    close: () => {
      closed = true;
      try {
        conn.close();
      } finally {
        peer.destroy();
      }
    },
    onMessage: () => {},
    onClose: () => {},
  };
  conn.on("data", (data) => session.onMessage(data as In));
  const end = (reason: SessionError) => {
    if (closed) return;
    closed = true;
    session.onClose(reason);
    peer.destroy();
  };
  conn.on("close", () => end("closed"));
  conn.on("error", () => end("network"));
  peer.on("disconnected", () => {
    // Losing the broker doesn't drop an open peer link; only try to get it back.
    if (!closed && !peer.destroyed) peer.reconnect();
  });
  return session;
}

/**
 * Opens a room and waits for a guest. `onCode` fires as soon as the room
 * exists, so the code can be shown while waiting; the promise resolves when
 * the guest arrives. Call `cancel` to stop waiting.
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
      const conn = await new Promise<DataConnection>((resolve) => {
        p.on("connection", (c) => {
          c.on("open", () => resolve(c));
        });
      });
      if (cancelled) throw new Error("cancelled");
      return wire<ToGuest, ToHost>(p, conn, "host", code);
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

/** Joins the room with this code. Rejects with "not-found" or "network". */
export async function joinRoom(code: string): Promise<GuestSession> {
  const peer = await newPeer();
  return new Promise<GuestSession>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      peer.destroy();
      reject(new Error("not-found"));
    }, JOIN_TIMEOUT);
    peer.on("error", (err) => {
      window.clearTimeout(timer);
      peer.destroy();
      reject(new Error((err as { type?: string }).type === "peer-unavailable" ? "not-found" : "network"));
    });
    peer.on("open", () => {
      const conn = peer.connect(peerId(code), { reliable: true, serialization: "json" });
      conn.on("open", () => {
        window.clearTimeout(timer);
        const session = wire<ToHost, ToGuest>(peer, conn, "guest", code);
        session.send({ t: "hello" });
        resolve(session);
      });
    });
  });
}
