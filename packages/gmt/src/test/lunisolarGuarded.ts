import { guardedDateTimeFormat } from "../internal/formatterCache";
import { formatRangeRepaired } from "../internal/rangeFields";
import { normalizeDateTime } from "../internal/normalizeDateTime";
import { Temporal } from "../internal/temporal";

/*
 * Chinese and Dangi dates are refused by the public functions on every host (compat D33), so the
 * repairs that stay in place for the day D33 retires (D28, and the chinese and dangi parts of D29)
 * are reached through the formatter the public functions build from, `guardedDateTimeFormat`.
 */

const utcMilliseconds = (iso: string): number =>
  Temporal.PlainDate.from(iso).toZonedDateTime("UTC").epochMilliseconds;

/** The options a plain date formats with: the caller's, in UTC. */
const inUtc = (
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatOptions => ({ ...options, timeZone: "UTC" });

/** The single text of the ISO date at UTC midnight, from the guarded formatter. */
export function guardedFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
  iso: string,
): string {
  return normalizeDateTime(
    guardedDateTimeFormat(locale, inUtc(options)).format(utcMilliseconds(iso)),
  );
}

/** The parts of the ISO date at UTC midnight, from the guarded formatter. */
export function guardedParts(
  locale: string,
  options: Intl.DateTimeFormatOptions,
  iso: string,
): Intl.DateTimeFormatPart[] {
  return guardedDateTimeFormat(locale, inUtc(options)).formatToParts(
    utcMilliseconds(iso),
  );
}

/** The repaired range text between two ISO dates, normalized as the range functions do. */
export function guardedRange(
  locale: string,
  options: Intl.DateTimeFormatOptions,
  from: string,
  to: string,
): string {
  const resolved = inUtc(options);
  const out = formatRangeRepaired(
    guardedDateTimeFormat(locale, resolved),
    resolved,
    utcMilliseconds(from),
    utcMilliseconds(to),
  );
  return out === null ? "" : normalizeDateTime(out);
}
