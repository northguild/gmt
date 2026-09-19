import { Temporal } from "@js-temporal/polyfill";
import { instantLeapSecond } from "../regex/leap-second";
import { hasInstantShape } from "./isoStringBody";

/**
 * Parse an ISO 8601 instant string to epoch nanoseconds, or `null` when it is not one.
 *
 * The single definition of "an instant string GMT accepts": the RFC 9557 instant grammar
 * `Temporal.Instant.from` parses, restricted to ISO 8601 extended format before the first `[`
 * (`instantBody`: `<date>T<time>`, then `Z` or `±HH:MM[:SS[.fraction]]`), minus
 * leap seconds (which Temporal clamps rather than rejects). Basic format, a space or lower-case
 * `t` separator, a lower-case `z` and an hour-only time or offset are rejected. Annotations are read as Temporal reads them (proposal-temporal
 * `ParseISODateTime`, RFC 9557 §3.3): a time zone, calendar (`[u-ca=hebrew]`) or elective
 * (`[foo=bar]`) annotation is ignored, because an instant has neither zone nor calendar, and an
 * unknown critical one (`[!foo=bar]`) is rejected. Callers layer their own sentinel on top —
 * `toNanoseconds` returns `0n`, `spanNs` returns `null` — so the parse result stays unambiguous
 * here.
 *
 * @param value candidate ISO 8601 instant string
 * @returns nanoseconds since the Unix epoch, or null when `value` is not a valid instant
 *
 * @example parseInstantNanoseconds("1970-01-01T00:00:00Z") // 0n
 * @example parseInstantNanoseconds("2016-12-31T23:59:60Z") // null — leap second
 * @example parseInstantNanoseconds("2024-03-10T12:00:00") // null — no offset designator
 * @example parseInstantNanoseconds("20240310T120000Z") // null — basic format
 * @example parseInstantNanoseconds("2024-03-10T12:00:00z") // null — lower-case z
 * @example parseInstantNanoseconds("1970-01-01T00:00:00Z[u-ca=hebrew]") // 0n — calendar annotation ignored
 */
export function parseInstantNanoseconds(value: string): bigint | null {
  if (typeof value !== "string") {
    return null;
  }

  if (instantLeapSecond.test(value) || !hasInstantShape(value)) {
    return null;
  }

  try {
    return Temporal.Instant.from(value).epochNanoseconds;
  } catch {
    return null;
  }
}
