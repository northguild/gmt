import { parseUtcOffsetNanoseconds } from "../../internal";
import { epcisTimeZoneOffset } from "../../regex";

/**
 * Return true when `value` is a GS1 EPCIS 2.0 `eventTimeZoneOffset`: the UTC offset the local
 * clock ran at where a supply-chain event happened, written `±HH:MM`.
 *
 * EPCIS (ISO/IEC 19987) is GS1's event standard for supply-chain visibility. This is the check
 * `isValidEpcisEvent` applies to the event's `eventTimeZoneOffset` field: that validator calls
 * this one.
 *
 * - The value must match `epcisTimeZoneOffset`, the pattern the EPCIS JSON schema gives: `±HH:MM`
 *   from `-14:00` to `+14:00`, the rule of EPCIS Standard Release 2.0 §7.4.1
 *   (https://ref.gs1.org/standards/epcis/).
 * - **The pattern is the whole rule for a string.** Every value it matches is an offset Temporal
 *   reads, so this validator and `epcisTimeZoneOffset.test` agree on every string; the validator
 *   adds only the answer false for a non-string.
 * - `Z`, `+0200`, `+02`, an offset with seconds and an offset past `14:00` are false.
 * - `-00:00` is true: the GS1 pattern matches it. `parseEpcisEvent` returns it as `+00:00`.
 * - It need not agree with an offset written in the event's `eventTime`. Check that field with
 *   `isValidEpcisEventTime`, or both with `isValidEpcisEvent`.
 *
 * @param value candidate EPCIS `eventTimeZoneOffset` string
 * @returns boolean indicating validity
 *
 * @example isValidEpcisTimeZoneOffset("-05:00") // true
 * @example isValidEpcisTimeZoneOffset("+14:00") // true
 * @example isValidEpcisTimeZoneOffset("+14:01") // false (past the range GS1 allows)
 * @example isValidEpcisTimeZoneOffset("Z") // false (a designator, not an offset)
 * @example isValidEpcisTimeZoneOffset("+0200") // false (no colon)
 * @example isValidEpcisTimeZoneOffset("+05:30:00") // false (seconds)
 */
export function isValidEpcisTimeZoneOffset(value: string): boolean {
  // `parseEpcisEvent` reads the offset through Temporal after the pattern, so this does too. No
  // string the pattern matches fails that read: it is here so the two cannot drift.
  return (
    typeof value === "string" &&
    epcisTimeZoneOffset.test(value) &&
    parseUtcOffsetNanoseconds(value) !== null
  );
}
