import type {
  X12NamedZone,
  X12OffsetTimeCode,
  X12TimeCodeClass,
  X12ZoneTimeCode,
} from "../types/edi";

/**
 * X12 data element 623 code → the offset its definition states, release 008010, read from
 * Stedi's X12-licensed dictionary (https://www.stedi.com/edi/x12-008010/element/623); the X12
 * text was not reached. Each comment quotes the definition. The offsets are the standard's data,
 * written out rather than computed: `P` is plus and `M` is minus, and the `13`–`24` run counts
 * down. `25`–`29` were added in release 006010. Typed by `X12OffsetTimeCode`, so a missing code
 * fails typecheck.
 */

const X12_TIME_CODE_OFFSET: Readonly<Record<X12OffsetTimeCode, string>> = {
  // "Equivalent to ISO P01" … "P12"
  "01": "+01:00",
  "02": "+02:00",
  "03": "+03:00",
  "04": "+04:00",
  "05": "+05:00",
  "06": "+06:00",
  "07": "+07:00",
  "08": "+08:00",
  "09": "+09:00",
  "10": "+10:00",
  "11": "+11:00",
  "12": "+12:00",
  // "Equivalent to ISO M12" … "M01": descending, so the code rises as the offset nears UTC.
  "13": "-12:00",
  "14": "-11:00",
  "15": "-10:00",
  "16": "-09:00",
  "17": "-08:00",
  "18": "-07:00",
  "19": "-06:00",
  "20": "-05:00",
  "21": "-04:00",
  "22": "-03:00",
  "23": "-02:00",
  "24": "-01:00",
  // "Equivalent to ISO M2:30", "M3:30", "P5:30", "P9:30", "P10:30"
  "25": "-02:30",
  "26": "-03:30",
  "27": "+05:30",
  "28": "+09:30",
  "29": "+10:30",
  // "Greenwich Mean Time". X12 gives the name and no ISO designator, so the offset is a GMT
  // rule: UN/ECE Recommendation 7 ¶12 names the scale "Co-ordinated Universal Time (formerly
  // known as Greenwich Mean Time)". It is the one zone-name code that resolves to an offset.
  GM: "+00:00",
  // "Universal Time Coordinate": UTC itself.
  UT: "+00:00",
};

/**
 * X12 data element 623 code → the zone its definition names, release 008010, read from Stedi's
 * X12-licensed dictionary (https://www.stedi.com/edi/x12-008010/element/623); the X12 text was
 * not reached. Each comment quotes the definition. Typed by `X12ZoneTimeCode`, so a missing code
 * fails typecheck.
 */

const X12_TIME_CODE_ZONE: Readonly<Record<X12ZoneTimeCode, X12NamedZone>> = {
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
};

/**
 * The core of `x12TimeCodeOffset`: the `±HH:MM` offset an X12 time code names.
 *
 * @param timeCode an X12 data element 623 code
 * @returns the offset, or `""` for any value that is not an offset code
 *
 * @example x12OffsetOf("27") // "+05:30"
 * @example x12OffsetOf("ET") // ""
 */
export function x12OffsetOf(timeCode: unknown): string {
  if (
    typeof timeCode !== "string" ||
    !Object.hasOwn(X12_TIME_CODE_OFFSET, timeCode)
  ) {
    return "";
  }
  return X12_TIME_CODE_OFFSET[timeCode as X12OffsetTimeCode];
}

/**
 * The core of `x12TimeCodeZone`: the named zone an X12 time code names.
 *
 * @param timeCode an X12 data element 623 code
 * @returns a copy of the zone, or `null` for any value that is not a zone-name code
 *
 * @example x12ZoneOf("ED") // { zone: "Eastern", daylight: true }
 * @example x12ZoneOf("27") // null
 */
export function x12ZoneOf(timeCode: unknown): X12NamedZone | null {
  if (
    typeof timeCode !== "string" ||
    !Object.hasOwn(X12_TIME_CODE_ZONE, timeCode)
  ) {
    return null;
  }
  // A copy, so a caller cannot change the table through a result.
  return { ...X12_TIME_CODE_ZONE[timeCode as X12ZoneTimeCode] };
}

/**
 * The core of `classifyX12TimeCode`: whether a code is an offset code or a zone-name code.
 *
 * @param timeCode an X12 data element 623 code
 * @returns the class, or `null` for any other value
 *
 * @example classifyX12TimeCodeOf("27") // { kind: "offset", timeCode: "27" }
 * @example classifyX12TimeCodeOf("XX") // null
 */
export function classifyX12TimeCodeOf(
  timeCode: string,
): X12TimeCodeClass | null {
  // Each reader owns the list of its codes and returns its sentinel for any other value, so a
  // code is an offset code exactly when the offset reader reads it.
  if (x12OffsetOf(timeCode) !== "") {
    return { kind: "offset", timeCode: timeCode as X12OffsetTimeCode };
  }
  if (x12ZoneOf(timeCode) !== null) {
    return { kind: "zone", timeCode: timeCode as X12ZoneTimeCode };
  }
  return null;
}
