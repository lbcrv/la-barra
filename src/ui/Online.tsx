"use client";

import { useEffect, useRef, useState } from "react";
import { CODE_LENGTH, readCode } from "@/net/protocol";
import { hostRoom, joinRoom, type GuestSession, type HostSession } from "@/net/session";
import { Board } from "./Menu";
import { strings, type Lang } from "./strings";

type Stage = { at: "choose" } | { at: "hosting"; code: string | null } | { at: "joining"; busy: boolean } | { at: "error"; message: string };

/** The online lobby: open a room and share its code, or type a code to join one. */
export function Online({
  lang,
  initialCode,
  onHost,
  onJoin,
  onBack,
  notice,
}: {
  lang: Lang;
  /** A code from an invite link, joined right away. */
  initialCode: string | null;
  onHost: (s: HostSession) => void;
  onJoin: (s: GuestSession) => void;
  onBack: () => void;
  /** Shown on arrival, e.g. after the other player left. */
  notice: string | null;
}) {
  const t = strings[lang].net;
  const [stage, setStage] = useState<Stage>(notice ? { at: "error", message: notice } : { at: "choose" });
  const [code, setCode] = useState(initialCode ?? "");
  const [copied, setCopied] = useState(false);
  const cancel = useRef<(() => void) | null>(null);
  const joinedFromLink = useRef(false);

  useEffect(() => () => cancel.current?.(), []);

  const host = () => {
    setStage({ at: "hosting", code: null });
    const room = hostRoom((c) => setStage({ at: "hosting", code: c }));
    cancel.current = room.cancel;
    room.ready.then(
      (session) => {
        // The room is in use now; leaving this screen must not tear it down.
        cancel.current = null;
        onHost(session);
      },
      (e: Error) => {
        if (e.message !== "cancelled") setStage({ at: "error", message: t.network });
      },
    );
  };

  const join = async (raw: string) => {
    const c = readCode(raw);
    if (!c) return;
    setStage({ at: "joining", busy: true });
    try {
      onJoin(await joinRoom(c));
    } catch (e) {
      const reason = (e as Error).message;
      setStage({ at: "error", message: reason === "not-found" ? t.notFound : reason === "unreachable" ? t.unreachable : t.network });
    }
  };

  // An invite link joins straight away.
  useEffect(() => {
    if (!initialCode || joinedFromLink.current) return;
    joinedFromLink.current = true;
    void join(initialCode);
    // Only on arrival.
  }, [initialCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => {
    cancel.current?.();
    cancel.current = null;
    if (stage.at === "choose") onBack();
    else setStage({ at: "choose" });
  };

  const inviteLink = (c: string) => `${window.location.origin}${window.location.pathname}?sala=${c}`;

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-4">
      <Board className="anim-rise my-auto w-full max-w-md text-center">
        <h2 className="font-chalk text-5xl text-gold">{t.title}</h2>

        {stage.at === "choose" && (
          <div className="mt-7 grid grid-cols-2 gap-3">
            <button onClick={host} className="toon-button bg-red text-cream">
              {t.host}
              <span className="mt-0.5 block font-sans text-sm font-semibold opacity-85">{t.hostNote}</span>
            </button>
            <button onClick={() => setStage({ at: "joining", busy: false })} className="toon-button bg-blue text-cream">
              {t.join}
              <span className="mt-0.5 block font-sans text-sm font-semibold opacity-85">{t.joinNote}</span>
            </button>
          </div>
        )}

        {stage.at === "hosting" && (
          <div className="mt-6">
            <p className="text-sm font-semibold tracking-widest uppercase">{t.yourCode}</p>
            <p className="font-sign mt-2 text-6xl tracking-[0.2em]">{stage.code ?? "····"}</p>
            <p className="mt-4 text-lg font-semibold">{t.waiting}</p>
            {stage.code && (
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(inviteLink(stage.code!)).then(() => setCopied(true));
                }}
                className="toon-button mt-5 bg-gold text-ink"
              >
                {copied ? t.copied : t.shareLink}
              </button>
            )}
          </div>
        )}

        {stage.at === "joining" && (
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              void join(code);
            }}
          >
            <label className="text-sm font-semibold tracking-widest uppercase" htmlFor="room-code">
              {t.codeLabel}
            </label>
            <input
              id="room-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, CODE_LENGTH + 2))}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              disabled={stage.busy}
              className="font-sign mt-2 block w-full rounded-xl border-[3px] border-ink bg-cream px-3 py-2 text-center text-5xl tracking-[0.3em] text-ink uppercase"
              placeholder="ABCD"
            />
            <button type="submit" disabled={stage.busy || !readCode(code)} className="toon-button mt-4 bg-blue text-cream disabled:opacity-40">
              {stage.busy ? t.connecting : t.enter}
            </button>
          </form>
        )}

        {stage.at === "error" && (
          <p className="mt-6 rounded-lg border-[3px] border-ink bg-red px-3 py-2 text-lg font-semibold text-cream" role="alert">
            {stage.message}
          </p>
        )}

        <button onClick={back} className="font-chalk mt-6 min-h-11 cursor-pointer px-3 text-2xl underline-offset-4 hover:underline">
          {t.back}
        </button>
      </Board>
    </div>
  );
}
