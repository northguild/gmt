/**
 * DOX-C3a (#139) — the crystal's spin, and its landing.
 *
 * CSS alone cannot do the thing that matters here. An infinite
 * `animation: spin` stopped by removing the class snaps to 0deg from whatever
 * angle it happened to be at; `animation-play-state: paused` freezes it
 * mid-turn instead. Neither lands. The Web Animations API can: read the angle
 * the spin has actually reached, then run a second, decelerating animation from
 * exactly there to the next whole turn.
 *
 * So the sequence is: enter with one clockwise turn that eases out; keep
 * turning clockwise at a constant rate while Dox works; when the answer starts,
 * carry the current angle into an ease-out that finishes the turn and stops
 * square. The mark never jumps.
 *
 * Positive `rotateZ` is clockwise in CSS (the Y axis points down), and the
 * constant `rotateX` tilt is what keeps the facets reading as a solid rather
 * than a flat outline while it turns.
 */
import { useEffect, useRef } from "react";

const TILT = "rotateX(10deg)";
/** One full turn while working. */
const SPIN_MS = 2600;
/** The entrance turn. Slower than a spin cycle so it reads as an arrival. */
const ENTER_MS = 1100;
/** The decelerating finish. */
const LAND_MS = 900;
/** Ease-out that decays hard at the end — the "settling" feel. */
const LAND_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

function frame(deg: number): Keyframe {
  return { transform: `${TILT} rotateZ(${deg}deg)` };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * @param spinning - true while Dox is working. Going false lands the crystal.
 * @param enter - play the one-turn entrance on mount. The transcript's per-turn
 *   markers do (a new question spins its own crystal in); the header mark does
 *   not, because a logo that spins on every page load is a nuisance.
 */
export function useCrystalSpin(spinning: boolean, enter = true) {
  const ref = useRef<HTMLDivElement | null>(null);
  /** The angle the spin had reached when it was torn down, in degrees.
   * Captured in the cleanup rather than read from the Animation afterwards:
   * React runs the previous effect's cleanup *before* the next effect body, and
   * a cancelled Animation reports `currentTime === null` — so reading it later
   * always yielded nothing and the crystal snapped to rest instead of landing.
   * `null` means "there was no spin to land from". */
  const landFromRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;

    // The whole point of this hook is motion; with reduced motion the crystal
    // simply sits at rest, and the waiting state is carried by the halo and
    // scanline (both given still fallbacks in gmt-hive.css).
    if (prefersReducedMotion()) return;

    const isFirstRun = !mountedRef.current;
    mountedRef.current = true;

    if (spinning) {
      const animation = el.animate([frame(0), frame(360)], {
        duration: SPIN_MS,
        iterations: Number.POSITIVE_INFINITY,
        easing: "linear",
      });
      return () => {
        // Capture before cancelling — this is the only moment the reached angle
        // is still readable.
        const elapsed = Number(animation.currentTime ?? 0) % SPIN_MS;
        landFromRef.current = (elapsed / SPIN_MS) * 360;
        animation.cancel();
      };
    }

    const landFrom = landFromRef.current;
    if (landFrom !== null) {
      landFromRef.current = null;
      // Continue from where the spin actually got to and ease out to square,
      // rather than jumping back to 0deg.
      el.animate([frame(landFrom), frame(360)], {
        duration: LAND_MS,
        easing: LAND_EASING,
      });
      return;
    }

    if (isFirstRun && enter) {
      el.animate(
        [
          { ...frame(-360), opacity: 0, scale: "0.6" },
          { ...frame(0), opacity: 1, scale: "1" },
        ],
        { duration: ENTER_MS, easing: LAND_EASING },
      );
    }
  }, [spinning, enter]);

  return ref;
}
