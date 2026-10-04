"use client";

import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Open windows, newest last: only the top one answers the keyboard. */
const open: symbol[] = [];

/**
 * A window over the game. Keyboard focus moves into it and stays there, Tab
 * goes round its controls, Escape or a click outside closes it, and focus goes
 * back to wherever it was when it opened. An element marked `data-autofocus`
 * gets the focus first.
 */
export function Dialog({ label, onClose, children, className = "" }: { label: string; onClose: () => void; children: ReactNode; className?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const me = Symbol();
    open.push(me);
    const before = document.activeElement as HTMLElement | null;
    (el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    // Listened for on the whole page, ahead of the game's own keys, so Escape
    // and Tab work even when a click left the focus outside the window.
    const onKey = (e: KeyboardEvent) => {
      if (open[open.length - 1] !== me) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = el.contains(document.activeElement);
      if (!inside || (e.shiftKey && document.activeElement === first)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      open.splice(open.indexOf(me), 1);
      before?.focus?.();
    };
  }, []);

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-ink/60 p-3 sm:p-6"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} className={`anim-rise my-auto w-full ${className}`}>
        {children}
      </div>
    </div>
  );
}
