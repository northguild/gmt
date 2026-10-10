import { EDIFACT_DTM_FORMATS } from "../../internal";
import type { EdifactDtmFormat } from "../../types/edi";

/**
 * Return true when `format` is a UN/EDIFACT data element 2379 format code that the EDIFACT
 * functions read and write.
 *
 * - The 11 supported codes are `102` (a date); `401`, `402` (a time); `203`, `204` (a date and
 *   time with no offset); `205`, `208`, `303`, `304` (a date and time with an offset); `718` (a
 *   period of dates) and `719` (a period of date-times). `classifyEdifactDtmFormat` names the
 *   kind of a code, and each kind has its own parser, formatter and validator.
 * - A code with a two-digit year returns false: `101`, `201`, `202`, `206`, `207`, `301`,
 *   `302`, `713` and `717`. UN/EDIFACT does not say which century `YY` belongs to; read such a
 *   value with `parseDateWithPattern` or `parseDateTimeWithPattern`, a `yy` pattern and its
 *   `yearWindow` option.
 * - `209` and `404` (a time with an offset and no date) and `406` (an offset alone) return
 *   false: none names a date, a time, a date-time or an instant.
 * - Every other 2379 code returns false: the day-first and month-first dates `2`–`5`, `10`
 *   (`CCYYMMDDTHHMM`), `103`, the ordinal date `105`, `210`, `307`, `308`, the time spans
 *   `501`–`503`, `711`, the partial values, the weekday period `720` and the quantities (`801`
 *   and up).
 * - Matching is exact: `" 203"`, `"0203"` and the number `203` are not codes.
 * - Accepts any input type and returns false for non-string values.
 * - A parser returns its sentinel for a code it does not read, the same sentinel it returns for
 *   a value that does not fit its code. Check the code here to tell an unsupported format apart
 *   from bad data.
 *
 * @param format candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidEdifactDtmFormat("203") // true
 * @example isValidEdifactDtmFormat("718") // true
 * @example isValidEdifactDtmFormat("208") // true
 * @example isValidEdifactDtmFormat("101") // false (a two-digit year: not read)
 * @example isValidEdifactDtmFormat("602") // false (a partial value: not supported)
 * @example isValidEdifactDtmFormat("801") // false (a quantity: not supported)
 * @example isValidEdifactDtmFormat("0203") // false (matching is exact)
 * @example isValidEdifactDtmFormat(203) // false (a code is a string)
 * @example isValidEdifactDtmFormat(null) // false
 */
export function isValidEdifactDtmFormat(
  format: unknown,
): format is EdifactDtmFormat {
  return (
    typeof format === "string" &&
    EDIFACT_DTM_FORMATS.includes(format as EdifactDtmFormat)
  );
}
