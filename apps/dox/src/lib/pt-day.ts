/**
 * Gemini's daily quota resets at **midnight Pacific**, not UTC — Google's rate
 * limit docs are explicit about it. Every key in the usage ledger is therefore
 * bucketed by Pacific day, and every "when does this come back?" the UI shows
 * has to be the next Pacific midnight.
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

/** Google resets RPD quotas at midnight in this zone. */
export const QUOTA_TIME_ZONE = "America/Los_Angeles";

/**
 * The Pacific calendar date for an instant, as `YYYY-MM-DD`.
 *
 * This is the ledger's bucket key. Two requests a minute apart can land in
 * different buckets, and that is correct — it is the same boundary Google is
 * using to decide whether the quota has refilled.
 */
export function ptDayKey(nowMs: number): string {
  const zoned = convertUnixToZoned(nowMs, QUOTA_TIME_ZONE);
  // gmt returns "" for invalid input rather than throwing (its sentinel
  // contract). A bad clock must not take the chat down, so fall back to a
  // stable bucket instead of propagating an empty key.
  if (zoned === "") return "unknown";
  return zoned.slice(0, 10);
}

/**
 * The instant the current Pacific day ends — i.e. when the quota refills.
 *
 * Returned as epoch milliseconds so callers can render it however they like
 * (the API sends ISO; the UI shows a relative "in 4 hours").
 */
export function nextPtMidnightMs(nowMs: number): number {
  const zoned = convertUnixToZoned(nowMs, QUOTA_TIME_ZONE);
  if (zoned === "") return nowMs;

  // start-of-day then +1 day, NOT +24 hours: on a DST boundary those differ,
  // and only the former lands on midnight.
  const startOfToday = startOfZoned(zoned, "day");
  const startOfTomorrow = addZoned(startOfToday, { days: 1 });
  const unix = convertZonedToUnix(startOfTomorrow);

  return typeof unix === "number" ? unix : nowMs;
}

/** Seconds until the quota refills — the TTL every ledger key gets, plus a
 * margin so a key never expires slightly before the boundary it represents. */
export function secondsUntilPtReset(nowMs: number): number {
  const remaining = Math.ceil((nextPtMidnightMs(nowMs) - nowMs) / 1000);
  return Math.max(60, remaining + 300);
}
