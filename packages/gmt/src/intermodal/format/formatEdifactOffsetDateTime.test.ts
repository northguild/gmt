import { vi } from "vitest";
import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseEdifactOffsetDateTime } from "../parse/parseEdifactOffsetDateTime";
import { formatEdifactOffsetDateTime } from "./formatEdifactOffsetDateTime";

/**
 * Every expected value is the ISO 8601 input placed under the UNTDID 2379 mask by hand: the
 * digits of its own wall clock, then its offset as `ZHHMM` (sign, hours, minutes) or as `ZZZ`
 * (the signed hour). What the mask has no field for is left out, never rounded.
 */
describe("formatEdifactOffsetDateTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("205, 208, 303 and 304 write the value's own wall clock and offset", () => {
    // `readsBack` is the value cut to the mask's smallest field, which the parser returns.
    it.each`
      code     | value                                    | expected                 | readsBack                      | reads
      ${"205"} | ${"2024-06-15T14:30:00+02:00"}           | ${"202406151430+0200"}   | ${"2024-06-15T14:30:00+02:00"} | ${"minutes and ZHHMM"}
      ${"208"} | ${"2024-06-15T14:30:45+02:00"}           | ${"20240615143045+0200"} | ${"2024-06-15T14:30:45+02:00"} | ${"seconds and ZHHMM"}
      ${"303"} | ${"2024-06-15T14:30:00+02:00"}           | ${"202406151430+02"}     | ${"2024-06-15T14:30:00+02:00"} | ${"minutes and a signed hour"}
      ${"304"} | ${"2024-06-15T14:30:45-05:00"}           | ${"20240615143045-05"}   | ${"2024-06-15T14:30:45-05:00"} | ${"seconds and a signed hour"}
      ${"205"} | ${"2024-06-15T14:30:45+02:00"}           | ${"202406151430+0200"}   | ${"2024-06-15T14:30:00+02:00"} | ${"seconds are dropped: the mask has none"}
      ${"303"} | ${"2024-06-15T14:30:59.9+02:00"}         | ${"202406151430+02"}     | ${"2024-06-15T14:30:00+02:00"} | ${"59.9 seconds stay in minute 30"}
      ${"208"} | ${"2024-06-15T14:30:45.9+02:00"}         | ${"20240615143045+0200"} | ${"2024-06-15T14:30:45+02:00"} | ${"0.9 of a second is dropped, not rounded up"}
      ${"304"} | ${"2024-06-15T14:30:45.123+02:00"}       | ${"20240615143045+02"}   | ${"2024-06-15T14:30:45+02:00"} | ${"a fraction of a second is dropped"}
      ${"205"} | ${"2024-06-15T14:30+02:00"}              | ${"202406151430+0200"}   | ${"2024-06-15T14:30:00+02:00"} | ${"no seconds given"}
      ${"205"} | ${"2024-06-15T14:30:00Z"}                | ${"202406151430+0000"}   | ${"2024-06-15T14:30:00+00:00"} | ${"a Z instant is written +0000"}
      ${"208"} | ${"2024-06-15T14:30:45Z"}                | ${"20240615143045+0000"} | ${"2024-06-15T14:30:45+00:00"} | ${"a Z instant with seconds"}
      ${"303"} | ${"2024-06-15T14:30:00Z"}                | ${"202406151430+00"}     | ${"2024-06-15T14:30:00+00:00"} | ${"a Z instant is written +00, never UTC"}
      ${"304"} | ${"2024-06-15T14:30:45+00:00"}           | ${"20240615143045+00"}   | ${"2024-06-15T14:30:45+00:00"} | ${"+00:00 is written +00"}
      ${"205"} | ${"2024-06-15T14:30:00-00:00"}           | ${"202406151430+0000"}   | ${"2024-06-15T14:30:00+00:00"} | ${"-00:00 is +00:00"}
      ${"303"} | ${"2024-01-01T00:30:00+02:00"}           | ${"202401010030+02"}     | ${"2024-01-01T00:30:00+02:00"} | ${"the wall clock, although the instant is on the UTC day before"}
      ${"205"} | ${"2024-06-15T14:30:00+05:30"}           | ${"202406151430+0530"}   | ${"2024-06-15T14:30:00+05:30"} | ${"a half hour east"}
      ${"205"} | ${"2024-06-15T14:30:00-03:30"}           | ${"202406151430-0330"}   | ${"2024-06-15T14:30:00-03:30"} | ${"a half hour west"}
      ${"208"} | ${"2024-06-15T14:30:45+05:45"}           | ${"20240615143045+0545"} | ${"2024-06-15T14:30:45+05:45"} | ${"a 45-minute offset"}
      ${"205"} | ${"2024-06-15T14:30:00-12:00"}           | ${"202406151430-1200"}   | ${"2024-06-15T14:30:00-12:00"} | ${"the most negative offset in use"}
      ${"303"} | ${"2024-06-15T14:30:00+14:00"}           | ${"202406151430+14"}     | ${"2024-06-15T14:30:00+14:00"} | ${"the largest offset in use"}
      ${"208"} | ${"0000-01-01T00:30:00+02:00"}           | ${"00000101003000+0200"} | ${"0000-01-01T00:30:00+02:00"} | ${"the first four-digit year: the instant is before it"}
      ${"205"} | ${"9999-12-31T23:30:00-02:00"}           | ${"999912312330-0200"}   | ${"9999-12-31T23:30:00-02:00"} | ${"the last four-digit year: the instant is after it"}
      ${"304"} | ${"0000-01-01T00:00:00-12:00"}           | ${"00000101000000-12"}   | ${"0000-01-01T00:00:00-12:00"} | ${"the first second of year 0000 at -12:00: the instant is still in year 0000"}
      ${"303"} | ${"9999-12-31T23:30:00+14:00"}           | ${"999912312330+14"}     | ${"9999-12-31T23:30:00+14:00"} | ${"the last day of year 9999 at +14:00: the instant is still in year 9999"}
      ${"303"} | ${"2024-06-15T23:59:59.999999999-12:00"} | ${"202406152359-12"}     | ${"2024-06-15T23:59:00-12:00"} | ${"the last nanosecond of a day at -12:00 keeps its minute and its date"}
      ${"205"} | ${"2024-12-31T23:59:59.999+14:00"}       | ${"202412312359+1400"}   | ${"2024-12-31T23:59:00+14:00"} | ${"the last millisecond of a year at +14:00 never reaches the next year"}
      ${"208"} | ${"2024-12-31T23:59:59.999+14:00"}       | ${"20241231235959+1400"} | ${"2024-12-31T23:59:59+14:00"} | ${"the same instant with seconds: second 59, never 00"}
      ${"304"} | ${"2024-06-15T14:30:00-00:00"}           | ${"20240615143000+00"}   | ${"2024-06-15T14:30:00+00:00"} | ${"-00:00 is written +00 under ZZZ"}
      ${"205"} | ${"2024-06-15T14:30:00+23:59"}           | ${"202406151430+2359"}   | ${"2024-06-15T14:30:00+23:59"} | ${"the largest offset ZHHMM holds"}
    `(
      "writes $value under $code as $expected, which reads back as $readsBack ($reads)",
      ({ code, value, expected, readsBack }) => {
        expect(formatEdifactOffsetDateTime(value, code)).toBe(expected);
        expect(parseEdifactOffsetDateTime(expected, code)).toBe(readsBack);
      },
    );

    // A bracketed zone is read as `toOffsetInstant` reads it: it must agree with the offset, and
    // beside `Z` it sets the wall clock. 19:00Z in Europe/London on 14 June 2024 is 20:00 at
    // +01:00 (British Summer Time).
    it.each`
      code     | value                                         | expected
      ${"303"} | ${"2024-06-15T14:30:00+02:00[Europe/Berlin]"} | ${"202406151430+02"}
      ${"303"} | ${"2024-06-14T19:00:00Z[Europe/London]"}      | ${"202406142000+01"}
      ${"205"} | ${"2024-06-14T19:00:00Z[Asia/Kolkata]"}       | ${"202406150030+0530"}
    `("writes $value under $code as $expected", ({ code, value, expected }) => {
      expect(formatEdifactOffsetDateTime(value, code)).toBe(expected);
    });
  });

  describe("an offset the field cannot hold is never rounded", () => {
    // `ZZZ` holds whole hours and `ZHHMM` whole minutes. Rounding an offset would name another
    // instant, so the value is refused: write a half-hour offset under 205 or 208.
    it.each`
      code     | value                             | reads
      ${"303"} | ${"2024-06-15T14:30:00+05:30"}    | ${"offset minutes under ZZZ: use 205"}
      ${"304"} | ${"2024-06-15T14:30:45+05:45"}    | ${"offset minutes under ZZZ: use 208"}
      ${"303"} | ${"2024-06-15T14:30:00-03:30"}    | ${"a half hour west under ZZZ"}
      ${"304"} | ${"2024-06-15T14:30:45+12:45"}    | ${"a 45-minute offset past twelve hours under ZZZ"}
      ${"303"} | ${"2024-06-15T14:30:00+23:59"}    | ${"one minute short of a whole hour under ZZZ: never rounded to +24 or cut to +23"}
      ${"205"} | ${"2024-06-15T14:30:00+05:45:30"} | ${"offset seconds under ZHHMM"}
      ${"208"} | ${"2024-06-15T14:30:00-00:44:30"} | ${"offset seconds under ZHHMM"}
      ${"303"} | ${"2024-06-15T14:30:00+02:00:30"} | ${"offset seconds under ZZZ"}
    `("returns '' for $value under $code ($reads)", ({ code, value }) => {
      expect(formatEdifactOffsetDateTime(value, code)).toBe("");
    });

    // The rule is about the amount, not the spelling: `+02:00:00` is the offset +02:00 written
    // with a seconds part of zero, and every mask holds it. Only a non-zero seconds part is
    // refused. Each expected value is the wall clock and `+02:00` placed under the mask by hand.
    it.each`
      code     | value                             | expected
      ${"205"} | ${"2024-06-15T14:30:00+02:00:00"} | ${"202406151430+0200"}
      ${"208"} | ${"2024-06-15T14:30:00+02:00:00"} | ${"20240615143000+0200"}
      ${"303"} | ${"2024-06-15T14:30:00+02:00:00"} | ${"202406151430+02"}
      ${"304"} | ${"2024-06-15T14:30:00+02:00:00"} | ${"20240615143000+02"}
      ${"205"} | ${"2024-06-15T14:30:00-05:30:00"} | ${"202406151430-0530"}
    `(
      "writes $value under $code as $expected: a seconds part of zero is no seconds",
      ({ code, value, expected }) => {
        expect(formatEdifactOffsetDateTime(value, code)).toBe(expected);
      },
    );

    it("writes the same half-hour instant under 205 and 208", () => {
      expect(
        formatEdifactOffsetDateTime("2024-06-15T14:30:00+05:30", "205"),
      ).toBe("202406151430+0530");
      expect(
        formatEdifactOffsetDateTime("2024-06-15T14:30:00+05:30", "208"),
      ).toBe("20240615143000+0530");
    });
  });

  describe("the value is a date-time with an offset or Z", () => {
    it.each`
      value                                         | reads
      ${"2024-06-15T14:30:00"}                      | ${"a local date-time: no offset to write; use formatEdifactDateTime"}
      ${"2024-06-15"}                               | ${"a date"}
      ${"14:30:00+02:00"}                           | ${"a time with an offset: no date"}
      ${"14:30"}                                    | ${"a time"}
      ${"+02:00"}                                   | ${"an offset alone"}
      ${"2024-06-15T14:30:00+01:00[Europe/Berlin]"} | ${"an offset its bracketed zone contradicts"}
      ${"2024-06-15T14:30:00+02:00[Not/AZone]"}     | ${"a bracketed zone that does not exist"}
      ${"2024-06-15T14:30:00+0200"}                 | ${"an offset without its colon"}
      ${"20240615T143000+0200"}                     | ${"basic format: the input is extended ISO 8601"}
      ${"2024-06-15T14:30:00z"}                     | ${"a lower-case z"}
      ${"2023-02-29T14:30:00+02:00"}                | ${"29 February 2023"}
      ${"2024-06-15T23:59:60+02:00"}                | ${"a leap second"}
      ${"+010000-01-01T01:30:00Z"}                  | ${"a wall clock in year 10000: CCYY is four digits"}
      ${"-000001-12-31T23:00:00+00:00"}             | ${"a wall clock before year 0000"}
      ${"+010000-01-01T01:30:00+02:00"}             | ${"a wall clock in year 10000, although its instant is in year 9999"}
      ${"-000001-12-31T23:00:00-02:00"}             | ${"a wall clock before year 0000, although its instant is in year 0000"}
      ${"9999-12-31T23:30:00Z[Asia/Tokyo]"}         | ${"a Z instant in year 9999 whose zone's wall clock, at +09:00, is in year 10000"}
      ${"1800-01-01T00:00:00Z[Europe/Amsterdam]"}   | ${"a bracketed zone on local mean time: its offset has seconds, which no mask holds"}
      ${"2024-06-15T14:30:00+24:00"}                | ${"offset hour 24"}
      ${""}                                         | ${"an empty value"}
    `("returns '' for $value ($reads)", ({ value }) => {
      for (const code of ["205", "208", "303", "304"] as const) {
        expect(formatEdifactOffsetDateTime(value, code), code).toBe("");
      }
    });
  });

  describe("a code that does not state a date-time with an offset", () => {
    it.each(edifactFormatsOutside("offsetDateTime"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(
          formatEdifactOffsetDateTime(
            "2024-06-15T14:30:45+02:00",
            code as never,
          ),
        ).toBe("");
      },
    );
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => formatEdifactOffsetDateTime(bad as never, "205")}
      ${"format"} | ${(bad: unknown) => formatEdifactOffsetDateTime("2024-06-15T14:30:00+02:00", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  it("returns '' when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      formatEdifactOffsetDateTime("2024-06-15T14:30:00+02:00", "205"),
    ).toBe("");
  });
});
