import * as fhir from "./fhir";
import { fhirDate, fhirDateTime, fhirInstant } from "./fhir";
import * as regex from "./index";

// FHIR R4 (v4.0.1) `date`, `dateTime` and `instant`. Each pattern is the `regex` extension on the
// StructureDefinition's `.value` (https://hl7.org/fhir/R4/<type>.profile.json), JSON-decoded, with
// only `^` and `$` added. The copies below are the decoded strings, kept verbatim.

const DATE_SOURCE = String.raw`([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)(-(0[1-9]|1[0-2])(-(0[1-9]|[1-2][0-9]|3[0-1]))?)?`;
const DATE_TIME_SOURCE = String.raw`([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)(-(0[1-9]|1[0-2])(-(0[1-9]|[1-2][0-9]|3[0-1])(T([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\.[0-9]+)?(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00)))?)?)?`;
const INSTANT_SOURCE = String.raw`([0-9]([0-9]([0-9][1-9]|[1-9]0)|[1-9]00)|[1-9]000)-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])T([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\.[0-9]+)?(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))`;

describe("regex/fhir source", () => {
  it.each`
    name              | pattern         | copy
    ${"fhirDate"}     | ${fhirDate}     | ${DATE_SOURCE}
    ${"fhirDateTime"} | ${fhirDateTime} | ${DATE_TIME_SOURCE}
    ${"fhirInstant"}  | ${fhirInstant}  | ${INSTANT_SOURCE}
  `(
    "$name is the R4 regex between ^ and $, with no flags",
    ({ pattern, copy }) => {
      expect(pattern.source).toBe(`^${copy}$`);
      expect(pattern.flags).toBe("");
    },
  );
});

describe("regex/fhir the story's pattern rows", () => {
  it.each`
    name              | pattern         | value                              | expected | reason
    ${"fhirDateTime"} | ${fhirDateTime} | ${"2024-06"}                       | ${true}  | ${"a month is a dateTime"}
    ${"fhirInstant"}  | ${fhirInstant}  | ${"2015-02-07T13:28:17.239+02:00"} | ${true}  | ${"the R4 instant example"}
    ${"fhirDateTime"} | ${fhirDateTime} | ${"2017-01-01T00:00:00.000+02:00"} | ${true}  | ${"a dateTime with fraction and offset"}
    ${"fhirDate"}     | ${fhirDate}     | ${"2024-06-15T10:30:00Z"}          | ${false} | ${"a date carries no time"}
    ${"fhirInstant"}  | ${fhirInstant}  | ${"2024-06-15"}                    | ${false} | ${"an instant needs a time"}
    ${"fhirDateTime"} | ${fhirDateTime} | ${"2024-06-15T10:30:00"}           | ${false} | ${"there is no zone"}
  `(
    "$name matches '$value' as $expected ($reason)",
    ({ pattern, value, expected }) => {
      expect(pattern.test(value)).toBe(expected);
    },
  );
});

describe("regex/fhir shape-only rows", () => {
  it.each`
    name              | pattern         | value                                | reason
    ${"fhirDateTime"} | ${fhirDateTime} | ${"2024-02-30"}                      | ${"a day that does not exist"}
    ${"fhirInstant"}  | ${fhirInstant}  | ${"2017-12-31T23:59:60Z"}            | ${"a second of 60 on a day with no leap second"}
    ${"fhirInstant"}  | ${fhirInstant}  | ${"2024-06-15T10:30:00.1234567890Z"} | ${"a ten-digit fraction"}
    ${"fhirDate"}     | ${fhirDate}     | ${"2023-02-29"}                      | ${"29 February in a common year"}
  `(
    "$name matches '$value' though FHIR does not allow it ($reason)",
    ({ pattern, value }) => {
      expect(pattern.test(value)).toBe(true);
    },
  );
});

