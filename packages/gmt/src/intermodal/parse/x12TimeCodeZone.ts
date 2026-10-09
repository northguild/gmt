import type { X12NamedZone, X12ZoneTimeCode } from "../../types/edi";

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
 * Read the zone an X12 time code (data element 623) names.
 *
 * Data element 623 is the code beside the date (element 373) and time (element 337) of an X12
 * `AT7`, `G62` or `DTM` segment. 25 of its 56 codes name a zone and state no offset; this
 * function reads those. Codes are release 008010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-008010/element/623); the X12
 * text itself was not reached.
 *
 * ### Time codes that name a zone
 * | Codes | The dictionary's definition | `zone` |
 * |---|---|---|
 * | `AD`, `AS`, `AT` | "Alaska Daylight Time", "Alaska Standard Time", "Alaska Time" | `Alaska` |
 * | `CD`, `CS`, `CT` | "Central Daylight Time", "Central Standard Time", "Central Time" | `Central` |
 * | `ED`, `ES`, `ET` | "Eastern Daylight Time", "Eastern Standard Time", "Eastern Time" | `Eastern` |
 * | `HD`, `HS`, `HT` | "Hawaii-Aleutian Daylight Time", "Hawaii-Aleutian Standard Time", "Hawaii-Aleutian Time" | `Hawaii-Aleutian` |
 * | `MD`, `MS`, `MT` | "Mountain Daylight Time", "Mountain Standard Time", "Mountain Time" | `Mountain` |
 * | `ND`, `NS`, `NT` | "Newfoundland Daylight Time", "Newfoundland Standard Time", "Newfoundland Time" | `Newfoundland` |
 * | `PD`, `PS`, `PT` | "Pacific Daylight Time", "Pacific Standard Time", "Pacific Time" | `Pacific` |
 * | `TD`, `TS`, `TT` | "Atlantic Daylight Time", "Atlantic Standard Time", "Atlantic Time" | `Atlantic` |
 * | `LT` | "Local Time" | `Local` |
 *
 * - **The result is a zone name, not an offset.** X12 states no offset for these codes and GMT
 *   holds no registry of places, so the caller maps the name to an IANA zone. A caller might
 *   choose `America/New_York` for `Eastern`; the choice is the caller's. Resolve the local
 *   date-time in that zone with `resolveLocal`.
 * - **`daylight` is `true` for a `D` code, `false` for an `S` code and `null` for a `T` code**,
 *   which says neither: the date decides. Both members are always present.
 * - **`LT` is local to the event** and returns `{ zone: "Local", daylight: null }`. The place is
 *   elsewhere in the message, so the caller supplies its zone.
 * - **An offset code returns `null`**: `01`–`29`, `UT` and `GM` state an offset and name no
 *   zone. Read one with `x12TimeCodeOffset`.
 * - **`TS`, `TT`, `CD` and `MD` are codes of data element 1250 too**, with unrelated meanings:
 *   here they are Atlantic Standard, Atlantic, Central Daylight and Mountain Daylight Time;
 *   there `TS` is the format `HHMMSS`. Pass a time code here and a format qualifier to the
 *   `parseX12…` functions.
 * - **For a code that arrives as a string**, call `classifyX12TimeCode` first: its `"zone"`
 *   result carries the code narrowed to this function's parameter.
 * - Matching is exact: two characters, upper case, no padding. Each call returns a new object.
 *   Returns `null` for a code that is not one of the 56 and for a non-string.
 *
 * @param timeCode X12 data element 623 time code (e.g. "ES")
 * @returns `{ zone, daylight }`, or null on invalid input
 *
 * @example x12TimeCodeZone("ES") // { zone: "Eastern", daylight: false }
 * @example x12TimeCodeZone("ED") // { zone: "Eastern", daylight: true }
 * @example x12TimeCodeZone("ET") // { zone: "Eastern", daylight: null } (the date decides)
 * @example x12TimeCodeZone("PD") // { zone: "Pacific", daylight: true }
 * @example x12TimeCodeZone("TS") // { zone: "Atlantic", daylight: false }
 * @example x12TimeCodeZone("LT") // { zone: "Local", daylight: null } (the place is elsewhere in the message)
 * @example x12TimeCodeZone("UT") // null (an offset code: use x12TimeCodeOffset)
 * @example x12TimeCodeZone("20") // null (an offset code)
 * @example x12TimeCodeZone("EST") // null (not a 623 code)
 * @example x12TimeCodeZone("et") // null (matching is exact)
 */
export function x12TimeCodeZone(
  timeCode: X12ZoneTimeCode,
): X12NamedZone | null {
  if (
    typeof timeCode !== "string" ||
    !Object.hasOwn(X12_TIME_CODE_ZONE, timeCode)
  ) {
    return null;
  }
  // A copy, so a caller cannot change the table through a result.
  return { ...X12_TIME_CODE_ZONE[timeCode] };
}
