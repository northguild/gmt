import { parseHL7 } from "../parse/parseHL7";

/**
 * Return true when `value` is an HL7 v2 `DTM`, or a `TS` with a degree of precision the digits
 * carry, that `parseHL7` reads.
 *
 * HL7 v2.5.1 2.A.22 (headed 2.A.1.22 in the hl7.eu v2.5.1 copy) defines the `DTM`
 * `YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ]`; 2.A.77 the `TS`.
 *
 * - True exactly when `parseHL7` returns a reading: the validator calls the parser, so the two
 *   cannot disagree.
 * - The null value `'""'` (two double quote marks) is valid, because ch. 2 §2.5.3 makes it a
 *   value that clears the stored one; `''` is not.
 * - A valid value is not necessarily an instant: `parseHL7` reads a value at a minute or finer
 *   with no offset as `"local"`, one at year to hour precision as `"partial"` (with or without
 *   an offset), and `'""'` as `"null"`.
 * - Components are read as `parseHL7` reads them: `^` and `&` are the separators (ch. 2
 *   §2.5.4), and components and subcomponents that are present but not expected are ignored
 *   (§2.6.2), so `20240615^D^X` and `2024&X` are valid, while `&X` is not.
 * - No public regex exists: a `DTM` is valid only as a whole (calendar, clock, offset and
 *   degree of precision together), which a pattern alone cannot check.
 * - False for a value that is not a string. Never throws.
 *
 * @param value HL7 v2 `DTM` or `TS` string
 * @returns boolean indicating validity
 *
 * @example isValidHL7("20240615103000-0500") // true
 * @example isValidHL7("2024") // true
 * @example isValidHL7('""') // true (the null value)
 * @example isValidHL7("20240615^D^X") // true (the third component is ignored)
 * @example isValidHL7("20240615^S") // false (a degree finer than the digits)
 * @example isValidHL7("20240230") // false (30 February)
 * @example isValidHL7("") // false (not the null value)
 */
export function isValidHL7(value: string): boolean {
  return parseHL7(value) !== null;
}