describe("regex/fhir boundary rows", () => {
  it.each`
    value                          | date     | dateTime | instant  | reason
    ${"2024"}                      | ${true}  | ${true}  | ${false} | ${"year precision"}
    ${"0001"}                      | ${true}  | ${true}  | ${false} | ${"smallest year the pattern allows"}
    ${"0000-01-01"}                | ${false} | ${false} | ${false} | ${"the year alternation excludes 0000"}
    ${"2024-6-15"}                 | ${false} | ${false} | ${false} | ${"a month is two digits"}
    ${"2024-06-15T10:30Z"}         | ${false} | ${false} | ${false} | ${"seconds are required"}
    ${"2024-06-15T24:00:00Z"}      | ${false} | ${false} | ${false} | ${"hour is 2[0-3]"}
    ${"2024-06-15T10:30:00+14:00"} | ${false} | ${true}  | ${true}  | ${"the widest offset"}
    ${"2024-06-15T10:30:00-14:00"} | ${false} | ${true}  | ${true}  | ${"the widest offset, west"}
    ${"2024-06-15T10:30:00+14:30"} | ${false} | ${false} | ${false} | ${"past 14:00"}
    ${"2024-06-15T10:30:00-00:00"} | ${false} | ${true}  | ${true}  | ${"-00:00 is in the pattern"}
    ${"2024-06-15T10:30:00z"}      | ${false} | ${false} | ${false} | ${"upper-case Z only"}
    ${"2024-06-15t10:30:00Z"}      | ${false} | ${false} | ${false} | ${"upper-case T only"}
    ${"2024-06-15T10:30:00+0200"}  | ${false} | ${false} | ${false} | ${"extended offset only"}
    ${" 2024-06-15"}               | ${false} | ${false} | ${false} | ${"anchored at the start"}
    ${"2024-06-15\n"}              | ${false} | ${false} | ${false} | ${"$ without the m flag does not match before a trailing newline"}
    ${"0010"}                      | ${true}  | ${true}  | ${false} | ${"year 0010 is in the pattern (third alternation branch)"}
    ${"1000"}                      | ${true}  | ${true}  | ${false} | ${"year 1000 is in the pattern (fourth alternation branch)"}
    ${"2024-13"}                   | ${false} | ${false} | ${false} | ${"month 13 is past 1[0-2]"}
    ${"2024-00"}                   | ${false} | ${false} | ${false} | ${"month 00 is not 0[1-9]"}
    ${"2024-06-00"}                | ${false} | ${false} | ${false} | ${"day 00 is not in the pattern"}
    ${"2024-06-32"}                | ${false} | ${false} | ${false} | ${"day 32 is past 3[0-1]"}
    ${"2024-06-31"}                | ${true}  | ${true}  | ${false} | ${"day 31 of a 30-day month is shape only"}
    ${"2024-06-15T23:59:59Z"}      | ${false} | ${true}  | ${true}  | ${"the last second of the day"}
    ${"2024-06-15T10:30:60Z"}      | ${false} | ${true}  | ${true}  | ${"second 60 is in the pattern"}
    ${"2024-06-15T10:30:61Z"}      | ${false} | ${false} | ${false} | ${"second 61 is past 60"}
    ${"2024-06-15T10:60:00Z"}      | ${false} | ${false} | ${false} | ${"minute 60 is past [0-5][0-9]"}
    ${"2024-06-15T10:30:00.5Z"}    | ${false} | ${true}  | ${true}  | ${"a one-digit fraction"}
    ${"2024-06-15T10:30:00.Z"}     | ${false} | ${false} | ${false} | ${"a period needs a digit"}
    ${"2024-06-15T10:30:00+13:59"} | ${false} | ${true}  | ${true}  | ${"the last offset before 14:00"}
    ${"2024-06-15T10:30:00+14:01"} | ${false} | ${false} | ${false} | ${"14 hours allows only :00"}
    ${"2024-06-15T10:30:00+00:00"} | ${false} | ${true}  | ${true}  | ${"a zero offset written as +00:00"}
    ${"2024-06-15T"}               | ${false} | ${false} | ${false} | ${"a T needs a time after it"}
    ${"2024-06T10:30:00Z"}         | ${false} | ${false} | ${false} | ${"a time needs a day"}
    ${"2024-06-15 10:30:00Z"}      | ${false} | ${false} | ${false} | ${"a space is not T"}
    ${"2024-06-15T10:30:00Z "}     | ${false} | ${false} | ${false} | ${"anchored at the end"}
    ${"20240615"}                  | ${false} | ${false} | ${false} | ${"basic format is not FHIR"}
    ${""}                          | ${false} | ${false} | ${false} | ${"empty string"}
  `(
    "matches '$value': date $date, dateTime $dateTime, instant $instant ($reason)",
    ({ value, date, dateTime, instant }) => {
      expect(fhirDate.test(value)).toBe(date);
      expect(fhirDateTime.test(value)).toBe(dateTime);
      expect(fhirInstant.test(value)).toBe(instant);
    },
  );
});

describe("regex/fhir capture groups", () => {
  // Groups 2 and 3 are the nested groups of the year alternation, not fields of the value.
  it("fhirDate captures the year, its two nested parts, then month and day", () => {
    expect(fhirDate.exec("2024-06-15")?.slice(1)).toEqual([
      "2024",
      "024",
      "24",
      "-06-15",
      "06",
      "-15",
      "15",
    ]);
  });

  it("fhirDateTime captures the year, its two nested parts, date, time, fraction and offset", () => {
    expect(fhirDateTime.exec("2024-06-15T10:30:45.5-05:00")?.slice(1)).toEqual([
      "2024",
      "024",
      "24",
      "-06-15T10:30:45.5-05:00",
      "06",
      "-15T10:30:45.5-05:00",
      "15",
      "T10:30:45.5-05:00",
      "10",
      "45",
      ".5",
      "-05:00",
      "-",
      "05:00",
      "05",
    ]);
  });

  it("fhirDateTime leaves the offset hours undefined for +14:00", () => {
    expect(fhirDateTime.exec("2024-06-15T10:30:45+14:00")?.slice(11)).toEqual([
      undefined,
      "+14:00",
      "+",
      "14:00",
      undefined,
    ]);
  });

  it("fhirInstant captures the year, its two nested parts, then each field to the offset", () => {
    expect(fhirInstant.exec("2024-06-15T10:30:45.5-05:00")?.slice(1)).toEqual([
      "2024",
      "024",
      "24",
      "06",
      "15",
      "10",
      "45",
      ".5",
      "-05:00",
      "-",
      "05:00",
      "05",
    ]);
  });
});

describe("regex/fhir barrel", () => {
  it.each`
    name              | pattern
    ${"fhirDate"}     | ${fhirDate}
    ${"fhirDateTime"} | ${fhirDateTime}
    ${"fhirInstant"}  | ${fhirInstant}
  `("exports $name from the regex barrel", ({ name, pattern }) => {
    expect((regex as Record<string, unknown>)[name]).toBe(pattern);
  });

  it("exports exactly the three FHIR patterns from regex/fhir", () => {
    const patterns = Object.entries(fhir)
      .filter(([, value]) => value instanceof RegExp)
      .map(([name]) => name)
      .sort();
    expect(patterns).toEqual(["fhirDate", "fhirDateTime", "fhirInstant"]);
  });
});
