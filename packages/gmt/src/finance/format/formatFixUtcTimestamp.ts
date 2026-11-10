import {
  fixTimestampText,
  LEAP_SECOND_STEPS,
  parseUtcReading,
  resolveFixPrecision,
  taiOfUtc,
} from "../../internal";
import type { FixPrecision } from "../../types/fix";

/**
 * Write an instant as a FIX `UTCTimestamp` at the precision a counterparty asks for.
 *
 * - The output is `YYYYMMDD-HH:MM:SS` or `YYYYMMDD-HH:MM:SS.fraction` (FIX Latest,
 *   `UTCTimestamp`: "colons, dash, and period required"). The fraction has 3, 6, 9 or 12 digits:
 *
 *   | `precision`     | Fraction digits |
 *   | --------------- | --------------- |
 *   | `"second"`      | none, no period |
 *   | `"millisecond"` | 3               |
 *   | `"microsecond"` | 6               |
 *   | `"nanosecond"`  | 9               |
 *   | `"picosecond"`  | 12              |
 *
 * - Converts to UTC first: an offset or zone is applied, then dropped.
 * - Cuts to the precision and never rounds: `…:00.9999` at `"second"` is `…:00`. Rounding could
 *   move a stamp into the next second, minute or day.
 * - `"picosecond"` writes the nine nanosecond digits and `000`: the value holds nothing finer.
 *   To send real picoseconds, keep them from `parseFixUtcTimestamp`'s `picoseconds` and write
 *   them yourself.
 * - A leap second (`…T23:59:60Z`, or the same second in any offset) is written with `60`; a
 *   second of 60 on any other day returns `""`.
 * - Returns `""` for a local date-time with no offset: it names no UTC second until a zone is
 *   given, so give the instant first with `resolveLocal`, which applies a stated disambiguation
 *   policy. This function converts no wall time, so it takes no disambiguation option.
 * - Returns `""` for a UTC year outside 0000-9999, FIX's range.
 * - Precision names are accepted singular or plural.
 * - Returns `""` for a non-string `value` or an unknown `precision`.
 *
 * @param value ISO 8601 instant (e.g. "2024-06-15T14:30:00.123Z")
 * @param precision The FIX precision: `"second"`, `"millisecond"`, `"microsecond"`, `"nanosecond"` or `"picosecond"`
 * @returns the FIX `UTCTimestamp`, or "" on invalid input
 *
 * @example formatFixUtcTimestamp("2024-06-15T16:30:00.123456789+02:00", "second") // "20240615-14:30:00"
 * @example formatFixUtcTimestamp("2024-06-15T16:30:00.123456789+02:00", "millisecond") // "20240615-14:30:00.123"
 * @example formatFixUtcTimestamp("2024-06-15T16:30:00.123456789+02:00", "microsecond") // "20240615-14:30:00.123456"
 * @example formatFixUtcTimestamp("2024-06-15T16:30:00.123456789+02:00", "nanosecond") // "20240615-14:30:00.123456789"
 * @example formatFixUtcTimestamp("2024-06-15T16:30:00.123456789+02:00", "picosecond") // "20240615-14:30:00.123456789000"
 * @example formatFixUtcTimestamp("2016-12-31T23:59:60Z", "second") // "20161231-23:59:60"
 * @example formatFixUtcTimestamp("2024-06-15T14:30:00", "second") // "" (no offset: name the zone first, with resolveLocal)
 */
export function formatFixUtcTimestamp(
  value: string,
  precision: FixPrecision,
): string {
  try {
    const unit = resolveFixPrecision(precision);
    if (unit === null) {
      return "";
    }
    const reading = parseUtcReading(value);
    if (reading === null) {
      return "";
    }
    // Only for a 60: taiOfUtc is null before 1972 for an ordinary second too, and FIX allows 0000.
    if (reading.secondSixty && taiOfUtc(LEAP_SECOND_STEPS, reading) === null) {
      return "";
    }
    return fixTimestampText(reading, unit);
  } catch {
    return "";
  }
}
