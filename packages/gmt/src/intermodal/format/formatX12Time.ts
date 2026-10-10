import { writeEdiValue } from "../../internal/ediDateTimeWriter";
import type { X12TimeFormat } from "../../types/edi";

/**
 * Write an ISO 8601 time as an X12 time in a time format qualifier (data element 1250). The
 * result is also a data element 337 (Time) value: `parseX12Time` reads it back with the same
 * qualifier, and with none.
 *
 * Codes are release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached.
 *
 * ### Format codes
 * | Code | Mask | The dictionary's definition |
 * |---|---|---|
 * | `TM` | `HHMM` | "Time Expressed in Format HHMM" |
 * | `TS` | `HHMMSS` | "Time Expressed in Format HHMMSS" |
 *
 * - `value` is a time, as `isValidTime` accepts it: `HH:MM`, with seconds and a fraction of a
 *   second if it has them. A date-time, a date or a time with an offset returns `""`.
 * - Precision is cut to the mask, never rounded: a fraction of a second is always dropped, and
 *   `TM` drops the seconds too. `14:30:45.123` is `1430` under `TM` and `143045` under `TS`.
 * - **To write the time element of a freight segment** (`AT7-06`, `G62-04`, `DTM-03`), use
 *   `formatX12TimeElement`: it writes all four forms of data element 337, named by the
 *   element's own masks, tenths and hundredths of a second included. `TM` and `TS` give the same
 *   digits as that element's `HHMM` and `HHMMSS` forms, and no 1250 code holds decimal seconds.
 * - `TS` here is the format `HHMMSS`. As a data element 623 time code, `TS` is Atlantic Standard
 *   Time: read that with `x12TimeCodeZone`.
 * - Returns `""` for any other code, a code of another kind included, and for a non-string
 *   argument.
 *
 * @param value ISO 8601 time (e.g. "14:30:00")
 * @param format X12 data element 1250 format qualifier
 * @returns the X12 time value, or "" on invalid input
 *
 * @example formatX12Time("14:30:00", "TM") // "1430"
 * @example formatX12Time("14:30:45", "TS") // "143045"
 * @example formatX12Time("14:30:45.123", "TM") // "1430" (the mask has no seconds)
 * @example formatX12Time("14:30:45.9", "TS") // "143045" (cut, not rounded)
 * @example formatX12Time("14:30", "TS") // "143000"
 * @example formatX12Time("2024-06-15T14:30:00", "TM") // "" (a date-time is not a time)
 * @example formatX12Time("24:00", "TM") // "" (not a real time)
 */
export function formatX12Time(value: string, format: X12TimeFormat): string {
  try {
    return writeEdiValue("x12", "time", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
