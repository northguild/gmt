import { readSwiftDateFields, swiftValueDateYear } from "../../internal";
import { Temporal } from "../../internal/temporal";

/**
 * Read the value date of a SWIFT MT message, `YYMMDD`, as an ISO 8601 date.
 *
 * - **What it reads.** The six-digit date component (`<DATE2>`, `6!n`) of field 30 or field 32A,
 *   such as `240615` from `:32A:240615EUR1000,00`. Pass the date component alone: a field tag,
 *   a currency, an amount or whitespace returns `""`. Digits are ASCII `0`–`9`.
 * - **The century is SWIFT's.** SWIFT's validation rules fix it for value dates: `YY` above 79
 *   is 19`YY`, the rest 20`YY`, and a year after 2060 is refused (error T50). So `80`–`99` read
 *   as 1980–1999, `00`–`60` as 2000–2060, and `61`–`79` return `""`. The function takes no
 *   window: there is no choice to make.
 * - **Where the rule applies.** SWIFT states it for value dates: field 32A of MT 910, and fields
 *   30 and 32A of category 1 and 2 messages other than the common group messages n92, n95 and
 *   n96. SWIFT states no century for other six-digit dates, such as field 31D of MT 700; read
 *   those with `parseDateWithPattern` and the `yearWindow` you know.
 * - **Days must exist** in the year the rule gives: `000229` is 29 February 2000, `840229` is
 *   29 February 1984, and `850229` returns `""`.
 * - **Sources.** SWIFT Standards MT, MT 103 field 32A (format `6!n3!a15d`; "Date must be a valid
 *   date expressed as YYMMDD", T50). SWIFT _Message Format Validation Rules_ (November 2006),
 *   Part II §4.1 Date and §4.1.1 Value Date. Both are in SWIFT's Knowledge Centre, which needs a
 *   login.
 * - Returns `""` for a non-string argument.
 *
 * @param value A SWIFT value date, `YYMMDD` (e.g. "240615")
 * @returns the ISO date ("2024-06-15"), or "" on invalid input
 *
 * @example parseSwiftDate("240615") // "2024-06-15"
 * @example parseSwiftDate("990615") // "1999-06-15"
 * @example parseSwiftDate("601231") // "2060-12-31"
 * @example parseSwiftDate("750101") // "" (2075 is after 2060: SWIFT error T50)
 * @example parseSwiftDate("000229") // "2000-02-29"
 * @example parseSwiftDate("850229") // "" (1985 is not a leap year)
 * @example parseSwiftDate("240615EUR1000,00") // "" (pass the date component alone)
 */
export function parseSwiftDate(value: string): string {
  try {
    if (typeof value !== "string") {
      return "";
    }
    const fields = readSwiftDateFields(value);
    if (fields === null) {
      return "";
    }
    // The century is resolved before the day is checked: 000229 is in 2000, 850229 in 1985.
    const year = swiftValueDateYear(fields.yy);
    if (year === null) {
      return "";
    }
    return Temporal.PlainDate.from(
      { year, month: fields.month, day: fields.day },
      { overflow: "reject" },
    ).toString();
  } catch {
    return "";
  }
}
