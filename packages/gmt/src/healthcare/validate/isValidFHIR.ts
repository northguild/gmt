import { fhirTypeAllows, readFhirValue } from "../../internal";
import type { FhirDateType } from "../../types";

/**
 * Return true when `value` is a real FHIR R4 `date`, `dateTime` or `instant`, as `type` names.
 *
 * FHIR R4 (v4.0.1) Datatypes §2.24.0.1 defines the three types. The check reads the value with the
 * reader `parseFHIR` uses, so `isValidFHIR(v, "dateTime")` is true exactly when `parseFHIR(v)`
 * returns a value.
 *
 * - The type adds a precision rule to one grammar: `date` takes a day or coarser, `instant` takes
 *   a second or finer, and `dateTime` takes all five precisions.
 * - The R4 regexes (`fhirDate`, `fhirDateTime`, `fhirInstant`) are shape only. They accept 30
 *   February, a second of `60` on any day and a fraction of any length; this validator refuses
 *   all three. A second of `60` is valid only on an inserted leap second, and a fraction holds at
 *   most nine digits (**GMT rules**).
 * - A time with no zone is invalid as every type, unlike HL7 v2. `24:00` and an offset past
 *   `±14:00` are invalid.
 * - A type name is case-sensitive; an unknown `type` returns false.
 * - A value that is not a string, a `String` object included, returns false. Never throws. A true
 *   result narrows an `unknown` value to `string`.
 *
 * @param value any value; a string is checked as a FHIR date type
 * @param type `"date"`, `"dateTime"` or `"instant"`
 * @returns boolean indicating validity
 *
 * @example isValidFHIR("2024-06", "date") // true
 * @example isValidFHIR("2024-06-15T10:30:00-05:00", "dateTime") // true
 * @example isValidFHIR("2016-12-31T23:59:60Z", "instant") // true (an inserted leap second)
 * @example isValidFHIR("2024-06-15", "instant") // false (an instant is a second or finer)
 * @example isValidFHIR("2024-06-15T10:30:00", "dateTime") // false (a time needs a zone)
 * @example isValidFHIR("2024-02-30", "date") // false (30 February; the fhirDate pattern matches it)
 * @example isValidFHIR(20240615, "date") // false (not a string)
 */
export function isValidFHIR(value: string, type: FhirDateType): boolean;
export function isValidFHIR(
  value: {} | null | undefined | void,
  type: FhirDateType,
): boolean;
export function isValidFHIR(
  value: unknown,
  type: FhirDateType,
): value is string;
export function isValidFHIR(value: unknown, type: FhirDateType): boolean {
  try {
    const read = readFhirValue(value);
    return read !== null && fhirTypeAllows(type, read.precision);
  } catch {
    // Never throws (Core Rule 3)
    return false;
  }
}
