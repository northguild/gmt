import type { X12TimeCode } from "../../types/edi";

/**
 * An X12 time code that resolves to a UTC offset: the numeric codes `01`–`29` and `UT`, whose
 * offset the standard states, and `GM`, which GMT reads as UTC. Tell it from `X12TimeCodeZone` by
 * its `offset` member.
 */
export interface X12TimeCodeOffset {
  /**
   * The offset from UTC, `±HH:MM`. `UT` and `GM` are `+00:00`. `parseX12DateTime` pairs it with
   * a segment's date and time to give the instant.
   */
  offset: string;
}

/**
 * An X12 time code that names a zone and states no offset: the lettered codes other than `GM` and
 * `UT`. Tell it from `X12TimeCodeOffset` by its `zone` member.
 */
export interface X12TimeCodeZone {
  /**
   * X12's own name for the zone, as its definition writes it: `Alaska`, `Central`, `Eastern`,
   * `Hawaii-Aleutian`, `Mountain`, `Newfoundland`, `Pacific` or `Atlantic`, and `Local` for `LT`.
   * It is a name, not an IANA identifier and not an offset: the caller maps it to a zone.
   */
  zone: string;
  /**
   * Whether the code says daylight time. `true` for a `D` code (`ED`), `false` for an `S` code
   * (`ES`), and `null` for a code that says neither (`ET`, `LT`), where the date decides.
   */
  daylight: boolean | null;
}

/**
 * What an X12 data element 623 time code states: an offset from UTC, or a zone name with no
 * offset. A code is never both, so `"offset" in meaning` tells the two apart.
 */
export type X12TimeCodeMeaning = X12TimeCodeOffset | X12TimeCodeZone;

/**
 * X12 data element 623 code → what its definition states, release 008010, read from Stedi's
 * X12-licensed dictionary (https://www.stedi.com/edi/x12-008010/element/623); the X12 text was
 * not reached. Each comment quotes the definition. The numeric offsets are the standard's data,
 * written out rather than computed: `P` is plus and `M` is minus, and the `13`–`24` run counts
 * down. `25`–`29` were added in release 006010; release 005010 has the other 51 codes.
 * Typed by `X12TimeCode`, so a missing code fails typecheck.
 */
