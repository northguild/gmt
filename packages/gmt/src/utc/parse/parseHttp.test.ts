import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { formatHttp } from "../format/formatHttp";
import { parseHttp } from "./parseHttp";

describe("parseHttp", () => {
  it.each`
    value                              | expected
    ${"Fri, 15 Mar 2024 14:30:00 GMT"} | ${"2024-03-15T14:30:00Z"}
    ${"Fri, 05 Jan 2024 09:00:00 GMT"} | ${"2024-01-05T09:00:00Z"}
    ${"Tue, 05 Mar 2024 09:00:05 GMT"} | ${"2024-03-05T09:00:05Z"}
  `(
    "parses $value to $expected",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(parseHttp(value)).toBe(expected);
    },
  );

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setNow(instant: string): void {
    vi.spyOn(Temporal.Now, "instant").mockReturnValue(
      Temporal.Instant.from(instant),
    );
  }

  describe("day-name MUST be the day implied by the date (RFC 9110 §5.6.7 → RFC 5322 §3.3)", () => {
    // 2024-03-15 was a Friday; 1994-11-06 a Sunday (Date.UTC → getUTCDay()).
    it.each`
      value                                 | expected
      ${"Sat, 15 Mar 2024 14:30:00 GMT"}    | ${""}
      ${"Mon, 15 Mar 2024 14:30:00 GMT"}    | ${""}
      ${"Saturday, 06-Nov-94 08:49:37 GMT"} | ${""}
      ${"Sat Nov  6 08:49:37 1994"}         | ${""}
    `("$value → ''", ({ value, expected }) => {
      setNow("2026-09-16T12:00:00Z");
      expect(parseHttp(value)).toBe(expected);
    });
  });

  describe("asctime-date (RFC 9110 §5.6.7, MUST accept)", () => {
    it.each`
      value                         | expected
      ${"Sun Nov  6 08:49:37 1994"} | ${"1994-11-06T08:49:37Z"}
      ${"Sun Nov 06 08:49:37 1994"} | ${"1994-11-06T08:49:37Z"}
      ${"Fri Mar 15 14:30:00 2024"} | ${"2024-03-15T14:30:00Z"}
    `("parses $value to $expected", ({ value, expected }) => {
      expect(parseHttp(value)).toBe(expected);
    });

    it.each`
      value                             | reason
      ${"Sun Nov 6 08:49:37 1994"}      | ${"a 1-digit day needs two spaces"}
      ${"Sun Nov   6 08:49:37 1994"}    | ${"three spaces"}
      ${"sun nov  6 08:49:37 1994"}     | ${"HTTP-date is case-sensitive"}
      ${"Sun Nov  6 08:49:37 1994 GMT"} | ${"no zone in asctime-date"}
      ${"Sun Nov  6 08:49:37 94"}       | ${"year = 4DIGIT"}
    `("returns '' for $value ($reason)", ({ value }) => {
      expect(parseHttp(value)).toBe("");
    });
  });

  describe("rfc850-date (RFC 9110 §5.6.7, MUST accept)", () => {
    // "MUST interpret a timestamp that appears to be more than 50 years in
    // the future as representing the most recent year in the past that had
    // the same last two digits." Clock: 2026-09-16T12:00:00Z, so the limit
    // is 2076-09-16T12:00:00Z. Weekdays from Date.UTC: 2076-09-16 Wed,
    // 1976-09-16 Thu, 2075-01-01 Tue, 1977-01-01 Sat, 2026-01-01 Thu,
    // 1999-01-01 Fri.
    it.each`
      value                                  | expected                  | reason
      ${"Sunday, 06-Nov-94 08:49:37 GMT"}    | ${"1994-11-06T08:49:37Z"} | ${"2094 is 68 years ahead"}
      ${"Friday, 15-Mar-24 14:30:00 GMT"}    | ${"2024-03-15T14:30:00Z"} | ${"2024 is in the past"}
      ${"Thursday, 01-Jan-26 00:00:00 GMT"}  | ${"2026-01-01T00:00:00Z"} | ${"this year"}
      ${"Tuesday, 01-Jan-75 00:00:00 GMT"}   | ${"2075-01-01T00:00:00Z"} | ${"48.3 years ahead: kept"}
      ${"Saturday, 01-Jan-77 00:00:00 GMT"}  | ${"1977-01-01T00:00:00Z"} | ${"2077 is 50.3 years ahead"}
      ${"Friday, 01-Jan-99 00:00:00 GMT"}    | ${"1999-01-01T00:00:00Z"} | ${"2099 is 72 years ahead"}
      ${"Wednesday, 16-Sep-76 12:00:00 GMT"} | ${"2076-09-16T12:00:00Z"} | ${"exactly 50 years ahead is not more than 50"}
      ${"Thursday, 16-Sep-76 12:00:01 GMT"}  | ${"1976-09-16T12:00:01Z"} | ${"one second past 50 years ahead"}
      ${"Wednesday, 16-Sep-76 12:00:01 GMT"} | ${""}                     | ${"resolves to 1976, a Thursday"}
    `(
      "now 2026-09-16: $value → '$expected' ($reason)",
      ({ value, expected }) => {
        setNow("2026-09-16T12:00:00Z");
        expect(parseHttp(value)).toBe(expected);
      },
    );

    it("reads the two digits against the clock, not a fixed century (now 2090-01-01)", () => {
      // 2130-01-01 (a Sunday) is 40 years ahead, so it is not in the future
      // beyond 50 years; 2030 would be the century-fixed reading.
      setNow("2090-01-01T00:00:00Z");
      expect(parseHttp("Sunday, 01-Jan-30 00:00:00 GMT")).toBe(
        "2130-01-01T00:00:00Z",
      );
    });

    it.each`
      value                                 | reason
      ${"Sun, 06-Nov-94 08:49:37 GMT"}      | ${"rfc850 needs the full day name"}
      ${"Sunday, 06-Nov-1994 08:49:37 GMT"} | ${"date2 year = 2DIGIT"}
      ${"Sunday, 6-Nov-94 08:49:37 GMT"}    | ${"day = 2DIGIT"}
      ${"sunday, 06-nov-94 08:49:37 GMT"}   | ${"HTTP-date is case-sensitive"}
      ${"Sunday, 06-Nov-94 08:49:37 UTC"}   | ${"zone is the literal GMT"}
      ${"Friday, 31-Feb-24 08:49:37 GMT"}   | ${"February has no 31st"}
    `("returns '' for $value ($reason)", ({ value }) => {
      setNow("2026-09-16T12:00:00Z");
      expect(parseHttp(value)).toBe("");
    });

    it("returns '' when the clock cannot be read", () => {
      mockTemporalNowInstantThrow();
      expect(parseHttp("Sunday, 06-Nov-94 08:49:37 GMT")).toBe("");
    });

    it("IMF-fixdate does not read the clock", () => {
      mockTemporalNowInstantThrow();
      expect(parseHttp("Fri, 15 Mar 2024 14:30:00 GMT")).toBe(
        "2024-03-15T14:30:00Z",
      );
    });
  });

  it.each`
    value
    ${"not a date"}
    ${""}
    ${"Fri, 15 Mar 2024 14:30:00 -0400"}
    ${"fri, 15 Mar 2024 14:30:00 GMT"}
    ${"Fri, 15 Mar 2024 14:30:00 gmt"}
    ${"Fri, 32 Mar 2024 14:30:00 GMT"}
    ${"Fri, 15 Mar 2024 14:30 GMT"}
  `("returns '' for invalid input $value", ({ value }: { value: string }) => {
    expect(parseHttp(value)).toBe("");
  });

  it.each`
    value                              | reason
    ${"Sat, 31 Feb 2024 14:30:00 GMT"} | ${"February has no 31st"}
    ${"Wed, 29 Feb 2023 14:30:00 GMT"} | ${"2023 is not a leap year"}
    ${"Mon, 31 Apr 2024 14:30:00 GMT"} | ${"April has 30 days"}
  `(
    "returns '' for impossible date $value ($reason) instead of clamping",
    ({ value }: { value: string }) => {
      expect(parseHttp(value)).toBe("");
    },
  );

  it("round-trips through formatHttp", () => {
    const original = "Fri, 15 Mar 2024 14:30:00 GMT";
    expect(formatHttp(parseHttp(original))).toBe(original);
  });
});
