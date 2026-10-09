import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { fromOffsetInstant } from "../../instant/convert/fromOffsetInstant";
import { toOffsetInstant } from "../../instant/convert/toOffsetInstant";
import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import {
  mockTemporalInstantFromThrow,
  mockTemporalPlainDateTimeFromThrow,
} from "../../test/mocks";
import type { EdifactOffsetDateTimeFormat } from "../../types/edi";
import { parseEdifactOffsetDateTime } from "./parseEdifactOffsetDateTime";

/**
 * Every expected value is read off the UNTDID 2379 mask by hand: the wall clock as written,
 * then its offset as `±HH:MM`. `instant` is that wall clock less the offset, worked out on
 * paper (14:30 at +02:00 is 12:30Z) and checked against plain `Temporal.Instant.from` inside
 * each test: the returned string names that instant.
 */
describe("parseEdifactOffsetDateTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("every code reads its own mask and no other", () => {
    const rows: {
      code: EdifactOffsetDateTimeFormat;
      mask: string;
      value: string;
      expected: string;
      neighbour: EdifactOffsetDateTimeFormat;
    }[] = [
      {
        code: "205",
        mask: "CCYYMMDDHHMMZHHMM",
        value: "202406151430+0200",
        expected: "2024-06-15T14:30:00+02:00",
        neighbour: "303",
      },
      {
        code: "208",
        mask: "CCYYMMDDHHMMSSZHHMM",
        value: "20240615143045+0200",
        expected: "2024-06-15T14:30:45+02:00",
        neighbour: "205",
      },
      {
        code: "303",
        mask: "CCYYMMDDHHMMZZZ",
        value: "202406151430+02",
        expected: "2024-06-15T14:30:00+02:00",
        neighbour: "304",
      },
      {
        code: "304",
        mask: "CCYYMMDDHHMMSSZZZ",
        value: "20240615143045+02",
        expected: "2024-06-15T14:30:45+02:00",
        neighbour: "208",
      },
    ];

    it.each(rows)(
      "$code ($mask) reads $value as $expected, and not one character short or long, nor under $neighbour",
      ({ code, value, expected, neighbour }) => {
        expect(parseEdifactOffsetDateTime(value, code)).toBe(expected);
        expect(parseEdifactOffsetDateTime(value.slice(0, -1), code)).toBe("");
        expect(parseEdifactOffsetDateTime(`${value}0`, code)).toBe("");
        expect(parseEdifactOffsetDateTime(value, neighbour)).toBe("");
      },
    );
  });

  describe("205 CCYYMMDDHHMMZHHMM and 208 CCYYMMDDHHMMSSZHHMM: a signed HHMM offset from UTC", () => {
    // UNTDID 2379, code 205: "ZHHMM = time zone given as offset from Coordinated Universal Time
    // (UTC)". The offsets in use run from −12:00 to +14:00 and include half and three-quarter
    // hours; `ZHHMM` holds all of them.
    it.each`
      code     | value                    | expected                       | instant                      | reads
      ${"205"} | ${"202406151430-0500"}   | ${"2024-06-15T14:30:00-05:00"} | ${"2024-06-15T19:30:00Z"}    | ${"a whole hour west"}
      ${"205"} | ${"202406151430+0000"}   | ${"2024-06-15T14:30:00+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"UTC"}
      ${"205"} | ${"202406151430-0000"}   | ${"2024-06-15T14:30:00+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"-0000 is the offset +00:00"}
      ${"205"} | ${"202406151430+0530"}   | ${"2024-06-15T14:30:00+05:30"} | ${"2024-06-15T09:00:00Z"}    | ${"a half hour east"}
      ${"205"} | ${"202406151430-0330"}   | ${"2024-06-15T14:30:00-03:30"} | ${"2024-06-15T18:00:00Z"}    | ${"a half hour west"}
      ${"205"} | ${"202406151430+0545"}   | ${"2024-06-15T14:30:00+05:45"} | ${"2024-06-15T08:45:00Z"}    | ${"a 45-minute offset"}
      ${"205"} | ${"202406151430+1245"}   | ${"2024-06-15T14:30:00+12:45"} | ${"2024-06-15T01:45:00Z"}    | ${"a 45-minute offset past twelve hours"}
      ${"205"} | ${"202406151430-1200"}   | ${"2024-06-15T14:30:00-12:00"} | ${"2024-06-16T02:30:00Z"}    | ${"the most negative offset in use: the instant is on the next UTC day"}
      ${"205"} | ${"202406151430+1400"}   | ${"2024-06-15T14:30:00+14:00"} | ${"2024-06-15T00:30:00Z"}    | ${"the largest offset in use"}
      ${"205"} | ${"202406151430+2359"}   | ${"2024-06-15T14:30:00+23:59"} | ${"2024-06-14T14:31:00Z"}    | ${"the largest offset the mask holds"}
      ${"205"} | ${"202406150030+0200"}   | ${"2024-06-15T00:30:00+02:00"} | ${"2024-06-14T22:30:00Z"}    | ${"the wall clock stays on its own day: the instant is the UTC day before"}
      ${"205"} | ${"202401010030+1400"}   | ${"2024-01-01T00:30:00+14:00"} | ${"2023-12-31T10:30:00Z"}    | ${"the instant is in the UTC year before"}
      ${"205"} | ${"202402282330-0500"}   | ${"2024-02-28T23:30:00-05:00"} | ${"2024-02-29T04:30:00Z"}    | ${"the instant is on the leap day"}
      ${"205"} | ${"202411030130-0400"}   | ${"2024-11-03T01:30:00-04:00"} | ${"2024-11-03T05:30:00Z"}    | ${"the first 01:30 of New York's fall-back day"}
      ${"205"} | ${"202411030130-0500"}   | ${"2024-11-03T01:30:00-05:00"} | ${"2024-11-03T06:30:00Z"}    | ${"the second 01:30 of that day, an hour later: the offset tells them apart"}
      ${"205"} | ${"000001010030+0200"}   | ${"0000-01-01T00:30:00+02:00"} | ${"-000001-12-31T22:30:00Z"} | ${"the first four-digit year: the instant's UTC year is before it"}
      ${"205"} | ${"999912312330-0200"}   | ${"9999-12-31T23:30:00-02:00"} | ${"+010000-01-01T01:30:00Z"} | ${"the last four-digit year: the instant's UTC year is after it"}
      ${"205"} | ${"000001010000-1200"}   | ${"0000-01-01T00:00:00-12:00"} | ${"0000-01-01T12:00:00Z"}    | ${"the first minute of year 0000 at -12:00: the instant stays in year 0000"}
      ${"205"} | ${"999912312359+1400"}   | ${"9999-12-31T23:59:00+14:00"} | ${"9999-12-31T09:59:00Z"}    | ${"the last minute of year 9999 at +14:00: the instant stays in year 9999"}
      ${"208"} | ${"20240615143045+0530"} | ${"2024-06-15T14:30:45+05:30"} | ${"2024-06-15T09:00:45Z"}    | ${"seconds and a half-hour offset"}
      ${"208"} | ${"20241231233045-1200"} | ${"2024-12-31T23:30:45-12:00"} | ${"2025-01-01T11:30:45Z"}    | ${"seconds: the instant is in the UTC year after"}
    `(
      "reads $code $value as $expected, the instant $instant ($reads)",
      ({ code, value, expected, instant }) => {
        expect(Temporal.Instant.from(expected).toString()).toBe(instant);
        expect(parseEdifactOffsetDateTime(value, code)).toBe(expected);
      },
    );

    it.each`
      code     | value                    | reads
      ${"205"} | ${"202406151430+2400"}   | ${"offset hour 24"}
      ${"205"} | ${"202406151430+0260"}   | ${"offset minute 60"}
      ${"205"} | ${"202406151430+02:00"}  | ${"a colon in the offset"}
      ${"205"} | ${"202406151430Z"}       | ${"a Z designator: 2379 has none"}
      ${"205"} | ${"202406151430"}        | ${"203's value: no offset"}
      ${"205"} | ${"2024061514300200"}    | ${"no sign"}
      ${"205"} | ${"202406151430?+0200"}  | ${"the release character is the caller's to remove"}
      ${"208"} | ${"20240615143060+0200"} | ${"second 60: GMT rejects a leap second"}
      ${"205"} | ${"202302291430+0200"}   | ${"29 February 2023"}
      ${"205"} | ${"202406152430+0200"}   | ${"hour 24"}
      ${"205"} | ${"202406151430+0200\n"} | ${"a trailing line feed"}
    `("returns '' for $code $value ($reads)", ({ code, value }) => {
      expect(parseEdifactOffsetDateTime(value, code)).toBe("");
    });
  });

  describe("303 CCYYMMDDHHMMZZZ and 304 CCYYMMDDHHMMSSZZZ: three zone characters, read as an offset only", () => {
    // UN/ECE Recommendation 7 ¶12: the difference is appended "in hours and minutes, or hours
    // only, with a leading "+" or "-" sign" (`+01`, `-05`); hours only is exactly three
    // characters. The SMDG IFTSAI and BAPLIE guides write the literal `UTC` in a 303 value, and
    // ¶12 names the same scale twice: "Co-ordinated Universal Time (formerly known as Greenwich
    // Mean Time)", so `GMT` is +00:00 too.
    it.each`
      code     | value                  | expected                       | instant                      | reads
      ${"303"} | ${"202406151430-05"}   | ${"2024-06-15T14:30:00-05:00"} | ${"2024-06-15T19:30:00Z"}    | ${"-05, the Recommendation 7 example"}
      ${"303"} | ${"202406151430+00"}   | ${"2024-06-15T14:30:00+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"+00"}
      ${"303"} | ${"202406151430-00"}   | ${"2024-06-15T14:30:00+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"-00 is the offset +00:00"}
      ${"303"} | ${"202406151430UTC"}   | ${"2024-06-15T14:30:00+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"the literal UTC"}
      ${"303"} | ${"202406151430GMT"}   | ${"2024-06-15T14:30:00+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"the literal GMT: UTC's former name (Rec 7 ¶12)"}
      ${"303"} | ${"202406151430-12"}   | ${"2024-06-15T14:30:00-12:00"} | ${"2024-06-16T02:30:00Z"}    | ${"-12, the most negative offset in use"}
      ${"303"} | ${"202406151430+14"}   | ${"2024-06-15T14:30:00+14:00"} | ${"2024-06-15T00:30:00Z"}    | ${"+14, the largest offset in use"}
      ${"303"} | ${"202406151430+23"}   | ${"2024-06-15T14:30:00+23:00"} | ${"2024-06-14T15:30:00Z"}    | ${"+23, the largest hour"}
      ${"303"} | ${"202406151430-23"}   | ${"2024-06-15T14:30:00-23:00"} | ${"2024-06-16T13:30:00Z"}    | ${"-23, the largest hour west"}
      ${"303"} | ${"202401010030+14"}   | ${"2024-01-01T00:30:00+14:00"} | ${"2023-12-31T10:30:00Z"}    | ${"the instant is in the UTC year before"}
      ${"303"} | ${"999912312330-02"}   | ${"9999-12-31T23:30:00-02:00"} | ${"+010000-01-01T01:30:00Z"} | ${"the last four-digit year: the instant's UTC year is after it"}
      ${"303"} | ${"000001010030+02"}   | ${"0000-01-01T00:30:00+02:00"} | ${"-000001-12-31T22:30:00Z"} | ${"the first four-digit year: the instant's UTC year is before it"}
      ${"304"} | ${"20240615143000-00"} | ${"2024-06-15T14:30:00+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"seconds, -00 is the offset +00:00"}
      ${"304"} | ${"20240615143045UTC"} | ${"2024-06-15T14:30:45+00:00"} | ${"2024-06-15T14:30:45Z"}    | ${"seconds, the literal UTC"}
      ${"304"} | ${"20240615143045GMT"} | ${"2024-06-15T14:30:45+00:00"} | ${"2024-06-15T14:30:45Z"}    | ${"seconds, the literal GMT"}
      ${"304"} | ${"20241231233045-12"} | ${"2024-12-31T23:30:45-12:00"} | ${"2025-01-01T11:30:45Z"}    | ${"seconds: the instant is in the UTC year after"}
    `(
      "reads $code $value as $expected, the instant $instant ($reads)",
      ({ code, value, expected, instant }) => {
        expect(Temporal.Instant.from(expected).toString()).toBe(instant);
        expect(parseEdifactOffsetDateTime(value, code)).toBe(expected);
      },
    );

    // GMT rule: no UN/EDIFACT text defines a zone abbreviation, so none is read. A field led by
    // a sign or holding a digit that is not a valid signed hour is a broken offset. A lone `Z`
    // is refused: Recommendation 7 ¶12 writes UTC as the single letter `Z`, but the mask has
    // three characters, a variable-length element carries no trailing spaces (syntax rules §7:
    // "leading zeroes and trailing spaces shall be suppressed"), and no guide writes it.
    it.each`
      text      | reads
      ${"CET"}  | ${"an abbreviation: no standard defines it"}
      ${"PDT"}  | ${"an abbreviation"}
      ${"EST"}  | ${"an abbreviation"}
      ${"UTZ"}  | ${"one letter off UTC is not UTC"}
      ${"ZZZ"}  | ${"Z is not read as a UTC designator"}
      ${"XYZ"}  | ${"three letters that spell no zone anyone uses"}
      ${"+24"}  | ${"a signed 24: one past the last hour"}
      ${"-99"}  | ${"a signed 99"}
      ${"+-1"}  | ${"two signs and a digit"}
      ${"---"}  | ${"signs alone"}
      ${"000"}  | ${"digits alone, no sign"}
      ${"123"}  | ${"digits alone, no sign"}
      ${"+2A"}  | ${"a sign, one digit and a letter"}
      ${"UT1"}  | ${"two letters and a digit"}
      ${"utc"}  | ${"lower case"}
      ${"Utc"}  | ${"mixed case"}
      ${"gmt"}  | ${"lower case"}
      ${" 02"}  | ${"a space for the sign"}
      ${"A B"}  | ${"a space between letters"}
      ${"ÅBC"}  | ${"a letter outside A–Z"}
      ${"AB"}   | ${"two characters"}
      ${"Z"}    | ${"a lone Z: Recommendation 7's UTC designator is one character and the mask has three"}
      ${"Z  "}  | ${"a lone Z padded to three characters with spaces"}
      ${"ABCD"} | ${"four characters"}
      ${"UTCC"} | ${"UTC and one more letter"}
    `(
      "returns '' for the zone characters '$text' under 303 and 304 ($reads)",
      ({ text }) => {
        expect(parseEdifactOffsetDateTime(`202406151430${text}`, "303")).toBe(
          "",
        );
        expect(parseEdifactOffsetDateTime(`20240615143045${text}`, "304")).toBe(
          "",
        );
      },
    );

    // `+` is the EDIFACT data element separator, so an interchange transmits `+02` as `?+02`
    // (ISO 9735-1 release character). The value is taken after the interchange is unescaped.
    it("returns '' for 303 202406151430?+02: the release character is the caller's to remove", () => {
      expect(parseEdifactOffsetDateTime("202406151430?+02", "303")).toBe("");
      expect(parseEdifactOffsetDateTime("202406151430+02", "303")).not.toBe("");
    });

    it.each`
      code     | value                    | reads
      ${"303"} | ${"202406151430+0200"}   | ${"205's value: ZHHMM is five characters"}
      ${"304"} | ${"20240615143045+0200"} | ${"208's value"}
      ${"303"} | ${"202406151430"}        | ${"203's value: no zone"}
      ${"303"} | ${"202302291430+02"}     | ${"29 February 2023"}
      ${"304"} | ${"20240615143060+02"}   | ${"second 60"}
    `("returns '' for $code $value ($reads)", ({ code, value }) => {
      expect(parseEdifactOffsetDateTime(value, code)).toBe("");
    });
  });

  describe("the result is the string fromOffsetInstant writes and toOffsetInstant reads", () => {
    it.each`
      code     | value                    | instant                   | offset
      ${"205"} | ${"202406151430+0200"}   | ${"2024-06-15T12:30:00Z"} | ${"+02:00"}
      ${"208"} | ${"20240615143045-0330"} | ${"2024-06-15T18:00:45Z"} | ${"-03:30"}
      ${"303"} | ${"202406151430UTC"}     | ${"2024-06-15T14:30:00Z"} | ${"+00:00"}
      ${"304"} | ${"20240615003045+14"}   | ${"2024-06-14T10:30:45Z"} | ${"+14:00"}
    `(
      "$code $value is the pair { instant: $instant, offset: $offset }",
      ({ code, value, instant, offset }) => {
        const parsed = parseEdifactOffsetDateTime(value, code);
        expect(toOffsetInstant(parsed)).toEqual({ instant, offset });
        expect(fromOffsetInstant({ instant, offset })).toBe(parsed);
      },
    );
  });

  describe("a code that does not state a date-time with an offset", () => {
    it.each(edifactFormatsOutside("offsetDateTime"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(
          parseEdifactOffsetDateTime("202406151430+0200", code as never),
        ).toBe("");
        expect(
          parseEdifactOffsetDateTime("202406151430+02", code as never),
        ).toBe("");
        expect(
          parseEdifactOffsetDateTime("2406151430+0200", code as never),
        ).toBe("");
        expect(parseEdifactOffsetDateTime("2406151430+02", code as never)).toBe(
          "",
        );
      },
    );
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => parseEdifactOffsetDateTime(bad as never, "205")}
      ${"format"} | ${(bad: unknown) => parseEdifactOffsetDateTime("202406151430+0200", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  describe("the catch path", () => {
    it("returns '' when Temporal.PlainDateTime.from throws", () => {
      mockTemporalPlainDateTimeFromThrow();
      expect(parseEdifactOffsetDateTime("202406151430+0200", "205")).toBe("");
    });

    it("returns '' when Temporal.Instant.from throws", () => {
      mockTemporalInstantFromThrow();
      expect(parseEdifactOffsetDateTime("202406151430+0200", "205")).toBe("");
      expect(parseEdifactOffsetDateTime("202406151430+02", "303")).toBe("");
    });
  });
});