const X12_TIME_CODE_MEANING: Readonly<Record<X12TimeCode, X12TimeCodeMeaning>> =
  {
    // "Equivalent to ISO P01" … "P12"
    "01": { offset: "+01:00" },
    "02": { offset: "+02:00" },
    "03": { offset: "+03:00" },
    "04": { offset: "+04:00" },
    "05": { offset: "+05:00" },
    "06": { offset: "+06:00" },
    "07": { offset: "+07:00" },
    "08": { offset: "+08:00" },
    "09": { offset: "+09:00" },
    "10": { offset: "+10:00" },
    "11": { offset: "+11:00" },
    "12": { offset: "+12:00" },
    // "Equivalent to ISO M12" … "M01": descending, so the code rises as the offset nears UTC.
    "13": { offset: "-12:00" },
    "14": { offset: "-11:00" },
    "15": { offset: "-10:00" },
    "16": { offset: "-09:00" },
    "17": { offset: "-08:00" },
    "18": { offset: "-07:00" },
    "19": { offset: "-06:00" },
    "20": { offset: "-05:00" },
    "21": { offset: "-04:00" },
    "22": { offset: "-03:00" },
    "23": { offset: "-02:00" },
    "24": { offset: "-01:00" },
    // "Equivalent to ISO M2:30", "M3:30", "P5:30", "P9:30", "P10:30"
    "25": { offset: "-02:30" },
    "26": { offset: "-03:30" },
    "27": { offset: "+05:30" },
    "28": { offset: "+09:30" },
    "29": { offset: "+10:30" },
    // "Alaska Daylight Time", "Alaska Standard Time", "Alaska Time"
    AD: { zone: "Alaska", daylight: true },
    AS: { zone: "Alaska", daylight: false },
    AT: { zone: "Alaska", daylight: null },
    // "Central Daylight Time", "Central Standard Time", "Central Time"
    CD: { zone: "Central", daylight: true },
    CS: { zone: "Central", daylight: false },
    CT: { zone: "Central", daylight: null },
    // "Eastern Daylight Time", "Eastern Standard Time", "Eastern Time"
    ED: { zone: "Eastern", daylight: true },
    ES: { zone: "Eastern", daylight: false },
    ET: { zone: "Eastern", daylight: null },
    // "Greenwich Mean Time". X12 gives the name and no ISO designator, so the offset is a GMT
    // rule: UN/ECE Recommendation 7 ¶12 names the scale "Co-ordinated Universal Time (formerly
    // known as Greenwich Mean Time)". It is the one zone-name code that resolves to an offset.
    GM: { offset: "+00:00" },
    // "Hawaii-Aleutian Daylight Time", "Hawaii-Aleutian Standard Time", "Hawaii-Aleutian Time"
    HD: { zone: "Hawaii-Aleutian", daylight: true },
    HS: { zone: "Hawaii-Aleutian", daylight: false },
    HT: { zone: "Hawaii-Aleutian", daylight: null },
    // "Local Time"
    LT: { zone: "Local", daylight: null },
    // "Mountain Daylight Time", "Mountain Standard Time", "Mountain Time"
    MD: { zone: "Mountain", daylight: true },
    MS: { zone: "Mountain", daylight: false },
    MT: { zone: "Mountain", daylight: null },
    // "Newfoundland Daylight Time", "Newfoundland Standard Time", "Newfoundland Time"
    ND: { zone: "Newfoundland", daylight: true },
    NS: { zone: "Newfoundland", daylight: false },
    NT: { zone: "Newfoundland", daylight: null },
    // "Pacific Daylight Time", "Pacific Standard Time", "Pacific Time"
    PD: { zone: "Pacific", daylight: true },
    PS: { zone: "Pacific", daylight: false },
    PT: { zone: "Pacific", daylight: null },
    // "Atlantic Daylight Time", "Atlantic Standard Time", "Atlantic Time"
    TD: { zone: "Atlantic", daylight: true },
    TS: { zone: "Atlantic", daylight: false },
    TT: { zone: "Atlantic", daylight: null },
    // "Universal Time Coordinate": UTC itself.
    UT: { offset: "+00:00" },
  };

