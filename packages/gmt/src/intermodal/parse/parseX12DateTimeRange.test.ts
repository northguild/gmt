import { expectTypeOf, vi } from "vitest";
import { NON_STRINGS, x12FormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { intervalLengthDateTime } from "../../plain/interval/intervalLengthDateTime";
import type { EdiDateTimePeriod } from "../../types/edi";
import { parseX12DateTimeRange } from "./parseX12DateTimeRange";

/**
 * Every expected value is read off the X12 data element 1250 mask by hand: `RDT` is
 * `CCYYMMDDHHMM-CCYYMMDDHHMM` and `DTS` is `CCYYMMDDHHMMSS-CCYYMMDDHHMMSS`, two local date-times
 * joined by the one hyphen X12 transmits.
 */
describe("parseX12DateTimeRange", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("RDT CCYYMMDDHHMM-CCYYMMDDHHMM and DTS CCYYMMDDHHMMSS-CCYYMMDDHHMMSS: a range between two local date-times", () => {
    it.each`
      code     | value                              | expected                                                        | reads
      ${"RDT"} | ${"202406151430-202406201600"}     | ${{ start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }} | ${"minutes: seconds are written as 00"}
      ${"RDT"} | ${"202406151430-202406151430"}     | ${{ start: "2024-06-15T14:30:00", end: "2024-06-15T14:30:00" }} | ${"zero length: the end equals the start"}
      ${"RDT"} | ${"202312312359-202401010000"}     | ${{ start: "2023-12-31T23:59:00", end: "2024-01-01T00:00:00" }} | ${"across a year end"}
      ${"DTS"} | ${"20240615143045-20240620160030"} | ${{ start: "2024-06-15T14:30:45", end: "2024-06-20T16:00:30" }} | ${"seconds: a range despite having no R"}
      ${"DTS"} | ${"20240615143045-20240615143046"} | ${{ start: "2024-06-15T14:30:45", end: "2024-06-15T14:30:46" }} | ${"one second"}
      ${"DTS"} | ${"00000101000000-99991231235959"} | ${{ start: "0000-01-01T00:00:00", end: "9999-12-31T23:59:59" }} | ${"the whole four-digit range"}
    `(
      "reads $code $value as $expected ($reads)",
      ({ code, value, expected }) => {
        expect(parseX12DateTimeRange(value, code)).toEqual(expected);
      },
    );

    it.each`
      code     | value                              | reads
      ${"RDT"} | ${"202406151430202406201600"}      | ${"no hyphen: UN/EDIFACT 719's wire form, never an X12 one"}
      ${"RDT"} | ${"202406151430--202406201600"}    | ${"two hyphens"}
      ${"RDT"} | ${"202406151430"}                  | ${"one date-time: DT's value"}
      ${"RDT"} | ${"20240615143045-20240620160030"} | ${"DTS's value under RDT"}
      ${"DTS"} | ${"202406151430-202406201600"}     | ${"RDT's value under DTS"}
      ${"RDT"} | ${"20240615-202406201600"}         | ${"DDT's value: a date and a date-time are not read"}
      ${"RDT"} | ${"202406151430-20240620"}         | ${"DTD's value: a date-time and a date are not read"}
      ${"RDT"} | ${"20240615-20240620"}             | ${"RD8's value: no times"}
      ${"RDT"} | ${""}                              | ${"an empty value"}
    `("returns null for $code $value ($reads)", ({ code, value }) => {
      expect(parseX12DateTimeRange(value, code)).toBeNull();
    });
  });

  describe("the result is two plain values, not a pair of instants", () => {
    it("is typed EdiDateTimePeriod, with both members always present", () => {
      expectTypeOf(
        parseX12DateTimeRange,
      ).returns.toEqualTypeOf<EdiDateTimePeriod | null>();
      expectTypeOf<EdiDateTimePeriod>().toEqualTypeOf<{
        start: string;
        end: string;
      }>();
    });

    // 14:30 on the 15th to 16:00 on the 20th is five days and ninety minutes: 5 × 1440 + 90.
    it("passes to the plain interval functions as (start, end)", () => {
      const period = parseX12DateTimeRange("202406151430-202406201600", "RDT");
      expect(
        period === null
          ? null
          : intervalLengthDateTime(period.start, period.end, "minute"),
      ).toBe(7290);
    });
  });

  describe("an end before its start names no span of time (GMT rule)", () => {
    it.each`
      code     | value                              | reads
      ${"RDT"} | ${"202406151431-202406151430"}     | ${"the end is one minute before the start"}
      ${"RDT"} | ${"202406201600-202406151430"}     | ${"the end is five days before the start"}
      ${"DTS"} | ${"20240615143001-20240615143000"} | ${"the end is one second before the start"}
    `(
      "returns null for the reversed $code $value ($reads)",
      ({ code, value }) => {
        expect(parseX12DateTimeRange(value, code)).toBeNull();
      },
    );
  });

  describe("fields are checked, not clamped (TC39 overflow: reject)", () => {
    it.each`
      code     | value                              | reads
      ${"RDT"} | ${"202302291430-202406201600"}     | ${"29 February 2023 in the start"}
      ${"RDT"} | ${"202406152430-202406201600"}     | ${"hour 24 in the start"}
      ${"DTS"} | ${"20240615143060-20240620160000"} | ${"second 60 in the start"}
      ${"DTS"} | ${"20240615143000-20240631160000"} | ${"31 June in the end"}
    `("returns null for $code $value ($reads)", ({ code, value }) => {
      expect(parseX12DateTimeRange(value, code)).toBeNull();
    });
  });

  describe("a code that does not state a range of date-times", () => {
    it.each(x12FormatsOutside("dateTimeRange"))(
      "returns null for code '$code' ($reads)",
      ({ code }) => {
        expect(
          parseX12DateTimeRange("202406151430-202406201600", code as never),
        ).toBeNull();
        expect(
          parseX12DateTimeRange("20240615-202406201600", code as never),
        ).toBeNull();
      },
    );
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => parseX12DateTimeRange(bad as never, "RDT")}
      ${"format"} | ${(bad: unknown) => parseX12DateTimeRange("202406151430-202406201600", bad as never)}
    `("returns null for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBeNull();
      }
    });
  });

  it("returns null when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      parseX12DateTimeRange("202406151430-202406201600", "RDT"),
    ).toBeNull();
  });
});
