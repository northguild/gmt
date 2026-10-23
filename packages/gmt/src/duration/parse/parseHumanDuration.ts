import { Temporal } from "../../internal/temporal";
import { humanDurationToIso } from "../../internal/humanDuration";

/**
 * Read a duration written the way people write it, such as `2h 30m`, `1.5h` or `3 days`, into an
 * ISO 8601 duration string.
 *
 * - Implements no standard: the grammar is GMT's own and is stated in full here; the result is an
 *   ISO 8601 duration as `Temporal.Duration.prototype.toString` writes it.
 * - The grammar, in ISO/IEC 14977 EBNF:
 *
 *   ```text
 *   human duration = [ sign ], pair, { separator, pair } ;
 *   sign           = "+" | "-" ;
 *   pair           = number, { space }, unit ;
 *   number         = digit, { digit }, [ ".", digit, 8 * [ digit ] ] ;
 *   separator      = { space }-
 *                  | ",", { space }
 *                  | [ "," ], { space }-, "and", { space }-
 *                  | ;                                   (* empty: "2h30m" *)
 *   space          = " " ;                               (* U+0020 only *)
 *   digit          = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
 *   unit           = (* one spelling from the table below *) ;
 *   ```
 *
 *   Unit spellings and `and` are ASCII case-insensitive; the longest matching spelling wins and no ASCII letter
 *   may follow it (`1mx` returns `""`).
 *
 *   | Unit        | Spellings                           | ISO field     | Fraction  |
 *   | ----------- | ----------------------------------- | ------------- | --------- |
 *   | year        | `y` `yr` `yrs` `year` `years`       | `nY`          | no        |
 *   | month       | `mo` `month` `months`               | `nM` before T | no        |
 *   | week        | `w` `wk` `wks` `week` `weeks`       | `nW`          | no        |
 *   | day         | `d` `day` `days`                    | `nD`          | no        |
 *   | hour        | `h` `hr` `hrs` `hour` `hours`       | `TnH`         | last only |
 *   | minute      | `m` `min` `mins` `minute` `minutes` | `TnM`         | last only |
 *   | second      | `s` `sec` `secs` `second` `seconds` | `TnS`         | last only |
 *   | millisecond | `ms` `millisecond` `milliseconds`   | folded into S | no        |
 *
 * - `m` and `M` are a minute; `mo` is a month; `ms` and `MS` are a millisecond. ISO 8601's `P1M`
 *   is a month and is not read here: this function returns `""` for any ISO string.
 * - No string is valid both as ISO 8601 and in this grammar, so a caller that takes either form
 *   chains them: `parseDuration(s) || parseHumanDuration(s)`.
 * - Each unit at most once, largest first; a typo such as `2h 3h` or `30m 2h` returns `""`.
 * - A fraction only on hours, minutes or seconds, only on the last unit, at most 9 digits, with a
 *   digit on both sides of `.`. It spreads into smaller units: `1.5h` is `PT1H30M`. `,` is never
 *   a decimal sign.
 * - Milliseconds take no fraction and join the seconds: `1s 500ms` is `PT1.5S`.
 * - A space is U+0020 only, and runs of them are fine (`2h  30m`, `3   days`). A leading or
 *   trailing space, a tab, a newline or U+00A0 returns `""`: trim the input first.
 * - One `+` or `-` before the first digit covers the whole duration; U+2212 `−` and `- 2h` return
 *   `""`.
 * - Zero units are dropped (`2h 0m` is `PT2H`); a zero duration is `PT0S`.
 * - Months and years stay calendar units; their length is decided when the duration is added to
 *   a date.
 * - Returns `""` for a non-string, a string outside the grammar, or a duration past Temporal's
 *   limits (years, months, weeks below 2^32; the rest below 2^53 seconds).
 *
 * @param text The human duration string, such as `"2h 30m"`
 * @returns An ISO 8601 duration string, or `""` on invalid input
 *
 * @example parseHumanDuration("2h 30m") // "PT2H30M"
 * @example parseHumanDuration("3 days") // "P3D"
 * @example parseHumanDuration("1.5h") // "PT1H30M"
 * @example parseHumanDuration("1s 500ms") // "PT1.5S"
 * @example parseHumanDuration("1m") // "PT1M" (a minute)
 * @example parseHumanDuration("1mo") // "P1M" (a month)
 * @example parseHumanDuration("-2h 30m") // "-PT2H30M"
 * @example parseHumanDuration("2h, and 30m") // "PT2H30M"
 * @example parseHumanDuration("1.5h 30m") // ""
 * @example parseHumanDuration("30m 2h") // ""
 * @example parseHumanDuration("P1M") // ""
 */
export function parseHumanDuration(text: string): string {
  if (typeof text !== "string") {
    return "";
  }
  const iso = humanDurationToIso(text);
  if (iso === null) {
    return "";
  }
  try {
    return Temporal.Duration.from(iso).toString();
  } catch {
    return "";
  }
}
