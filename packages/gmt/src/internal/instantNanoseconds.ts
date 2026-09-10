import { Temporal } from "@js-temporal/polyfill";
import { instantLeapSecond } from "../regex/leap-second";
import { hasCalendarAnnotation } from "./hasCalendarAnnotation";

/**
 * Parse an ISO 8601 instant string to epoch nanoseconds, or `null` when it is not one.
 *
 * The single definition of "an instant string GMT accepts": the full RFC 9557 instant
 * grammar `Temporal.Instant.from` parses, minus leap seconds (which Temporal clamps rather
 * than rejects) and minus `[u-ca=...]` calendar annotations (which `utc/` and `unix/` also
 * reject). Callers layer their own sentinel on top — `toNanoseconds` returns `0n`, `spanNs`
 * returns `null` — so the parse result stays unambiguous here.
 *
 * @param value candidate ISO 8601 instant string
 * @returns nanoseconds since the Unix epoch, or null when `value` is not a valid instant
 *
 * @example parseInstantNanoseconds("1970-01-01T00:00:00Z") // 0n
 * @example parseInstantNanoseconds("2016-12-31T23:59:60Z") // null — leap second
 * @example parseInstantNanoseconds("2024-03-10T12:00:00") // null — no offset designator
 */
export function parseInstantNanoseconds(value: string): bigint | null {
  if (typeof value !== "string") {
    return null;
  }

  if (instantLeapSecond.test(value) || hasCalendarAnnotation(value)) {
    return null;
  }

  try {
    return Temporal.Instant.from(value).epochNanoseconds;
  } catch {
    return null;
  }
}
