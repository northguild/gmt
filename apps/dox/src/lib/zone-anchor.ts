/**
 * The planner's instant helpers: epoch-ms to and from the UTC string, the zoned anchor the readings
 * are taken at, and the step rounding. Pure and free of the DOM, any mount and any stylesheet; the
 * scrubber and the planner's WebMCP tool both import them, so the globe's `zone-clock.ts` does not
 * carry them.
 */

import { convertUnixToUtc } from "@northguild/gmt/unix/convert";
import { roundUnix } from "@northguild/gmt/unix/calculate";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import { SLIDER_STEP_MIN } from "./zone-step";

/** Epoch-ms -> `YYYY-MM-DDTHH:MM:SSZ`. All time maths goes through `@northguild/gmt`. */
export function toUtc(effectiveMs: number): string {
  return convertUnixToUtc(effectiveMs, { epochUnit: "milliseconds" }).replace(
    /\.\d{3}Z$/,
    "Z",
  );
}

/** Epoch-ms, or `null` if the instant string is invalid. */
export function fromUtc(utc: string): number | null {
  return convertUtcToUnix(utc, { epochUnit: "milliseconds" });
}

/** A zoned value in UTC, the `[UTC]`-bracketed form `convertZonedToZoned` needs. */
export function anchorZoned(effectiveMs: number): string {
  return toUtc(effectiveMs).replace("Z", "+00:00[UTC]");
}

/** `ms` to the nearest planner step. */
export function roundToStep(ms: number): number {
  const stepMs = SLIDER_STEP_MIN * 60_000;
  return Math.round(ms / stepMs) * stepMs;
}

/**
 * `ms` rounded forward to the next 5-minute boundary, which is itself when it is
 * already on one: the planner's default reference time is now, so a meeting
 * proposed from it starts on a boundary that has not passed. Rounded in UTC,
 * where a boundary is the same instant whatever zone the reader is in and no
 * transition can move it.
 */
export function roundUpToStep(ms: number): number | null {
  return roundUnix(ms, {
    smallestUnit: "minute",
    roundingIncrement: SLIDER_STEP_MIN,
    roundingMode: "ceil",
    timeZone: "UTC",
    epochUnit: "milliseconds",
  });
}
