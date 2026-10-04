import type { ReactNode, SVGProps } from "react";
import type { Side } from "@/game/teams";

/**
 * The interface's drawings, all in code: team crests, bottle caps, keys and
 * icons, in the same thick ink line as the table.
 */

const INK = "#1b1410";
const CREAM = "#f6ead0";

/**
 * The two invented crests. They differ in shape as well as colour, so the
 * sides can be told apart without seeing red from blue: Atlético La Esquina
 * wears a round badge with the street-corner sign, Real Pulpería a shield
 * with a crown over the shop's striped awning.
 */
export function Crest({ team, className = "size-10", title }: { team: Side; className?: string; title?: string }) {
  const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true };
  if (team === "red") {
    return (
      <svg viewBox="0 0 48 48" className={className} {...a11y}>
        <circle cx="24" cy="24" r="21" fill="#d7322a" stroke={INK} strokeWidth="3" />
        <circle cx="24" cy="24" r="15.5" fill="none" stroke={CREAM} strokeWidth="2.5" />
        {/* The corner's street sign: a post and two blades, one each way. */}
        <path d="M24 13v24" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <rect x="13" y="15" width="15" height="6" rx="1" fill={CREAM} stroke={INK} strokeWidth="2" transform="rotate(-8 20 18)" />
        <rect x="20" y="22.5" width="15" height="6" rx="1" fill="#f2b632" stroke={INK} strokeWidth="2" transform="rotate(6 27 25)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className={className} {...a11y}>
      <path d="M8 9h32v15c0 10-7 16-16 20C15 40 8 34 8 24z" fill="#2563c9" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      {/* The shop's awning, cream and blue. */}
      <path d="M11 21h26v5H11z" fill={CREAM} stroke={INK} strokeWidth="2" />
      <path d="M16 21v5M21 21v5M26 21v5M31 21v5" stroke="#2563c9" strokeWidth="2.6" />
      {/* The crown. */}
      <path d="M15 17l1.5-7 4 4 3.5-6 3.5 6 4-4 1.5 7z" fill="#f2b632" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M18 31h12" stroke={CREAM} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** The crimped edge of a bottle cap, 21 teeth, in a 100 x 100 box. */
const CAP_EDGE = (() => {
  const teeth = 21;
  const pts: string[] = [];
  for (let i = 0; i <= teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 48 : 43;
    pts.push(`${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
})();

/** A bottle cap seen from above, in a colour, with whatever is painted on it. */
export function Cap({ color, children, className = "size-16" }: { color: string; children?: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d={CAP_EDGE} fill={color} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="33" fill="none" stroke={INK} strokeOpacity="0.35" strokeWidth="3" />
      {children}
    </svg>
  );
}

/** A key on a keyboard, for the controls guide. */
export function Key({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <kbd
      className={`inline-flex h-8 items-center justify-center rounded-md border-[2.5px] border-ink bg-cream px-2 font-sign text-sm text-ink ${wide ? "min-w-16" : "min-w-8"}`}
      style={{ boxShadow: "0 3px 0 var(--ink)" }}
    >
      {children}
    </kbd>
  );
}

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const IconPause = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 5v14M16 5v14" strokeWidth="3.2" />
  </Icon>
);

export const IconGear = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5" />
    <circle cx="12" cy="12" r="6.6" />
  </Icon>
);

export const IconSound = ({ on, ...p }: IconProps & { on: boolean }) => (
  <Icon {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
  </Icon>
);

export const IconCamera = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 8.5h3l1.8-2.5h7.4l1.8 2.5h3v10h-17z" />
    <circle cx="12" cy="13.2" r="3.4" />
  </Icon>
);

export const IconBack = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.5 5.5L8 12l6.5 6.5" strokeWidth="3" />
  </Icon>
);

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" strokeWidth="3" />
  </Icon>
);

export const IconBook = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5.5c3-1 5.5-.5 8 1.2 2.5-1.7 5-2.2 8-1.2v13c-3-1-5.5-.5-8 1.2-2.5-1.7-5-2.2-8-1.2z" />
    <path d="M12 6.7v13" />
  </Icon>
);

export const IconGlobe = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.6 2.4 3.6 5.2 3.6 8.5s-1 6.1-3.6 8.5c-2.6-2.4-3.6-5.2-3.6-8.5s1-6.1 3.6-8.5z" />
  </Icon>
);
