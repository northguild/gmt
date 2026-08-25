import { calendarDate } from "../regex";
import type { DurationRelativeTo } from "../types";
import { parseCalendarDateValue } from "./calendarDateString";

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
 * and fixed as part of E5 (issue #78); this is D1's "`duration/`'s `relativeTo` accepts the GMT
 * shape only" decision of record.
 *
 * Every other `relativeTo` shape (a plain ISO string, a `PlainDateTime`/`ZonedDateTime` object
 * or `-Like`, or any string that isn't a GMT calendar-annotated PlainDate) passes through
 * unchanged — GMT's calendar-string contract only covers `plain/` `PlainDate` (D1).
 *
 * Resolves to a `Temporal.PlainDateTime` (midnight, same calendar) rather than a bare
 * `Temporal.PlainDate` — verified equivalent at runtime (`.total`/`.round`/`.compare` all
 * produce the identical result either way) and `PlainDateTime` is the type Temporal's own
 * `relativeTo` option signature actually accepts, unlike `PlainDate`.
 *
 * Throws if the calendar-annotated string is malformed. Callers already wrap the Temporal call
 * consuming this in `try { ... } catch { return sentinel }` per GMT's contract, so this composes
 * directly into that same block rather than needing its own try/catch.
 */
export function resolveDurationRelativeTo(
  relativeTo: DurationRelativeTo | undefined,
): DurationRelativeTo | undefined {
  if (typeof relativeTo !== "string" || !calendarDate.test(relativeTo)) {
    return relativeTo;
  }
  return parseCalendarDateValue(relativeTo).toPlainDateTime();
}
