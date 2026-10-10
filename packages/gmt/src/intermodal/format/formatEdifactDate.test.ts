import { vi } from "vitest";
import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { parseEdifactDate } from "../parse/parseEdifactDate";
import { formatEdifactDate } from "./formatEdifactDate";

/**
 * Every expected value is the ISO 8601 date placed under the UNTDID 2379 mask by hand: `102` is
 * `CCYYMMDD`, the year in four digits, then the month and the day in two each.
 */
describe("formatEdifactDate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("102 CCYYMMDD: a calendar date", () => {
    it.each`
      value           | expected      | reads
      ${"2024-06-15"} | ${"20240615"} | ${"15 June 2024"}
      ${"2024-02-29"} | ${"20240229"} | ${"leap day 2024"}
      ${"2024-01-05"} | ${"20240105"} | ${"a month and a day below ten are zero-padded"}
      ${"0000-01-01"} | ${"00000101"} | ${"the first four-digit year"}
      ${"0987-06-15"} | ${"09870615"} | ${"a year below 1000 is zero-padded"}
      ${"9999-12-31"} | ${"99991231"} | ${"the last four-digit year"}
    `("writes $value as $expected ($reads)", ({ value, expected }) => {
      expect(formatEdifactDate(value, "102")).toBe(expected);
      expect(parseEdifactDate(expected, "102")).toBe(value);
    });

    it("writes the date of an ISO-calendar annotation, as isValidDate reads it", () => {
      expect(formatEdifactDate("2024-06-15[u-ca=iso8601]", "102")).toBe(
        "20240615",
      );
    });
  });

  describe("the value is a date, as isValidDate accepts it", () => {
    it.each`
      value                          | reads
      ${"2024-06-15T14:30:00"}       | ${"a date-time: formatDate returns '' for it too"}
      ${"2024-06-15T14:30:00Z"}      | ${"an instant"}
      ${"2024-06-15T14:30:00+02:00"} | ${"a date-time with an offset"}
      ${"14:30"}                     | ${"a time"}
      ${"20240615"}                  | ${"basic format: the input is extended ISO 8601"}
      ${"2023-02-29"}                | ${"29 February 2023"}
      ${"2024-06-31"}                | ${"31 June"}
      ${"2024-6-15"}                 | ${"an unpadded month"}
      ${"2024-06-15[u-ca=hebrew]"}   | ${"a calendar other than ISO 8601"}
      ${"+010000-01-01"}             | ${"year 10000: CCYY is four digits"}
      ${"-000001-12-31"}             | ${"a year before 0000: CCYY has no sign"}
      ${"2024-06-15/2024-06-20"}     | ${"an interval: use formatEdifactDatePeriod"}
      ${""}                          | ${"an empty value"}
    `("returns '' for $value ($reads)", ({ value }) => {
      expect(formatEdifactDate(value, "102")).toBe("");
    });
  });

  describe("a code that does not state a date", () => {
    it.each(edifactFormatsOutside("date"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(formatEdifactDate("2024-06-15", code as never)).toBe("");
      },
    );
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => formatEdifactDate(bad as never, "102")}
      ${"format"} | ${(bad: unknown) => formatEdifactDate("2024-06-15", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  it("returns '' when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(formatEdifactDate("2024-06-15", "102")).toBe("");
  });
});
