import { fhirDate, fhirDateTime, fhirInstant } from "../../regex";
import { fhirTypeAllows } from "../../internal/fhirDateTime";
import { FHIR_PARSE_ROWS, FHIR_REJECT_ROWS } from "../../test/fhirRows";
import { arrives, NON_STRINGS } from "../../test/nonStrings";
import type { FhirDateType } from "../../types";
import { parseFHIR } from "../parse/parseFHIR";
import { isValidFHIR } from "./isValidFHIR";

const TYPES: FhirDateType[] = ["date", "dateTime", "instant"];
const TYPE_ROWS = TYPES.map((type) => ({ type }));
const PATTERNS = {
  date: fhirDate,
  dateTime: fhirDateTime,
  instant: fhirInstant,
};

/**
 * FHIR R4 Datatypes §2.24.0.1. Each verdict follows from the prose and the R4 regexes: a `date`
 * has no time, an `instant` is at least to the second, a time needs a zone, and the calendar,
 * `24:00`, the leap-second table and the nine-digit fraction limit are checked beyond the shape.
 */
describe("isValidFHIR", () => {
  it.each`
    value                          | type          | expected | reason
    ${"2024-06-15T10"}             | ${"dateTime"} | ${false} | ${"an hour with no minutes"}
    ${"2024-06-15T10:30"}          | ${"dateTime"} | ${false} | ${"no seconds"}
    ${"2024-06-15T10:30:00"}       | ${"dateTime"} | ${false} | ${"a time with no zone"}
    ${"2024-06-15T10:30:00Z"}      | ${"instant"}  | ${true}  | ${"a second with Z"}
    ${"2024-06-15"}                | ${"instant"}  | ${false} | ${"an instant is a second or finer"}
    ${"2024-06-15T10:30:00Z"}      | ${"date"}     | ${false} | ${"a date has no time"}
    ${"2024-6-15"}                 | ${"date"}     | ${false} | ${"the month is not padded"}
    ${"2016-12-31T23:59:60Z"}      | ${"instant"}  | ${true}  | ${"an inserted leap second"}
    ${"2017-12-31T23:59:60Z"}      | ${"instant"}  | ${false} | ${"no insertion that day"}
    ${"2024-06-15T10:30:00+14:30"} | ${"dateTime"} | ${false} | ${"past +14:00"}
    ${"0000-01-01"}                | ${"dateTime"} | ${false} | ${"year 0000"}
    ${"2024-02-30"}                | ${"dateTime"} | ${false} | ${"an invalid date"}
    ${"2024-06-15T24:00:00Z"}      | ${"dateTime"} | ${false} | ${"24:00"}
    ${"2024"}                      | ${"Date"}     | ${false} | ${"type names are case-sensitive"}
    ${"2024"}                      | ${undefined}  | ${false} | ${"no type"}
    ${"2024"}                      | ${"toString"} | ${false} | ${"an inherited key is not a type"}
  `(
    "returns $expected for '$value' as $type ($reason)",
    ({ value, type, expected }) => {
      expect(isValidFHIR(value, type)).toBe(expected);
    },
  );

  it.each`
    value                                | date     | dateTime | instant
    ${"2024"}                            | ${true}  | ${true}  | ${false}
    ${"2024-06"}                         | ${true}  | ${true}  | ${false}
    ${"2024-06-15"}                      | ${true}  | ${true}  | ${false}
    ${"2024-06-15T10:30:00-05:00"}       | ${false} | ${true}  | ${true}
    ${"2024-06-15T10:30:00.5-05:00"}     | ${false} | ${true}  | ${true}
    ${"2024-06-15T10:30:00.123456789Z"}  | ${false} | ${true}  | ${true}
    ${"2024-06-15T10:30:00.1234567890Z"} | ${false} | ${false} | ${false}
    ${"2024-06-15T10:30:00"}             | ${false} | ${false} | ${false}
    ${"2024-06-15T10:30:00.5"}           | ${false} | ${false} | ${false}
    ${"2024-06-15T10:30Z"}               | ${false} | ${false} | ${false}
    ${"2024-06-15Z"}                     | ${false} | ${false} | ${false}
  `(
    "reads '$value' as date $date, dateTime $dateTime and instant $instant",
    ({ value, date, dateTime, instant }) => {
      expect(isValidFHIR(value, "date")).toBe(date);
      expect(isValidFHIR(value, "dateTime")).toBe(dateTime);
      expect(isValidFHIR(value, "instant")).toBe(instant);
    },
  );

  it.each(TYPE_ROWS)(
    "returns false for every value that is not a string as $type",
    ({ type }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(isValidFHIR(make(), type), kind).toBe(false);
      }
    },
  );

  it.each(TYPE_ROWS)(
    "returns false for 20240615 and null as $type",
    ({ type }) => {
      expect(isValidFHIR(arrives(20240615), type)).toBe(false);
      expect(isValidFHIR(arrives(null), type)).toBe(false);
    },
  );

  // IERS Bulletin C: the 27 inserted leap seconds, 30 June 1972 to 31 December 2016.
  const INSERTED = [
    "1972-06-30",
    "1972-12-31",
    "1973-12-31",
    "1974-12-31",
    "1975-12-31",
    "1976-12-31",
    "1977-12-31",
    "1978-12-31",
    "1979-12-31",
    "1981-06-30",
    "1982-06-30",
    "1983-06-30",
    "1985-06-30",
    "1987-12-31",
    "1989-12-31",
    "1990-12-31",
    "1992-06-30",
    "1993-06-30",
    "1994-06-30",
    "1995-12-31",
    "1997-06-30",
    "1998-12-31",
    "2005-12-31",
    "2008-12-31",
    "2012-06-30",
    "2015-06-30",
    "2016-12-31",
  ].map((day) => ({ day }));
  const NOT_INSERTED = [
    "1972-12-30",
    "1980-12-31",
    "1981-12-31",
    "1984-06-30",
    "1999-12-31",
    "2006-06-30",
    "2016-06-30",
    "2017-06-30",
    "2018-12-31",
    "2024-06-30",
    "2024-12-31",
    "2100-12-31",
  ].map((day) => ({ day }));

  describe("leap seconds", () => {
    it.each(INSERTED)(
      "accepts a second of 60 at the end of $day as dateTime and instant, never as date",
      ({ day }) => {
        for (const value of [
          `${day}T23:59:60Z`,
          `${day}T23:59:60-00:00`,
          `${day}T23:59:60.5Z`,
          `${day}T23:59:60.999999999Z`,
        ]) {
          expect(isValidFHIR(value, "dateTime"), value).toBe(true);
          expect(isValidFHIR(value, "instant"), value).toBe(true);
          expect(isValidFHIR(value, "date"), value).toBe(false);
        }
      },
    );

    it.each(NOT_INSERTED)(
      "refuses a second of 60 at the end of $day as every type",
      ({ day }) => {
        for (const type of TYPES) {
          expect(isValidFHIR(`${day}T23:59:60Z`, type), type).toBe(false);
          expect(isValidFHIR(`${day}T23:59:60.5Z`, type), type).toBe(false);
        }
      },
    );

    it.each`
      value                          | expected | reason
      ${"2016-12-31T23:59:59Z"}      | ${true}  | ${"the second before the insertion"}
      ${"2017-01-01T00:00:00Z"}      | ${true}  | ${"the second after the insertion"}
      ${"2016-12-31T23:59:60+00:00"} | ${true}  | ${"+00:00 spells the same zone as Z"}
      ${"2016-12-31T23:59:60+00:01"} | ${false} | ${"UTC is 23:58:60"}
      ${"2016-12-31T23:59:60-00:01"} | ${false} | ${"UTC is 00:00:60 on 1 January"}
      ${"2017-01-01T00:59:60+01:00"} | ${true}  | ${"UTC is 23:59:60 on 31 December"}
      ${"2016-12-31T23:59:60.5Z"}    | ${true}  | ${"inside the inserted second"}
      ${"2016-12-31T23:59:60"}       | ${false} | ${"no zone"}
    `(
      "returns $expected for '$value' as instant and as dateTime ($reason)",
      ({ value, expected }) => {
        expect(isValidFHIR(value, "instant")).toBe(expected);
        expect(isValidFHIR(value, "dateTime")).toBe(expected);
      },
    );
  });

  describe("agreement with parseFHIR", () => {
    it.each(FHIR_PARSE_ROWS)(
      "agrees with the precision of '$input' under every type",
      ({ input, expected }) => {
        for (const type of TYPES) {
          expect(isValidFHIR(input, type), type).toBe(
            fhirTypeAllows(type, expected.precision),
          );
        }
        expect(isValidFHIR(input, "dateTime")).toBe(parseFHIR(input) !== null);
      },
    );

    it.each(FHIR_REJECT_ROWS)(
      "refuses '$input' as every type ($reason)",
      ({ input }) => {
        for (const type of TYPES) {
          expect(isValidFHIR(input, type), type).toBe(false);
        }
      },
    );
  });

  describe("shape only: the pattern accepts, the validator refuses", () => {
    it.each`
      value                                | type          | reason
      ${"2024-02-30"}                      | ${"dateTime"} | ${"30 February"}
      ${"2023-02-29"}                      | ${"date"}     | ${"2023 has no 29 February"}
      ${"2017-12-31T23:59:60Z"}            | ${"instant"}  | ${"no leap second that day"}
      ${"2024-06-15T10:30:00.1234567890Z"} | ${"instant"}  | ${"a ten-digit fraction"}
      ${"2017-12-31T23:59:60Z"}            | ${"dateTime"} | ${"no leap second that day"}
      ${"2024-06-15T10:30:00.1234567890Z"} | ${"dateTime"} | ${"a ten-digit fraction"}
      ${"2024-04-31"}                      | ${"dateTime"} | ${"April has 30 days"}
      ${"2024-02-30"}                      | ${"date"}     | ${"30 February"}
    `(
      "the $type pattern matches '$value' but it is invalid ($reason)",
      ({ value, type }: { value: string; type: FhirDateType }) => {
        expect(PATTERNS[type].test(value)).toBe(true);
        expect(isValidFHIR(value, type)).toBe(false);
      },
    );
  });

  describe("a valid string matches the pattern", () => {
    it.each(FHIR_PARSE_ROWS)(
      "matches the pattern of every type that accepts '$input'",
      ({ input }) => {
        for (const type of TYPES) {
          if (isValidFHIR(input, type)) {
            expect(PATTERNS[type].test(input), type).toBe(true);
          }
        }
      },
    );
  });

  describe("type guard", () => {
    it("narrows a value typed unknown to string when it is valid", () => {
      const input = arrives("2024");
      if (isValidFHIR(input, "date")) {
        expectTypeOf(input).toEqualTypeOf<string>();
      } else {
        expectTypeOf(input).toEqualTypeOf<unknown>();
      }
      expect(isValidFHIR(input, "date")).toBe(true);
    });

    it("returns boolean, with no narrowing, for a value already typed as a non-string", () => {
      expectTypeOf(isValidFHIR(20240615, "date")).toEqualTypeOf<boolean>();
      expectTypeOf(isValidFHIR("2024", "instant")).toEqualTypeOf<boolean>();
    });

    it("keeps a string a string when it is not valid", () => {
      const input: string = "nope";
      if (!isValidFHIR(input, "date")) {
        expectTypeOf(input).toEqualTypeOf<string>();
      }
      expect(isValidFHIR(input, "date")).toBe(false);
    });
  });
});
