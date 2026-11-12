// The three patterns below are the R4 `regex` extension (http://hl7.org/fhir/StructureDefinition/regex)
// on `.value` of the `date`, `dateTime` and `instant` StructureDefinitions
// (https://hl7.org/fhir/R4/<type>.profile.json), JSON-decoded, with `^` and `$` added as R4
// Datatypes §2.24.0.1 advises. They are published unchanged: no tightening, no named groups.

/**
 * RegExp matching a FHIR R4 `date`: the `regex` of the `date` StructureDefinition
 * (https://hl7.org/fhir/R4/date.profile.json), verbatim and anchored.
 *
 * - `YYYY`, `YYYY-MM` or `YYYY-MM-DD`, with no time and no zone (R4 Datatypes §2.24.0.1).
 * - FHIR published the grammar, so it is neither loosened nor tightened here: a four-digit year
 *   from `0001`, a two-digit month and day, no flags.
 * - Shape only. R4 calls its regexes informative: `2023-02-29` and `2024-04-31` match. To check
 *   that a string is a real FHIR `date`, use `isValidFHIR`.
 *
 * Capture groups: 1 year, 2 and 3 parts of the year (the nested groups of FHIR's year
 * alternation: `024` and `24` for 2024, `100` and `undefined` for `0100`, both `undefined` for
 * `1000`), 4 everything from the month's hyphen on (`-06-15` for `2024-06-15`; optional), 5 month,
 * 6 everything from the day's hyphen on (`-15`; optional), 7 day.
 *
 * @example fhirDate.test("2024-06-15")           // true
 * @example fhirDate.test("2024")                 // true (year precision)
 * @example fhirDate.test("2024-06-15T10:30:00Z") // false (a date carries no time)
 * @example fhirDate.test("0000-01-01")           // false (year 0000 is not in the pattern)
 * @example fhirDate.test("2023-02-29")           // true (shape only; the day does not exist)
 */
export const fhirDate: RegExp =
  /^([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)(-(0[1-9]|1[0-2])(-(0[1-9]|[1-2][0-9]|3[0-1]))?)?$/;

/**
 * RegExp matching a FHIR R4 `dateTime`: the `regex` of the `dateTime` StructureDefinition
 * (https://hl7.org/fhir/R4/datetime.profile.json), verbatim and anchored.
 *
 * - A year, a month, a day, or a day with a time. A time carries seconds (a second of `60` is
 *   in the pattern), an optional fraction of any length, and `Z` or an offset from `-14:00` to
 *   `+14:00`; a time with no zone does not match (R4 Datatypes §2.24.0.1).
 * - FHIR published the grammar, so it is neither loosened nor tightened here: upper-case `T` and
 *   `Z`, a colon in the offset, no `24:00`, `-00:00` accepted.
 * - Shape only. `2024-02-30` and `2017-12-31T23:59:60Z` match, and so does a fraction longer
 *   than nine digits. To check that a string is a real FHIR `dateTime`, use `isValidFHIR`.
 *
 * Capture groups: 1 year, 2 and 3 parts of the year (the nested groups of FHIR's year
 * alternation: `024` and `24` for 2024, `100` and `undefined` for `0100`, both `undefined` for
 * `1000`), 4 everything from the month's hyphen on (`-12-31T23:59:60Z`; optional), 5 month,
 * 6 everything from the day's hyphen on (`-31T23:59:60Z`; optional), 7 day, 8 the time part with
 * its `T` and the designator (`T23:59:60Z`; optional), 9 hour, 10 second, 11 fraction with its period (optional), 12 `Z`
 * or the offset, 13 sign, 14 hours-and-minutes or `14:00`, 15 offset hours (`undefined` for
 * `14:00`). The minute is not captured.
 *
 * @example fhirDateTime.test("2024-06")                      // true
 * @example fhirDateTime.test("2015-02-07T13:28:17.239+02:00") // true
 * @example fhirDateTime.test("2024-06-15T10:30:00")          // false (a time needs a zone)
 * @example fhirDateTime.test("2024-06-15T10:30Z")            // false (seconds are required)
 * @example fhirDateTime.test("2024-06-15T10:30:00+14:30")    // false (offset past 14:00)
 */
export const fhirDateTime: RegExp =
  /^([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)(-(0[1-9]|1[0-2])(-(0[1-9]|[1-2][0-9]|3[0-1])(T([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\.[0-9]+)?(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00)))?)?)?$/;

/**
 * RegExp matching a FHIR R4 `instant`: the `regex` of the `instant` StructureDefinition
 * (https://hl7.org/fhir/R4/instant.profile.json), verbatim and anchored.
 *
 * - A full date and a time to the second, an optional fraction of any length, then `Z` or an
 *   offset from `-14:00` to `+14:00` (R4 Datatypes §2.24.0.1).
 * - FHIR published the grammar, so it is neither loosened nor tightened here: upper-case `T` and
 *   `Z`, a colon in the offset, a second of `60` accepted, `-00:00` accepted.
 * - Shape only. `2017-12-31T23:59:60Z` (no leap second that day), `2024-02-30T00:00:00Z` and a
 *   ten-digit fraction all match. To check that a string is a real FHIR `instant`, use
 *   `isValidFHIR`.
 *
 * Capture groups: 1 year, 2 and 3 parts of the year (the nested groups of FHIR's year
 * alternation: `024` and `24` for 2024, `100` and `undefined` for `0100`, both `undefined` for
 * `1000`), 4 month, 5 day, 6 hour, 7 second, 8 fraction with its period (optional), 9 `Z` or
 * the offset, 10 sign, 11 hours-and-minutes or `14:00`, 12 offset hours (`undefined` for
 * `14:00`). The minute is not captured.
 *
 * @example fhirInstant.test("2015-02-07T13:28:17.239+02:00") // true
 * @example fhirInstant.test("2024-06-15T10:30:00Z")          // true
 * @example fhirInstant.test("2024-06-15")                    // false (an instant needs a time)
 * @example fhirInstant.test("2024-06-15T10:30:00")           // false (a zone is required)
 * @example fhirInstant.test("2024-06-15T10:30:00z")          // false (upper-case Z only)
 */
export const fhirInstant: RegExp =
  /^([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])T([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\.[0-9]+)?(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))$/;
