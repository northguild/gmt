/**
 * Quota day boundaries — when each daily allowance refills.
 *
 * Gemini's daily quota resets at **midnight Pacific**, not UTC — Google's rate
 * limit docs are explicit about it — and Dox's own per-visitor cap follows the
 * same clock. Workers AI's Neuron allocation resets at **00:00 UTC** (DOX-C4).
 * So every helper here takes the zone whose midnight it means; the Pacific
 * ones are thin wrappers for the visitor cap and the Gemini brains. Which zone
 * a brain uses is `BRAIN_PROVIDERS` in chat-constants.ts.
 *
 * Computed with `@northguild/gmt` rather than hand-rolled `Intl` calls. It is
 * already a workspace dependency of this app, it is the library this whole site
 * documents, and the arithmetic here is exactly the class of thing it exists to
 * get right: a wall-clock day boundary in a zone that observes DST, where two
 * days a year are 23 and 25 hours long. Doing it with `Date` maths would be the
 * bug this library was written to prevent.
 */
import {
  addZoned,
  convertUnixToZoned,
  convertZonedToUnix,
  startOfZoned,
} from "@northguild/gmt";

/** Google resets RPD quotas at midnight in this zone, and the visitor cap
 * resets with it. */
export const QUOTA_TIME_ZONE = "America/Los_Angeles";

/**
 * The calendar date for an instant in `timeZone`, as `YYYY-MM-DD`.
 *
 * This is the ledger's bucket key. Two requests a minute apart can land in
 * different buckets, and that is correct — it is the same boundary the
 * provider uses to decide whether the quota has refilled.
 */
export function dayKey(nowMs: number, timeZone: string): string {
  const zoned = convertUnixToZoned(nowMs, timeZone);
  // gmt returns "" for invalid input rather than throwing (its sentinel
  // contract). A bad clock must not take the chat down, so fall back to a
  // stable bucket instead of propagating an empty key.
  if (zoned === "") return "unknown";
  return zoned.slice(0, 10);
}

/** The Pacific calendar date for an instant — see `dayKey`. */
export function ptDayKey(nowMs: number): string {
  return dayKey(nowMs, QUOTA_TIME_ZONE);
}

/**
 * The instant the current day in `timeZone` ends — i.e. when a quota on that
 * clock refills.
 *
 * Returned as epoch milliseconds so callers can render it however they like
 * (the API sends ISO; the UI formats it in the reader's own zone).
 */
export function nextMidnightMs(nowMs: number, timeZone: string): number {
  const zoned = convertUnixToZoned(nowMs, timeZone);
  if (zoned === "") return nowMs;

  // start-of-day then +1 day, NOT +24 hours: on a DST boundary those differ,
  // and only the former lands on midnight.
  const startOfToday = startOfZoned(zoned, "day");
  const startOfTomorrow = addZoned(startOfToday, { days: 1 });
  const unix = convertZonedToUnix(startOfTomorrow);

  return typeof unix === "number" ? unix : nowMs;
}

/** The next Pacific midnight — see `nextMidnightMs`. */
export function nextPtMidnightMs(nowMs: number): number {
  return nextMidnightMs(nowMs, QUOTA_TIME_ZONE);
}

/** Seconds until a quota on `timeZone`'s clock refills — the TTL a ledger key
 * gets, plus a margin so a key never expires slightly before the boundary it
 * represents. */
export function secondsUntilMidnight(nowMs: number, timeZone: string): number {
  const remaining = Math.ceil((nextMidnightMs(nowMs, timeZone) - nowMs) / 1000);
  return Math.max(60, remaining + 300);
}

/** Seconds until the Pacific quota refills — see `secondsUntilMidnight`. */
export function secondsUntilPtReset(nowMs: number): number {
  return secondsUntilMidnight(nowMs, QUOTA_TIME_ZONE);
}
