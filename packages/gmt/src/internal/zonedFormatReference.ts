import { isValidUtc } from "../utc/validate/isValidUtc";
import { isValidZonedDateTime } from "../zoned/validate/isValidZonedDateTime";

/**
 * Whether the `reference` option of the zoned formatters can be read: omitted (`undefined`), a
 * zoned or UTC ISO string, or a finite epoch in milliseconds. Any other type — a boolean (which
 * ToNumber would read as epoch 1 or 0), `null`, an object or a bigint — is invalid input.
 *
 * @param reference the option as given
 * @returns false for a string of neither form, a non-finite number, or a value of another type
 * @example isValidZonedFormatReference("2024-03-15T09:00:00-04:00[America/New_York]") // true
 * @example isValidZonedFormatReference("2024-03-15T13:00:00Z") // true
 * @example isValidZonedFormatReference(undefined) // true
 * @example isValidZonedFormatReference(Number.NaN) // false
 * @example isValidZonedFormatReference("2024-03-15") // false
 * @example isValidZonedFormatReference(true) // false
 */
export function isValidZonedFormatReference(reference: unknown): boolean {
  if (reference === undefined) return true;
  if (typeof reference === "string") {
    return isValidZonedDateTime(reference) || isValidUtc(reference);
  }
  return typeof reference === "number" && Number.isFinite(reference);
}