/**
 * Read an X12 time code (data element 623) as what it states: an offset from UTC, or the name of
 * a zone.
 *
 * Data element 623 is the code beside the date (element 373) and time (element 337) of an X12
 * `AT7`, `G62` or `DTM` segment, and the only thing in the segment that says where the clock
 * was. `parseX12DateTime` reads the three elements together and calls this function for the
 * code. The element's own definition: "Code identifying the time. In accordance with
 * International Standards Organization standard 8601, time can be specified by a + or - and an
 * indication in hours in relation to Universal Time Coordinate (UTC) time; since + is a
 * restricted character, + and - are substituted by P and M in the codes that follow".
 *
 * The 56 codes are release 008010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-008010/element/623); the X12
 * text itself was not reached.
 * [Release 005010](https://www.stedi.com/edi/x12-005010/element/623) has 51 of them: `25`–`29`
 * were added in release 006010 and are not valid in an 004010 or 005010 interchange. The
 * function takes no release, so it reads the superset.
 *
 * - **`01`–`12` are UTC+1 to UTC+12** ("Equivalent to ISO P01" … "P12") and return
 *   `{ offset }`.
 * - **`13`–`24` are UTC−12 to UTC−1, in descending order** ("Equivalent to ISO M12" … "M01"):
 *   `13` is `-12:00` and `24` is `-01:00`. The code rises as the offset nears UTC.
 * - **`25`–`29` are the half-hour offsets** `-02:30`, `-03:30`, `+05:30`, `+09:30` and `+10:30`
 *   ("Equivalent to ISO M2:30" … "P10:30").
 * - **`UT` is UTC** ("Universal Time Coordinate") and returns `{ offset: "+00:00" }`.
 * - **`GM` returns `{ offset: "+00:00" }` by a GMT rule, not by X12's statement.** X12 defines
 *   `GM` only by the name "Greenwich Mean Time" and gives it no ISO designator. UN/ECE
 *   Recommendation 7 ¶12 names one scale by both names, "Co-ordinated Universal Time (formerly
 *   known as Greenwich Mean Time)", so GMT reads `GM` as UTC. It is the one zone-name code that
 *   yields an offset, because it is the one name a standard equates with UTC: X12 states no
 *   offset for any other name, and GMT holds no table of zone offsets.
 * - **A named code is a zone name, not an offset.** `AD`/`AS` Alaska, `CD`/`CS` Central,
 *   `ED`/`ES` Eastern, `HD`/`HS` Hawaii-Aleutian, `MD`/`MS` Mountain, `ND`/`NS` Newfoundland,
 *   `PD`/`PS` Pacific and `TD`/`TS` Atlantic return `{ zone, daylight }` with X12's own zone
 *   name, `daylight: true` for the `D` code and `false` for the `S` code. X12 states no offset
 *   for them and GMT holds no registry of places, so the caller maps the name to an IANA zone. A
 *   caller might choose `America/New_York` for `Eastern`; the choice is the caller's.
 * - **A generic code says neither standard nor daylight.** `AT`, `CT`, `ET`, `HT`, `MT`, `NT`,
 *   `PT` and `TT` return `{ zone, daylight: null }`: resolve the local time against the date as
 *   well as the zone, with `resolveLocal`.
 * - **`LT` is local to the event** and returns `{ zone: "Local", daylight: null }`. The place is
 *   elsewhere in the message, so the caller supplies its zone.
 * - **`TS`, `TT`, `CD` and `MD` are codes of data element 1250 too**, with unrelated meanings:
 *   here they are Atlantic Standard, Atlantic, Central Daylight and Mountain Daylight Time;
 *   there `TS` is the format `HHMMSS` and `TT` is `MMDDYY`. Pass a time code here and a format
 *   qualifier to `parseX12DateTimePeriod`.
 * - Matching is exact: two characters, upper case, no padding. Each call returns a new object.
 * - Returns `null` for a code that is not one of the 56, an empty string and a non-string. Use
 *   `isValidX12TimeCode` to check a code without reading it.
 *
 * @param timeCode X12 data element 623 time code (e.g. "ES")
 * @returns `{ offset }` or `{ zone, daylight }`, or null on invalid input
 *
 * @example x12TimeCode("ES") // { zone: "Eastern", daylight: false }
 * @example x12TimeCode("ED") // { zone: "Eastern", daylight: true }
 * @example x12TimeCode("ET") // { zone: "Eastern", daylight: null } (the date decides)
 * @example x12TimeCode("LT") // { zone: "Local", daylight: null } (the place is elsewhere in the message)
 * @example x12TimeCode("UT") // { offset: "+00:00" }
 * @example x12TimeCode("GM") // { offset: "+00:00" }
 * @example x12TimeCode("01") // { offset: "+01:00" }
 * @example x12TimeCode("13") // { offset: "-12:00" } (the 13–24 run counts down)
 * @example x12TimeCode("24") // { offset: "-01:00" }
 * @example x12TimeCode("27") // { offset: "+05:30" }
 * @example x12TimeCode("et") // null (matching is exact)
 * @example x12TimeCode("30") // null (not a 623 code)
 * @example x12TimeCode("") // null
 */
export function x12TimeCode(timeCode: string): X12TimeCodeMeaning | null {
  if (
    typeof timeCode !== "string" ||
    !Object.hasOwn(X12_TIME_CODE_MEANING, timeCode)
  ) {
    return null;
  }
  // A copy, so a caller cannot change the table through a result.
  return { ...X12_TIME_CODE_MEANING[timeCode as X12TimeCode] };
}
