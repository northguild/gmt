import { vi } from "vitest";
import { NON_STRINGS, x12FormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { parseX12Date } from "../parse/parseX12Date";
import { formatX12Date } from "./formatX12Date";

/**
 * Every expected value is the ISO 8601 date placed under the X12 1250 mask by hand: `D8` is
 * `CCYYMMDD` and `DB` is `MMDDCCYY`, each field zero-padded to the width the mask gives.
 */
describe("formatX12Date", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("D8 CCYYMMDD and DB MMDDCCYY: a calendar date", () => {
    it.each`
      code    | value           | expected      | reads
      ${"D8"} | ${"2024-06-15"} | ${"20240615"} | ${"year first"}
      ${"D8"} | ${"2024-02-29"} | ${"20240229"} | ${"leap day 2024"}
      ${"D8"} | ${"2024-01-05"} | ${"20240105"} | ${"a month and a day below ten are zero-padded"}
      ${"D8"} | ${"0000-01-01"} | ${"00000101"} | ${"the first four-digit year"}
      ${"D8"} | ${"9999-12-31"} | ${"99991231"} | ${"the last four-digit year"}
      ${"DB"} | ${"2024-06-15"} | ${"06152024"} | ${"month first"}
      ${"DB"} | ${"2024-02-29"} | ${"02292024"} | ${"leap day 2024"}
      ${"DB"} | ${"0987-01-05"} | ${"01050987"} | ${"a year below 1000 is zero-padded"}
      ${"DB"} | ${"0000-01-01"} | ${"01010000"} | ${"the first four-digit year"}
      ${"DB"} | ${"9999-12-31"} | ${"12319999"} | ${"the last four-digit year"}
    `(
      "writes $value under $code as $expected ($reads), which reads back",
      ({ code, value, expected }) => {
        expect(formatX12Date(value, code)).toBe(expected);
        expect(parseX12Date(expected, code)).toBe(value);
      },
    );
  });

  describe("the value is a date, as isValidDate accepts it", () => {
    it.each`
      value                          | reads
      ${"2024-06-15T14:30"}          | ${"a date-time: formatDate returns '' for it too"}
      ${"2024-06-15T14:30:00"}       | ${"a date-time with seconds"}
      ${"2024-06-15T14:30:00Z"}      | ${"an instant"}
      ${"2024-06-15T14:30:00+02:00"} | ${"a date-time with an offset"}
      ${"14:30"}                     | ${"a time"}
      ${"20240615"}                  | ${"basic format: the input is extended ISO 8601"}
      ${"2023-02-29"}                | ${"29 February 2023"}
      ${"2024-06-15[u-ca=hebrew]"}   | ${"a calendar other than ISO 8601"}
      ${"+010000-01-01"}             | ${"year 10000: CCYY is four digits"}
      ${"-000001-12-31"}             | ${"a year before 0000"}
      ${""}                          | ${"an empty value"}
    `("returns '' for $value ($reads)", ({ value }) => {
      expect(formatX12Date(value, "D8")).toBe("");
      expect(formatX12Date(value, "DB")).toBe("");
    });
  });

  describe("a code that does not state a date", () => {
    it.each(x12FormatsOutside("date"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(formatX12Date("2024-06-15", code as never)).toBe("");
      },
    );
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => formatX12Date(bad as never, "D8")}
      ${"format"} | ${(bad: unknown) => formatX12Date("2024-06-15", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  it("returns '' when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(formatX12Date("2024-06-15", "D8")).toBe("");
  });
});
