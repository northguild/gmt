/**
 * The sun gliding from one slide's instant to the next. A slide's timeline (now, a lapse, a lapse
 * held at its end) can start far from where the last one stood: a day on, or 1844. Cutting there
 * jumps the terminator; running the clock there spins the Earth once a day of the gap. The glide
 * does neither, and every frame still shows a real instant, so the sun, the night side, the stars
 * and the Moon always agree.
 *
 * The gap between the instant on screen and the new timeline's start is cut in three:
 * - Whole tropical years go at once, as whole days (`foldYears`). The time of day is the same and
 *   the season within half a day, so the sun stands where it stood and the snap cannot be seen.
 * - The days left, under half a year, are stepped through whole days at a time: the sun's
 *   longitude holds and its latitude, the season, moves smoothly.
 * - The hours left, under twelve, ease out, so the terminator slides the short way round.
 *
 * The glide is an offset added to the new timeline (`glideOffset`), so a lapse starts at once and
 * the glide settles on it as it runs.
 */
import { DAY_MS } from "~/lib/globe/sun";
import { ease } from "./time-lapse";

/**
 * The mean tropical year at J2000, in days: the time the sun takes to come back to the same
 * season (Astronomical Almanac, "Glossary": tropical year).
 */
export const TROPICAL_YEAR_DAYS = 365.242_19;
/** How long the sun takes to settle on a slide's timeline. */
export const SUN_GLIDE_MS = 1500;

/** `offsetMs` less the whole days nearest its whole tropical years: under half a year is left. */
export function foldYears(offsetMs: number): number {
  const years = Math.round(offsetMs / (TROPICAL_YEAR_DAYS * DAY_MS));
  const days = Math.round(years * TROPICAL_YEAR_DAYS);
  return offsetMs - days * DAY_MS;
}

/**
 * The offset at progress `t` (0 to 1) of a glide that starts `startMs` off its timeline: whole
 * days stepped, the hours under twelve eased, nothing left at 1.
 */
export function glideOffset(startMs: number, t: number): number {
  const days = Math.round(startMs / DAY_MS);
  const hours = startMs - days * DAY_MS;
  const left = 1 - ease(t);
  return Math.round(days * left) * DAY_MS + hours * left || 0;
}

interface Frames {
  requestAnimationFrame(callback: (stamp: number) => void): number;
  cancelAnimationFrame(handle: number): void;
}

/**
 * Plays a glide from `startMs` off the timeline, calling `onFrame` with the offset on every
 * animation frame until it is 0. Returns a function that stops it. The browser's frame stamp
 * measures the elapsed time; nothing here reads a clock.
 */
export function runSunGlide(o: {
  startMs: number;
  win: Frames;
  onFrame: (offsetMs: number) => void;
}): () => void {
  let handle = 0;
  let start: number | null = null;
  let stopped = false;
  const step = (stamp: number): void => {
    if (stopped) return;
    start ??= stamp;
    const t = Math.min(1, (stamp - start) / SUN_GLIDE_MS);
    o.onFrame(glideOffset(o.startMs, t));
    if (t < 1) handle = o.win.requestAnimationFrame(step);
  };
  o.onFrame(o.startMs);
  handle = o.win.requestAnimationFrame(step);
  return () => {
    stopped = true;
    o.win.cancelAnimationFrame(handle);
  };
}
