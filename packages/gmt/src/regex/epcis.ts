/**
 * RegExp matching a GS1 EPCIS 2.0 `eventTimeZoneOffset`: the `pattern` the EPCIS JSON schema
 * (https://ref.gs1.org/standards/epcis/epcis-json-schema.json, a normative artefact of EPCIS 2.0 /
 * ISO/IEC 19987) gives for the field, verbatim: `^([+]|[-])((0[0-9]|1[0-3]):([0-5][0-9])|14:00)$`.
 *
 * - The pattern is the JSON binding's. The XML binding's XSD types the same field as a bare
 *   `xsd:string` and gives no pattern.
 * - The rule both bindings carry is the standard's prose, EPCIS Standard Release 2.0 §7.4.1
 *   (https://ref.gs1.org/standards/epcis/): the value "SHALL be a string consisting of the
 *   character '+' or the character '-', followed by two digits whose value is within the range
 *   00 through 14 (inclusive), followed by a colon character ':', followed by two digits whose
 *   value is within the range 00 through 59 (inclusive), except that if the value of the first
 *   two digits is 14, the value of the second two digits must be 00." The pattern is that
 *   sentence as a regular expression.
 * - `±HH:MM` from `-13:59` through `+13:59`, plus `±14:00`. GS1 published the grammar, so it is
 *   neither loosened nor tightened here: `-14:00` matches because the sign group is independent
 *   of the `14:00` alternative, and `-00:00` matches.
 * - `Z` does not match: it is `eventTime`'s designator, and this field records the offset in
 *   force where the event happened. `+0200` (no colon) and `+02` (hours only) do not match.
 * - Shape only. `parseEpcisEvent` reads the value through Temporal, and returns `-00:00` as
 *   `+00:00`. To check a value that may not be a string, use `isValidEpcisTimeZoneOffset`: for a
 *   string it gives this pattern's answer.
 *
 * Capture groups: 1 sign, 2 the hours-and-minutes or `14:00`, 3 hours, 4 minutes (3 and 4 are
 * `undefined` for `14:00`).
 *
 * @example epcisTimeZoneOffset.test("-05:00") // true
 * @example epcisTimeZoneOffset.test("+14:00") // true
 * @example epcisTimeZoneOffset.test("+14:01") // false (past the range GS1 allows)
 * @example epcisTimeZoneOffset.test("Z")      // false (a designator, not an offset)
 * @example epcisTimeZoneOffset.test("+0200")  // false (no colon)
 */
export const epcisTimeZoneOffset: RegExp =
  /^([+]|[-])((0[0-9]|1[0-3]):([0-5][0-9])|14:00)$/;

/**
 * RegExp matching a GS1 EPCIS 2.0 `eventTime` (and `recordTime`): the `DateTimeStamp` pattern of
 * the EPCIS XSD (https://ref.gs1.org/standards/epcis/epcglobal-epcis-2_0.xsd, a normative
 * artefact of EPCIS 2.0 / ISO/IEC 19987), verbatim and anchored.
 *
 * - The pattern is the XML binding's. The JSON schema types the same field as a string with
 *   `format: date-time` and gives no pattern, so this is the stricter of the two bindings.
 * - A date-time with seconds required, an optional fraction of any length, then `Z` or an offset
 *   in the same range as `epcisTimeZoneOffset`.
 * - GS1 published the grammar, so it is neither loosened nor tightened here: four-digit years
 *   only, upper-case `T` and `Z`, a colon in the offset, no space separator.
 * - Shape only; calendar validity is Temporal's (`2023-02-29T00:00:00Z` matches and
 *   `Temporal.Instant.from` rejects it). To check that a string is a real `eventTime`, use
 *   `isValidEpcisEventTime`: this pattern also matches a day that does not exist and a fraction
 *   longer than nine digits.
 *
 * Capture groups: 1 year, 2 month, 3 day, 4 hour, 5 minute, 6 second, 7 fraction with its
 * period (optional), 8 `Z` or the offset, 9 the offset, 10 sign, 11 hours-and-minutes or
 * `14:00`, 12 hours, 13 minutes.
 *
 * @example epcisEventTime.test("2024-06-15T14:30:00Z")           // true
 * @example epcisEventTime.test("2024-06-15T14:30:00.123-05:00")  // true
 * @example epcisEventTime.test("2024-06-15T14:30Z")              // false (seconds are required)
 * @example epcisEventTime.test("2024-06-15T14:30:00")            // false (Z or an offset is required)
 * @example epcisEventTime.test("2024-06-15T14:30:00+15:00")      // false (offset past the range GS1 allows)
 */
export const epcisEventTime: RegExp =
  /^([0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\.[0-9]+)?(Z|(([+]|[-])((0[0-9]|1[0-3]):([0-5][0-9])|14:00)))$/;
