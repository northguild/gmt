import {
  EXCEL_1900_EPOCH_NANOSECONDS,
  EXCEL_1900_PRE_PHANTOM_EPOCH_NANOSECONDS,
  EXCEL_1904_EPOCH_NANOSECONDS,
  EXCEL_PHANTOM_SERIAL,
  MAX_EXCEL_1900_SERIAL_EXCLUSIVE,
  MAX_EXCEL_1904_SERIAL_EXCLUSIVE,
  MILLISECONDS_PER_DAY,
  MIN_EXCEL_1900_SERIAL,
  MIN_EXCEL_1904_SERIAL,
  NANOSECONDS_PER_MILLISECOND,
} from "../../internal";
import { fromNanoseconds } from "./fromNanoseconds";
import type { ExcelDateSystem } from "./toExcelSerial";

/**
 * Convert an Excel day serial back to an ISO 8601 instant string.
 *
 * - The serial is days with the time of day as the fraction, read as a UTC wall clock.
 * - **Serial 60 in the 1900 system returns ""** — it is the phantom 29 February 1900, a date
 *   that never existed. Lotus 1-2-3 treated 1900 as a leap year and Excel keeps the bug for
 *   compatibility, so the whole serial day `[60, 61)` is a hole: 59 is 1900-02-28 and 61 is
 *   1900-03-01. Mapping 60 to either neighbour would put every earlier date one day out.
 * - `{ system: "1904" }` selects the legacy Mac system, whose serial 0 is 1904-01-01 and
 *   which has no phantom day — serial 60 there is a real 1904-03-01. A 1904 serial resolves
 *   to the same instant as the 1900 serial exactly 1462 higher.
 * - Accepted range is Excel's own: serial 1 (1900-01-01) to just under 2958466 (the end of
 *   9999-12-31) in the 1900 system, serial 0 to just under 2957004 in the 1904 system.
 *   Serial 0 in the 1900 system is Excel's "January 0, 1900" placeholder, not a date.
 * - Rounds to the nearest millisecond. A serial is a `double`, whose resolution is about a
 *   microsecond near 2024 and about 40 µs near 9999 — finer than a millisecond nowhere in
 *   the range, so rounding there is what makes the round trip through `toExcelSerial` exact.
 * - Returns "" on invalid input.
 *
 * @param value Excel day serial (number, may carry a fractional time of day)
 * @param options optional: system ("1900" (default) | "1904")
 * @returns ISO 8601 instant string (UTC), or "" on invalid input
 *
 * @example fromExcelSerial(1) // "1900-01-01T00:00:00Z" — Excel's first serial
 * @example fromExcelSerial(25569) // "1970-01-01T00:00:00Z"
 * @example fromExcelSerial(45361.5) // "2024-03-10T12:00:00Z"
 * @example fromExcelSerial(59) // "1900-02-28T00:00:00Z"
 * @example fromExcelSerial(60) // "" — the phantom 1900-02-29, a date that never existed
 * @example fromExcelSerial(61) // "1900-03-01T00:00:00Z"
 * @example fromExcelSerial(60, { system: "1904" }) // "1904-03-01T00:00:00Z" — no phantom day here
 * @example fromExcelSerial(43899.5, { system: "1904" }) // "2024-03-10T12:00:00Z"
 * @example fromExcelSerial(0) // "" — Excel's "January 0, 1900", not a date
 * @example fromExcelSerial(-1) // ""
 */
export function fromExcelSerial(
  value: number,
  options?: { system?: ExcelDateSystem },
): string {
  const system = options?.system ?? "1900";

  if (system !== "1900" && system !== "1904") {
    return "";
  }

  if (!Number.isFinite(value)) {
    return "";
  }

  // Snap to the millisecond grid before deciding anything: the range and phantom-day
  // comparisons must be made against the value actually built, not against a serial that
  // rounds across a boundary on the way there.
  const dayMilliseconds = Math.round(value * MILLISECONDS_PER_DAY);

  const minimum =
    system === "1904" ? MIN_EXCEL_1904_SERIAL : MIN_EXCEL_1900_SERIAL;
  const maximumExclusive =
    system === "1904"
      ? MAX_EXCEL_1904_SERIAL_EXCLUSIVE
      : MAX_EXCEL_1900_SERIAL_EXCLUSIVE;

  if (
    dayMilliseconds < minimum * MILLISECONDS_PER_DAY ||
    dayMilliseconds >= maximumExclusive * MILLISECONDS_PER_DAY
  ) {
    return "";
  }

  if (system === "1904") {
    return fromNanoseconds(
      BigInt(dayMilliseconds) * NANOSECONDS_PER_MILLISECOND +
        EXCEL_1904_EPOCH_NANOSECONDS,
    );
  }

  const phantomStart = EXCEL_PHANTOM_SERIAL * MILLISECONDS_PER_DAY;
  const phantomEnd = (EXCEL_PHANTOM_SERIAL + 1) * MILLISECONDS_PER_DAY;

  if (dayMilliseconds >= phantomStart && dayMilliseconds < phantomEnd) {
    return "";
  }

  return fromNanoseconds(
    BigInt(dayMilliseconds) * NANOSECONDS_PER_MILLISECOND +
      (dayMilliseconds >= phantomEnd
        ? EXCEL_1900_EPOCH_NANOSECONDS
        : EXCEL_1900_PRE_PHANTOM_EPOCH_NANOSECONDS),
  );
}
