import { calendarDate } from "../regex";
import type { DurationRelativeTo } from "../types";
import { parseCalendarDateValue } from "./calendarDateString";

/** A calendar annotation in any spelling: critical flag or not, any letter case. */
const anyCalendarAnnotation = /\[!?u-ca=/i;

/**
 * Second `60` in the time of day, before any `[`: `T`, `t` or space separator, extended or basic
 * digits. Unlike `regex/leap-second.ts`, no designator is required, because a `relativeTo` may be
 * a `PlainDateTime` string, which Temporal clamps just the same.
 */
const relativeToLeapSecond =
  /^[^[]*?[Tt ]\d{2}:?\d{2}:?60(?:[.,]\d+)?(?:[-+Zz[]|$)/;

/**
 * Resolve a `DurationRelativeTo` value for `Temporal.Duration`'s `relativeTo` option, converting
 * a GMT calendar-annotated PlainDate string (`"5784-06-15[u-ca=hebrew]"`, as produced by
 * `convertDateToCalendar`) into the `Temporal.PlainDate` it actually names before handing it to
 * Temporal.
 *
 * Without this, Temporal's own `relativeTo` string parsing reads GMT's native-digit shape as if
 * it were Temporal's ISO-digit `[u-ca=...]` convention instead (see
 * `context/coding-standards.md`'s E1 scoped-exception note on the two conventions), silently
 * resolving to the wrong date with no error — e.g. `relativeTo: "5784-06-15[u-ca=hebrew]"`
 * previously returned the day count for Gregorian year 5784, not the Hebrew date it names. Found
 * and fixed as part of E5 (issue #78).
 *
 * One tag means one date, so a string carrying a calendar annotation in any other spelling
 * throws rather than falling through to Temporal's ISO-digit reading: a critical flag
 * (`[!u-ca=hebrew]`), an upper-case key or id, a trailing annotation after it, a
 * `PlainDateTime` or zoned string in either segment order. RFC 9557 §3.3's critical flag does
 * not change what a tag means. RFC 9557 §3.1 makes suffix values case-sensitive unless otherwise
 * specified, but Temporal's CanonicalizeCalendar (§12.1.1) matches the ASCII-lowercase of the
 * calendar id, so `[u-ca=HEBREW]` names the Hebrew calendar too. Reading any of these with
 * different digits from GMT's own shape would give the same tag two dates.
 *
 * A leap second (second `60`) throws too, in every spelling Temporal's grammar accepts — `T`,
 * `t` or space separator, extended or basic digits, with or without a designator. Temporal's
 * ParseISODateTime would otherwise clamp it to `:59`.
 *
 * Every other `relativeTo` (an unannotated ISO string, or a `PlainDate`/`PlainDateTime`/
 * `ZonedDateTime` object or `-Like`) passes through unchanged. A Temporal object is how a caller
 * supplies a calendar in Temporal's own convention.
 *
 * Returns a `Temporal.PlainDateTime` (midnight, same calendar) only because the polyfill's
 * TypeScript declaration and GMT's `DurationRelativeTo` type list `PlainDateTime`, not
 * `PlainDate`. Temporal itself resolves every zoneless `relativeTo` to a `PlainDate`: its
 * `GetTemporalRelativeToOption` converts a `PlainDateTime` with `CreateTemporalDate` and drops
 * the time, so passing a `PlainDate` gives the identical result.
 *
 * Throws if the calendar-annotated string is malformed. Callers already wrap the Temporal call
 * consuming this in `try { ... } catch { return sentinel }` per GMT's contract, so this composes
 * directly into that same block rather than needing its own try/catch.
 */
export function resolveDurationRelativeTo(
  relativeTo: DurationRelativeTo | undefined,
): DurationRelativeTo | undefined {
  if (typeof relativeTo !== "string") {
    return relativeTo;
  }
  if (relativeToLeapSecond.test(relativeTo)) {
    throw new RangeError(`Leap seconds are not supported: ${relativeTo}`);
  }
  if (calendarDate.test(relativeTo)) {
    return parseCalendarDateValue(relativeTo).toPlainDateTime();
  }
  if (anyCalendarAnnotation.test(relativeTo)) {
    throw new RangeError(`Not a GMT calendar PlainDate string: ${relativeTo}`);
  }
  return relativeTo;
}
