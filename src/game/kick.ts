/**
 * The kick, as the rod turns. Angles are in radians in the attacking frame:
 * positive swings the foot toward the opponent's goal, negative draws it back.
 * Holding the button draws the foot back and charges the shot; releasing it
 * swings through, faster the longer it was held.
 */
export const KICK = {
  /** How far back the foot is drawn while the button is held. */
  windup: -0.7,
  /**
   * Where the swing stops, past vertical, before coming back. Much further and
   * the players lie flat for a moment after every shot, which looks broken.
   */
  follow: 1.2,
  windupSpeed: 12,
  /**
   * Coming back to hang is slow, like a released handle settling. A fast return
   * would slap a rebounding ball back toward the kicker's own goal.
   */
  recoverSpeed: 3.5,
  /** Swing speed of a tap and of a fully charged shot, in rad/s. */
  tapSpeed: 24,
  fullSpeed: 60,
  /** Seconds of holding for a full charge. */
  fullCharge: 0.45,
  /** A new press is accepted once the foot is back this far during recovery. */
  rearmAt: 0.45,
};

export type KickPhase = "rest" | "windup" | "strike" | "recover";

export interface KickState {
  phase: KickPhase;
  angle: number;
  /** Seconds the button has been held in the current windup. */
  held: number;
  /** Swing speed of the current strike. */
  speed: number;
}

export const restingKick = (): KickState => ({ phase: "rest", angle: 0, held: 0, speed: 0 });

/** Charge from 0 (a tap) to 1 (held for the full time). */
export const charge = (held: number) => Math.min(1, held / KICK.fullCharge);

/** Advances the kick by `dt` seconds given whether the button is down. Pure. */
export function stepKick(s: KickState, pressed: boolean, dt: number): KickState {
  switch (s.phase) {
    case "rest":
      return pressed ? { ...s, phase: "windup", held: 0 } : s;

    case "windup": {
      const angle = Math.max(KICK.windup, s.angle - KICK.windupSpeed * dt);
      const held = s.held + dt;
      if (pressed) return { ...s, angle, held };
      const speed = KICK.tapSpeed + (KICK.fullSpeed - KICK.tapSpeed) * charge(held);
      return { phase: "strike", angle, held, speed };
    }

    case "strike": {
      const angle = s.angle + s.speed * dt;
      return angle >= KICK.follow ? { ...s, phase: "recover", angle: KICK.follow } : { ...s, angle };
    }

    case "recover": {
      if (pressed && s.angle <= KICK.rearmAt) return { ...s, phase: "windup", held: 0 };
      const angle = Math.max(0, s.angle - KICK.recoverSpeed * dt);
      return angle === 0 ? restingKick() : { ...s, angle };
    }
  }
}
