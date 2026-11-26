import { x12OffsetOf } from "../../internal/x12TimeCodes";
import type { X12OffsetTimeCode } from "../../types/edi";

/**
 * Read the UTC offset an X12 time code (data element 623) states.
 *
 * Data element 623 is the code beside the date (element 373) and time (element 337) of an X12
 * `AT7`, `G62` or `DTM` segment, and the only thing in the segment that says where the clock
 * was. 31 of its 56 codes state an offset; this function reads those. The element's own
 * definition: "Code identifying the time. In accordance with International Standards
 * Organization standard 8601, time can be specified by a + or - and an indication in hours in
 * relation to Universal Time Coordinate (UTC) time; since + is a restricted character, + and -
 * are substituted by P and M in the codes that follow". Codes are release 008010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-008010/element/623); the X12
 * text itself was not reached.
 *
 * ### Time codes that state an offset
 * | Codes | The dictionary's definition | Offset |
 * |---|---|---|
 * | `01`–`12` | "Equivalent to ISO P01" … "P12" | `+01:00` … `+12:00` |
 * | `13`–`24` | "Equivalent to ISO M12" … "M01" | `-12:00` … `-01:00`, counting down |
 * | `25`–`29` | "Equivalent to ISO M2:30", "M3:30", "P5:30", "P9:30", "P10:30" | `-02:30`, `-03:30`, `+05:30`, `+09:30`, `+10:30` |
 * | `UT` | "Universal Time Coordinate" | `+00:00` |
 * | `GM` | "Greenwich Mean Time" | `+00:00` |
 *
 * - **`13`–`24` count down**: `13` is `-12:00` and `24` is `-01:00`. The code rises as the
 *   offset nears UTC, so `20` is `-05:00`.
 * - **`25`–`29` were added in release 006010** and are not valid in an 004010 or 005010
 *   interchange. The function takes no release, so it reads them.
 * - **`GM` is `+00:00` by a GMT rule, not by X12's statement.** X12 defines it only by the name
 *   "Greenwich Mean Time". UN/ECE Recommendation 7 ¶12 names one scale by both names,
 *   "Co-ordinated Universal Time (formerly known as Greenwich Mean Time)", so GMT reads `GM` as
 *   UTC.
 * - **A named code returns `""`**: X12 states no offset for `ET`, `ES`, `PD` or `LT`, and GMT
 *   holds no table of zone offsets. Read one with `x12TimeCodeZone`.
 * - **To get the instant**, resolve the segment's local date-time at the offset:
 *   `resolveLocal(parseX12DateAndTime("20240615", "1430"), x12TimeCodeOffset("20"))` is
 *   `"2024-06-15T19:30:00Z"`.
 * - **For a code that arrives as a string**, call `classifyX12TimeCode` first: its `"offset"`
 *   result carries the code narrowed to this function's parameter.
 * - Matching is exact: two characters, upper case, no padding. Returns `""` for a code that is
 *   not one of the 56 and for a non-string. Use `isValidX12TimeCode` to check a code.
 *
 * @param timeCode X12 data element 623 time code (e.g. "20")
 * @returns the offset as `±HH:MM`, or "" on invalid input
 *
 * @example x12TimeCodeOffset("20") // "-05:00"
 * @example x12TimeCodeOffset("01") // "+01:00"
 * @example x12TimeCodeOffset("12") // "+12:00"
 * @example x12TimeCodeOffset("13") // "-12:00" (the 13–24 run counts down)
 * @example x12TimeCodeOffset("24") // "-01:00"
 * @example x12TimeCodeOffset("27") // "+05:30"
 * @example x12TimeCodeOffset("UT") // "+00:00"
 * @example x12TimeCodeOffset("GM") // "+00:00"
 * @example x12TimeCodeOffset("ET") // "" (a zone name: X12 states no offset for it)
 * @example x12TimeCodeOffset("30") // "" (not a 623 code)
 * @example x12TimeCodeOffset("ut") // "" (matching is exact)
 */
export function x12TimeCodeOffset(timeCode: X12OffsetTimeCode): string {
  return x12OffsetOf(timeCode);
}
