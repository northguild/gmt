import { EDIFACT_DTM_FORMATS } from "../../internal";
import type { EdifactDtmFormat } from "../../types/edi";

/**
 * Return true when `formatQualifier` is a UN/EDIFACT data element 2379 format code that
 * `parseEdifactDtm` and `formatEdifactDtm` implement.
 *
 * - The 23 supported codes are `101`, `102` (a date); `201`, `202`, `203`, `204` (a date and time
 *   with no offset); `205`, `206`, `207`, `208` (a date and time with a `±HHMM` offset); `209` (a
 *   time with a `±HHMM` offset); `301`, `302`, `303`, `304` (a date and time with three zone
 *   characters); `401`, `402` (a time); `404` (a time with three zone characters); `406` (an
 *   offset alone); `713`, `717`, `718`, `719` (a period). `206`–`209` are in UNTDID directories
 *   D.12A and later.
 * - Every other 2379 code returns false. A partial value (a year, a month or a week alone)
 *   leaves the rest of the date unstated, a weekday period (`720`) names days of the week and no
 *   date, and a quantity (`801` and up) is an amount of time, not a point or a span on the
 *   calendar. The rest are forms GMT does not read: the day-first and month-first dates `2`–`5`,
 *   `10` (`CCYYMMDDTHHMM`), `103`, the ordinal date `105`, `210`, `307`, `308`, the time spans
 *   `501`–`503` and `711`.
 * - Matching is exact: `" 203"`, `"0203"` and the number `203` are not codes.
 * - Accepts any input type and returns false for non-string values.
 * - `parseEdifactDtm` returns null for a code it does not implement, the same sentinel it returns
 *   for a value that does not fit its code. Check the code here to tell an unsupported format
 *   apart from bad data.
 *
 * @param formatQualifier candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidEdifactDtmFormat("203") // true
 * @example isValidEdifactDtmFormat("718") // true
 * @example isValidEdifactDtmFormat("208") // true
 * @example isValidEdifactDtmFormat("602") // false (a partial value: not supported)
 * @example isValidEdifactDtmFormat("720") // false (a weekday period: not supported)
 * @example isValidEdifactDtmFormat("801") // false (a quantity: not supported)
 * @example isValidEdifactDtmFormat("0203") // false (matching is exact)
 * @example isValidEdifactDtmFormat(203) // false (a code is a string)
 * @example isValidEdifactDtmFormat(null) // false
 */
export function isValidEdifactDtmFormat(
  formatQualifier: unknown,
): formatQualifier is EdifactDtmFormat {
  return (
    typeof formatQualifier === "string" &&
    EDIFACT_DTM_FORMATS.includes(formatQualifier as EdifactDtmFormat)
  );
}
