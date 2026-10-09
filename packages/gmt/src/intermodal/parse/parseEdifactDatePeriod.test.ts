import { expectTypeOf, vi } from "vitest";
import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { intervalLengthDate } from "../../plain/interval/intervalLengthDate";
import type { EdiDatePeriod } from "../../types/edi";
import { parseEdifactDatePeriod } from "./parseEdifactDatePeriod";

/**
 * Every expected value is read off the UNTDID 2379 mask by hand: `718` is `CCYYMMDD-CCYYMMDD`,
 * two dates run together with no hyphen between them on the wire.
 */
describe("parseEdifactDatePeriod", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("718 CCYYMMDD-CCYYMMDD: a period between two dates", () => {
    it.each`
      value                 | expected                                      | reads
      ${"2024061520240620"} | ${{ start: "2024-06-15", end: "2024-06-20" }} | ${"five days"}
      ${"2024061520240615"} | ${{ start: "2024-06-15", end: "2024-06-15" }} | ${"one day: the end equals the start"}
      ${"2023123120240101"} | ${{ start: "2023-12-31", end: "2024-01-01" }} | ${"across a year end"}
      ${"2024022820240229"} | ${{ start: "2024-02-28", end: "2024-02-29" }} | ${"into leap day 2024"}
      ${"0000010199991231"} | ${{ start: "0000-01-01", end: "9999-12-31" }} | ${"the whole four-digit range"}
    `("reads $value as $expected ($reads)", ({ value, expected }) => {
      expect(parseEdifactDatePeriod(value, "718")).toEqual(expected);
    });

    it("returns exactly the members start and end", () => {
      expect(
        Object.keys(parseEdifactDatePeriod("2024061520240620", "718") ?? {}),
      ).toEqual(["start", "end"]);
    });

    // UNTDID 2379, from D.01C: "Data is to be transmitted as consecutive characters without
    // hyphen." The hyphen in the mask is notation: none of the twelve directories read, from
    // D.93A to D.22B, transmits one.
    it.each`
      value                     | reads
      ${"20240615-20240620"}    | ${"a hyphen: X12 RD8's wire form, never a 2379 one"}
      ${"20240615--20240620"}   | ${"two hyphens"}
      ${"20240615 20240620"}    | ${"a space"}
      ${"20240615/20240620"}    | ${"a solidus"}
      ${"-2024061520240620"}    | ${"a leading hyphen"}
      ${"2024061520240620-"}    | ${"a trailing hyphen"}
      ${"2024-06-152024-06-20"} | ${"ISO 8601 dates"}
      ${"20240615"}             | ${"one date: 102's value"}
      ${"240615240620"}         | ${"YYMMDD-YYMMDD: a two-digit year is not read"}
      ${"202406152024062"}      | ${"one digit short"}
      ${"20240615202406200"}    | ${"one digit long"}
      ${""}                     | ${"an empty value"}
    `("returns null for $value ($reads)", ({ value }) => {
      expect(parseEdifactDatePeriod(value, "718")).toBeNull();
    });
  });

  describe("the result is two plain values, not a pair of instants", () => {
    it("is typed EdiDatePeriod, with both members always present", () => {
      expectTypeOf(
        parseEdifactDatePeriod,
      ).returns.toEqualTypeOf<EdiDatePeriod | null>();
      expectTypeOf<EdiDatePeriod>().toEqualTypeOf<{
        start: string;
        end: string;
      }>();
    });

    // 15 to 20 June is five days.
    it("passes to the plain interval functions as (start, end)", () => {
      const period = parseEdifactDatePeriod("2024061520240620", "718");
      expect(
        period === null
          ? null
          : intervalLengthDate(period.start, period.end, "day"),
      ).toBe(5);
    });
  });

  describe("an end before its start names no span of time (GMT rule)", () => {
    it.each`
      value                 | reads
      ${"2024062020240615"} | ${"the end date is five days before the start"}
      ${"2024010120231231"} | ${"the end is the day before, in the year before"}
      ${"9999123100000101"} | ${"the whole range, reversed"}
    `("returns null for the reversed $value ($reads)", ({ value }) => {
      expect(parseEdifactDatePeriod(value, "718")).toBeNull();
    });
  });

  describe("fields are checked, not clamped (TC39 overflow: reject)", () => {
    it.each`
      value                 | reads
      ${"2023022920240620"} | ${"29 February 2023 in the start"}
      ${"2024061520240631"} | ${"31 June in the end"}
      ${"2024131520240620"} | ${"month 13 in the start"}
    `("returns null for $value ($reads)", ({ value }) => {
      expect(parseEdifactDatePeriod(value, "718")).toBeNull();
    });
  });

  describe("a code that does not state a period of dates", () => {
    it.each(edifactFormatsOutside("datePeriod"))(
      "returns null for code '$code' ($reads)",
      ({ code }) => {
        expect(
          parseEdifactDatePeriod("2024061520240620", code as never),
        ).toBeNull();
        expect(
          parseEdifactDatePeriod("240615240620", code as never),
        ).toBeNull();
        expect(parseEdifactDatePeriod("20240615", code as never)).toBeNull();
      },
    );
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => parseEdifactDatePeriod(bad as never, "718")}
      ${"format"} | ${(bad: unknown) => parseEdifactDatePeriod("2024061520240620", bad as never)}
    `("returns null for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBeNull();
      }
    });
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(parseEdifactDatePeriod("2024061520240620", "718")).toBeNull();
  });
});
