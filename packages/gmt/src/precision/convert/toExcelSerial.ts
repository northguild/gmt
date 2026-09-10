import {
  EXCEL_1900_EPOCH_NANOSECONDS,
  EXCEL_1900_PHANTOM_END_NANOSECONDS,
  EXCEL_1900_PRE_PHANTOM_EPOCH_NANOSECONDS,
  EXCEL_1904_EPOCH_NANOSECONDS,
  floorDivide,
  MAX_EXCEL_1900_SERIAL_EXCLUSIVE,
  MAX_EXCEL_1904_SERIAL_EXCLUSIVE,
  MIN_EXCEL_1900_SERIAL,
  MIN_EXCEL_1904_SERIAL,
  NANOSECONDS_PER_DAY,
  NANOSECONDS_PER_DAY_NUMBER,
  parseInstantNanoseconds,
} from "../../internal";

/**
 * Which Excel date system a serial belongs to.
 *
 * @remarks Members:
 *
 * | Member | Description |
 * | --- | --- |
 * | `"1900"` | The default, on every platform since Excel 2011 for Mac. Serial 1 is 1900-01-01, and serial 60 is the phantom 1900-02-29. |
 * | `"1904"` | The legacy Mac system, still found in workbooks authored on Excel 2008 for Mac and earlier. Serial 0 is 1904-01-01, and there is no phantom day. |
 */
export type ExcelDateSystem = "1900" | "1904";

/**
 * Convert an ISO 8601 instant string to an Excel day serial.
 *
 * - The serial is days, with the time of day as the fraction: 45361.5 is midday on
 *   2024-03-10. The date is the UTC wall clock — a zoned input is converted to UTC first,
 *   so `"2024-03-10T12:00:00-05:00"` is serial 45361.708…, the 17:00 UTC it names.
 * - **The 1900 system's serial 60 is the phantom 29 February 1900**, a date that never
 *   existed — 1900 was not a leap year. Lotus 1-2-3 got it wrong and Excel keeps the bug for
 *   compatibility. No instant maps to serial 60: 1900-02-28 is 59 and 1900-03-01 is 61.
 *   Silently "fixing" this would put GMT one day out from Excel for every date before March
 *   1900.
 * - `{ system: "1904" }` selects the legacy Mac system, whose serial 0 is 1904-01-01. The
 *   same instant is exactly 1462 lower there than in the 1900 system.
 * - **Instants outside Excel's own serial range are invalid input**, not an out-of-range
 *   number: the 1900 system runs from serial 1 (1900-01-01) to 2958465 (9999-12-31), the
 *   1904 system from serial 0 (1904-01-01) to 2957003. Serial 0 in the 1900 system is
 *   Excel's "January 0, 1900" placeholder, not a date, so it is rejected too.
 * - The serial is a `double`, as it is in a workbook. The whole-day part is exact; the
 *   intra-day fraction is not, so precision below roughly a microsecond is not
 *   representable, and it degrades toward year 9999. Round-tripping through
 *   `fromExcelSerial` is exact to the millisecond, which is as fine as Excel itself goes.
 * - **The last ~20 µs of 9999-12-31 returns null**, from
 *   `"9999-12-31T23:59:59.999979884Z"` on. A `double` near serial 2958465 resolves to about
 *   40 µs, so those instants round to exactly 2958466 — one past Excel's last serial. The
 *   range check is deliberately made on the rounded serial rather than the exact instant, so
 *   a returned number is always one Excel accepts; the alternative is handing back a 2958466
 *   that Excel rejects on the way in.
 *
 * @param isoString ISO 8601 instant string (e.g. "2024-03-10T12:00:00Z")
 * @param options optional: system ("1900" (default) | "1904")
 * @returns Excel day serial as a number, or null on invalid input
 *
 * @example toExcelSerial("1900-01-01T00:00:00Z") // 1 — Excel's first serial
 * @example toExcelSerial("1970-01-01T00:00:00Z") // 25569
 * @example toExcelSerial("2024-03-10T12:00:00Z") // 45361.5
 * @example toExcelSerial("1900-02-28T00:00:00Z") // 59 — the next day is 61, not 60
 * @example toExcelSerial("1900-03-01T00:00:00Z") // 61 — serial 60 is the phantom 1900-02-29
 * @example toExcelSerial("2024-03-10T12:00:00Z", { system: "1904" }) // 43899.5 — exactly 1462 lower
 * @example toExcelSerial("1899-12-31T00:00:00Z") // null — Excel's "January 0", not a date
 * @example toExcelSerial("9999-12-31T23:59:59.99998Z") // null — rounds to 2958466, one past Excel's last serial
 * @example toExcelSerial("invalid") // null
 */
export function toExcelSerial(
  isoString: string,
  options?: { system?: ExcelDateSystem },
): number | null {
  const system = options?.system ?? "1900";

  if (system !== "1900" && system !== "1904") {
    return null;
  }

  const nanoseconds = parseInstantNanoseconds(isoString);

  if (nanoseconds === null) {
    return null;
  }

  const epochNanoseconds =
    system === "1904"
      ? EXCEL_1904_EPOCH_NANOSECONDS
      : nanoseconds >= EXCEL_1900_PHANTOM_END_NANOSECONDS
        ? EXCEL_1900_EPOCH_NANOSECONDS
        : EXCEL_1900_PRE_PHANTOM_EPOCH_NANOSECONDS;

  // Split the day count from the intra-day remainder so the whole-day part stays exact:
  // a single `Number(...) / 86400e9` would round the day count through the same double as
  // the fraction, and the serials Excel actually stores are mostly whole days.
  const sinceEpoch = nanoseconds - epochNanoseconds;
  const days = floorDivide(sinceEpoch, NANOSECONDS_PER_DAY);
  const serial =
    Number(days) +
    Number(sinceEpoch - days * NANOSECONDS_PER_DAY) /
      NANOSECONDS_PER_DAY_NUMBER;

  const minimum =
    system === "1904" ? MIN_EXCEL_1904_SERIAL : MIN_EXCEL_1900_SERIAL;
  const maximumExclusive =
    system === "1904"
      ? MAX_EXCEL_1904_SERIAL_EXCLUSIVE
      : MAX_EXCEL_1900_SERIAL_EXCLUSIVE;

  if (serial < minimum || serial >= maximumExclusive) {
    return null;
  }

  return serial;
}
