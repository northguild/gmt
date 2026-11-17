/**
 * The lock: when the reader chooses a place, rings ripple out from its pin in time with the Sonar
 * lock they hear. One ring for every ping and every echo of the sound, started when it sounds and
 * as much fainter as it is quieter (`sound/sonar-lock.ts`): the two pings, then each echo heard.
 * The ring's look and its spread are the stylesheet's (`globe.module.css`, `.lock`). The rings
 * are page elements over the canvas, so both renderers show them alike, and they follow the pin
 * as the globe moves.
 *
 * The rings play when the sound does. A place whose pin is in sight plays at once; one on the far
 * side of the Earth plays as the globe brings it to the centre (`lockOn` in `globe.ts`).
 */

import { LOCK_HEARD_DB, lockPulses } from "./sound/sonar-lock";

/** A ping's ring at its brightest. */
const RING_PEAK = 0.9;

/**
 * When each ring starts and how bright it is at its brightest. An echo's ring dims in step with
 * its loudness in dB, from a ping's brightness to nothing at the quietest echo still heard.
 */
export const LOCK_RINGS: readonly { delayMs: number; peak: number }[] =
  lockPulses().map(({ atMs, db }) => ({
    delayMs: atMs,
    peak: Math.round(RING_PEAK * (1 + db / LOCK_HEARD_DB) * 100) / 100,
  }));

export interface LockRings {
  /** Ripple once from the pin, starting now. A lock still rippling starts again. */
  play(): void;
  /** Follow the pin: where it is in host pixels, or null while it is out of sight. */
  place(at: { x: number; y: number } | null): void;
  /** Stop the ripple, if one is playing. */
  stop(): void;
}

/** Drive the rings inside `el`, an empty element that sits over the globe's canvas. */
export function lockRings(el: HTMLElement): LockRings {
  const stop = (): void => {
    el.hidden = true;
    el.replaceChildren();
  };
  // The last ring is the faintest echo, the last to fade.
  const onEnd = (event: Event): void => {
    if (event.target === el.lastElementChild) stop();
  };
  el.addEventListener("animationend", onEnd);
  el.addEventListener("animationcancel", onEnd);
  return {
    play() {
      // New rings, so each lock runs its animations from the start.
      el.replaceChildren(
        ...LOCK_RINGS.map(({ delayMs, peak }) => {
          const ring = el.ownerDocument.createElement("span");
          ring.style.setProperty("--gmt-lock-delay", `${delayMs}ms`);
          ring.style.setProperty("--gmt-lock-peak", String(peak));
          return ring;
        }),
      );
      el.hidden = false;
    },
    place(at) {
      if (at === null) {
        el.style.visibility = "hidden";
        return;
      }
      el.style.removeProperty("visibility");
      el.style.translate = `${at.x}px ${at.y}px`;
    },
    stop,
  };
}
