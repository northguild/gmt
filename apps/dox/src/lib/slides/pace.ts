/**
 * The presenter's arithmetic: elapsed time, the time the plan allows, and how far apart they are.
 * Pure: no DOM, no clock and no `Intl`. The clock itself is gmt's (`presenter.ts` reads it).
 *
 * The plan is the sum of the `data-minutes` of the slides before the current one: the time the
 * talk should have used when the slide began. Pace is that plan minus what was actually used, so a
 * positive number is time in hand.
 */

export interface PlanSlide {
  /** The slide's planned minutes, or `null` when it names none. */
  minutes: number | null;
}

/** Within this many milliseconds of the plan the talk is on pace. */
export const ON_PACE_MS = 15_000;
/** Further behind than this many milliseconds the pace is a warning. */
export const WARN_BEHIND_MS = 60_000;

export type PaceSide = "ahead" | "behind" | "on";

export interface Pace {
  /** Planned minus elapsed, in milliseconds: positive is ahead of the plan. */
  deltaMs: number;
  side: PaceSide;
}

/** Milliseconds from `startMs` to `nowMs`; never negative, so a clock set back reads as zero. */
export function elapsedMs(startMs: number, nowMs: number): number {
  return Math.max(0, nowMs - startMs);
}

/** The plan at the start of slide `index`: the minutes of every slide before it, in milliseconds. */
export function plannedMsAt(
  slides: readonly PlanSlide[],
  index: number,
): number {
  let minutes = 0;
  for (const slide of slides.slice(0, Math.max(0, index)))
    minutes += slide.minutes ?? 0;
  return Math.round(minutes * 60_000);
}

/** How far the talk is from its plan. */
export function pace(plannedMs: number, elapsed: number): Pace {
  const deltaMs = plannedMs - elapsed;
  const side: PaceSide =
    Math.abs(deltaMs) <= ON_PACE_MS ? "on" : deltaMs > 0 ? "ahead" : "behind";
  return { deltaMs, side };
}

/** How the pace reads: spring while ahead or on pace, plain a little behind, a warning past a minute. */
export type PaceTone = "spring" | "plain" | "signal";

export function paceTone(p: Pace): PaceTone {
  if (p.side !== "behind") return "spring";
  return -p.deltaMs > WARN_BEHIND_MS ? "signal" : "plain";
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** `mm:ss` from milliseconds, whole seconds toward zero, with a leading minus (U+2212) when negative. */
export function formatClock(ms: number): string {
  const whole = Math.trunc(Math.abs(ms) / 1000);
  const text = `${pad(Math.trunc(whole / 60))}:${pad(whole % 60)}`;
  return ms < 0 && whole > 0 ? `−${text}` : text;
}

/** The pace as words: `+1:20 ahead`, `−0:45 behind` or `On pace`. The words carry the meaning. */
export function formatPace(p: Pace): string {
  if (p.side === "on") return "On pace";
  const text = formatClock(Math.abs(p.deltaMs)).replace(/^0/, "");
  return p.side === "ahead" ? `+${text} ahead` : `−${text} behind`;
}

/** The milliseconds of the next whole second after `nowMs`, for chaining a tick to the clock. */
export function msToNextSecond(nowMs: number): number {
  const into = ((nowMs % 1000) + 1000) % 1000;
  return 1000 - into;
}
