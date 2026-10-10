import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { httpDate } from "../../regex";
import { NON_STRINGS } from "../../test/ediCodes";
import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { parseHttpDate } from "../parse/parseHttpDate";
import { isValidHttpDate } from "./isValidHttpDate";

/**
 * Each verdict is worked out from the RFC 9110 §5.6.7 HTTP-date grammar and the calendar, never
 * from the function: IMF-fixdate (`day-name "," SP 2DIGIT SP month SP 4DIGIT SP time-of-day SP
 * GMT`), the obsolete rfc850-date and asctime-date, all case-sensitive, and a day name that must
 * be the day the date implies. `pattern` is what the shape-only `httpDate` says of the same
 * string; it matches IMF-fixdate alone. The valid and invalid rows of `parseHttpDate.test.ts` are
 * all here, so the two files stay in step.
 *
 * Weekdays: 2024-03-15 Fri, 2024-01-05 Fri, 2024-03-05 Tue, 2024-02-29 Thu, 9999-12-31 Fri,
 * 0000-01-01 Sat, 1994-11-06 Sun.
 */
describe("isValidHttpDate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setNow(instant: string): void {
    vi.spyOn(Temporal.Now, "instant").mockReturnValue(
      Temporal.Instant.from(instant),
    );
  }

  it.each`
    value                                | expected | pattern  | reason
    ${"Fri, 15 Mar 2024 14:30:00 GMT"}   | ${true}  | ${true}  | ${"IMF-fixdate"}
    ${"Fri, 05 Jan 2024 09:00:00 GMT"}   | ${true}  | ${true}  | ${"IMF-fixdate, zero-padded day"}
    ${"Tue, 05 Mar 2024 09:00:05 GMT"}   | ${true}  | ${true}  | ${"IMF-fixdate with seconds"}
    ${"Thu, 29 Feb 2024 00:00:00 GMT"}   | ${true}  | ${true}  | ${"29 February in a leap year"}
    ${"Fri, 31 Dec 9999 23:59:59 GMT"}   | ${true}  | ${true}  | ${"the last second of year 9999"}
    ${"Sat, 01 Jan 0000 00:00:00 GMT"}   | ${true}  | ${true}  | ${"year = 4DIGIT"}
    ${"Sun Nov  6 08:49:37 1994"}        | ${true}  | ${false} | ${"asctime-date, space-padded day"}
    ${"Sun Nov 06 08:49:37 1994"}        | ${true}  | ${false} | ${"asctime-date, 2-digit day"}
    ${"Fri Mar 15 14:30:00 2024"}        | ${true}  | ${false} | ${"asctime-date"}
    ${"not a date"}                      | ${false} | ${false} | ${"not an HTTP-date"}
    ${""}                                | ${false} | ${false} | ${"empty"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400"} | ${false} | ${false} | ${"a numeric offset"}
    ${"Fri, 15 Mar 2024 14:30:00 UTC"}   | ${false} | ${false} | ${"the zone is the literal GMT"}
    ${"fri, 15 Mar 2024 14:30:00 GMT"}   | ${false} | ${false} | ${"lower-case day name"}
    ${"Fri, 15 Mar 2024 14:30:00 gmt"}   | ${false} | ${false} | ${"lower-case gmt"}
    ${"Fri, 15 Mar 2024 14:30 GMT"}      | ${false} | ${false} | ${"seconds are required"}
    ${"Tue, 5 Mar 2024 09:00:05 GMT"}    | ${false} | ${false} | ${"day = 2DIGIT"}
    ${"Fri,15 Mar 2024 14:30:00 GMT"}    | ${false} | ${false} | ${"no space after the comma"}
    ${"15 Mar 2024 14:30:00 GMT"}        | ${false} | ${false} | ${"no day name"}
    ${"Fri, 15 Mar 2024 14:30:00 GMT "}  | ${false} | ${false} | ${"trailing space"}
    ${"Fri, 15 Mar 2024 14:30:00 GMT\n"} | ${false} | ${false} | ${"trailing line feed"}
    ${"2024-03-15T14:30:00Z"}            | ${false} | ${false} | ${"an ISO 8601 date-time"}
    ${"Sun Nov 6 08:49:37 1994"}         | ${false} | ${false} | ${"asctime-date: a 1-digit day needs two spaces"}
    ${"Sun Nov   6 08:49:37 1994"}       | ${false} | ${false} | ${"asctime-date: three spaces"}
    ${"sun nov  6 08:49:37 1994"}        | ${false} | ${false} | ${"asctime-date in lower case"}
    ${"Sun Nov  6 08:49:37 1994 GMT"}    | ${false} | ${false} | ${"asctime-date has no zone"}
    ${"Sun Nov  6 08:49:37 94"}          | ${false} | ${false} | ${"asctime-date year = 4DIGIT"}
    ${"Sat Nov  6 08:49:37 1994"}        | ${false} | ${false} | ${"asctime-date: 6 Nov 1994 was a Sunday"}
    ${"Sat, 15 Mar 2024 14:30:00 GMT"}   | ${false} | ${true}  | ${"15 Mar 2024 was a Friday"}
    ${"Mon, 15 Mar 2024 14:30:00 GMT"}   | ${false} | ${true}  | ${"15 Mar 2024 was a Friday"}
    ${"Sat, 31 Feb 2024 14:30:00 GMT"}   | ${false} | ${true}  | ${"February has no 31st"}
    ${"Wed, 29 Feb 2023 14:30:00 GMT"}   | ${false} | ${true}  | ${"2023 has no 29 February"}
    ${"Mon, 31 Apr 2024 14:30:00 GMT"}   | ${false} | ${true}  | ${"April has 30 days"}
    ${"Mon, 31 Jun 2024 14:30:00 GMT"}   | ${false} | ${true}  | ${"June has 30 days"}
    ${"Fri, 32 Mar 2024 14:30:00 GMT"}   | ${false} | ${true}  | ${"day 32"}
    ${"Fri, 00 Mar 2024 14:30:00 GMT"}   | ${false} | ${true}  | ${"day 00"}
    ${"Fri, 15 Mar 2024 24:00:00 GMT"}   | ${false} | ${true}  | ${"hour 24"}
    ${"Fri, 15 Mar 2024 14:60:00 GMT"}   | ${false} | ${true}  | ${"minute 60"}
    ${"Fri, 15 Mar 2024 14:30:60 GMT"}   | ${false} | ${true}  | ${"second 60: GMT rejects leap seconds"}
  `(
    "returns $expected for $value ($reason); the pattern alone says $pattern; parseHttpDate agrees",
    ({
      value,
      expected,
      pattern,
    }: {
      value: string;
      expected: boolean;
      pattern: boolean;
    }) => {
      expect(isValidHttpDate(value)).toBe(expected);
      expect(httpDate.test(value)).toBe(pattern);
      expect(isValidHttpDate(value)).toBe(parseHttpDate(value) !== "");
    },
  );

  // rfc850-date carries a two-digit year, read against the clock: "a timestamp that appears to be
  // more than 50 years in the future" is "the most recent year in the past that had the same last
  // two digits" (RFC 9110 §5.6.7). Clock: 2026-09-16T12:00:00Z, so the limit is
  // 2076-09-16T12:00:00Z. Weekdays: 1994-11-06 Sun, 2024-03-15 Fri, 2026-01-01 Thu, 2075-01-01
  // Tue, 1977-01-01 Sat, 2076-09-16 Wed, 1976-09-16 Thu.
  it.each`
    value                                  | expected | reason
    ${"Sunday, 06-Nov-94 08:49:37 GMT"}    | ${true}  | ${"2094 is 68 years ahead, so 1994"}
    ${"Friday, 15-Mar-24 14:30:00 GMT"}    | ${true}  | ${"2024 is in the past"}
    ${"Thursday, 01-Jan-26 00:00:00 GMT"}  | ${true}  | ${"this year"}
    ${"Tuesday, 01-Jan-75 00:00:00 GMT"}   | ${true}  | ${"48.3 years ahead: kept"}
    ${"Saturday, 01-Jan-77 00:00:00 GMT"}  | ${true}  | ${"2077 is 50.3 years ahead, so 1977"}
    ${"Wednesday, 16-Sep-76 12:00:00 GMT"} | ${true}  | ${"exactly 50 years ahead is not more than 50"}
    ${"Thursday, 16-Sep-76 12:00:01 GMT"}  | ${true}  | ${"one second past 50 years ahead, so 1976"}
    ${"Wednesday, 16-Sep-76 12:00:01 GMT"} | ${false} | ${"resolves to 1976, a Thursday"}
    ${"Saturday, 06-Nov-94 08:49:37 GMT"}  | ${false} | ${"6 Nov 1994 was a Sunday"}
    ${"Friday, 31-Feb-24 08:49:37 GMT"}    | ${false} | ${"February has no 31st"}
    ${"Sun, 06-Nov-94 08:49:37 GMT"}       | ${false} | ${"rfc850-date needs the full day name"}
    ${"Sunday, 06-Nov-1994 08:49:37 GMT"}  | ${false} | ${"date2 year = 2DIGIT"}
    ${"Sunday, 6-Nov-94 08:49:37 GMT"}     | ${false} | ${"day = 2DIGIT"}
    ${"sunday, 06-nov-94 08:49:37 GMT"}    | ${false} | ${"HTTP-date is case-sensitive"}
    ${"Sunday, 06-Nov-94 08:49:37 UTC"}    | ${false} | ${"the zone is the literal GMT"}
  `(
    "now 2026-09-16: returns $expected for rfc850-date $value ($reason); the pattern does not match; parseHttpDate agrees",
    ({ value, expected }: { value: string; expected: boolean }) => {
      setNow("2026-09-16T12:00:00Z");
      expect(isValidHttpDate(value)).toBe(expected);
      expect(httpDate.test(value)).toBe(false);
      expect(isValidHttpDate(value)).toBe(parseHttpDate(value) !== "");
    },
  );

  it("returns false for an rfc850-date when the clock cannot be read, as parseHttpDate returns ''", () => {
    mockTemporalNowInstantThrow();
    expect(isValidHttpDate("Sunday, 06-Nov-94 08:49:37 GMT")).toBe(false);
    expect(parseHttpDate("Sunday, 06-Nov-94 08:49:37 GMT")).toBe("");
  });

  it("does not read the clock for an IMF-fixdate", () => {
    mockTemporalNowInstantThrow();
    expect(isValidHttpDate("Fri, 15 Mar 2024 14:30:00 GMT")).toBe(true);
  });

  it("returns false for an argument that is not a string, as parseHttpDate returns ''", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidHttpDate(make() as never), kind).toBe(false);
      expect(parseHttpDate(make() as never), kind).toBe("");
    }
  });
});
