import { expectTypeOf, vi } from "vitest";
import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { intervalLengthDateTime } from "../../plain/interval/intervalLengthDateTime";
import type { EdiDateTimePeriod } from "../../types/edi";
import { parseEdifactDateTimePeriod } from "./parseEdifactDateTimePeriod";

/**
 * Every expected value is read off the UNTDID 2379 mask by hand: `719` is
 * `CCYYMMDDHHMM-CCYYMMDDHHMM`, two local date-times run together with no hyphen on the wire.
 * Seconds are written `00`: the mask has none.
 */
describe("parseEdifactDateTimePeriod", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("719 CCYYMMDDHHMM-CCYYMMDDHHMM: a period between two local date-times", () => {
    it.each`
      value                         | expected                                                        | reads
      ${"202406151430202406201600"} | ${{ start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }} | ${"five days and ninety minutes"}
      ${"202406151430202406151430"} | ${{ start: "2024-06-15T14:30:00", end: "2024-06-15T14:30:00" }} | ${"zero length: the end equals the start"}
      ${"202406151430202406151431"} | ${{ start: "2024-06-15T14:30:00", end: "2024-06-15T14:31:00" }} | ${"one minute"}
      ${"202312312359202401010000"} | ${{ start: "2023-12-31T23:59:00", end: "2024-01-01T00:00:00" }} | ${"across a year end"}
      ${"000001010000999912312359"} | ${{ start: "0000-01-01T00:00:00", end: "9999-12-31T23:59:00" }} | ${"the whole four-digit range"}
    `("reads $value as $expected ($reads)", ({ value, expected }) => {
      expect(parseEdifactDateTimePeriod(value, "719")).toEqual(expected);
    });

    // UNTDID 2379, code 719, in every directory that has it: "Format of period to be given in
    // actual message without hyphen."
    it.each`
      value                           | reads
      ${"202406151430-202406201600"}  | ${"a hyphen: X12 RDT's wire form, never a 2379 one"}
      ${"202406151430--202406201600"} | ${"two hyphens"}
      ${"202406151430 202406201600"}  | ${"a space"}
      ${"202406151430"}               | ${"one date-time: 203's value"}
      ${"2024061520240620"}           | ${"718's value: no times"}
      ${"24061514302406201600"}       | ${"YYMMDDHHMM-YYMMDDHHMM: a two-digit year is not read"}
      ${"20240615143020240620160"}    | ${"one digit short"}
      ${""}                           | ${"an empty value"}
    `("returns null for $value ($reads)", ({ value }) => {
      expect(parseEdifactDateTimePeriod(value, "719")).toBeNull();
    });
  });

  describe("the result is two plain values, not a pair of instants", () => {
    it("is typed EdiDateTimePeriod, with both members always present", () => {
      expectTypeOf(
        parseEdifactDateTimePeriod,
      ).returns.toEqualTypeOf<EdiDateTimePeriod | null>();
      expectTypeOf<EdiDateTimePeriod>().toEqualTypeOf<{
        start: string;
        end: string;
      }>();
    });

    // 14:30 on the 15th to 16:00 on the 20th is five days and ninety minutes: 5 × 1440 + 90.
    it("passes to the plain interval functions as (start, end)", () => {
      const period = parseEdifactDateTimePeriod(
        "202406151430202406201600",
        "719",
      );
      expect(
        period === null
          ? null
          : intervalLengthDateTime(period.start, period.end, "minute"),
      ).toBe(7290);
    });
  });

  describe("an end before its start names no span of time (GMT rule)", () => {
    it.each`
      value                         | reads
      ${"202406151431202406151430"} | ${"the end is one minute before the start"}
      ${"202406201600202406151430"} | ${"the end is five days before the start"}
      ${"202406151430202406141600"} | ${"a later time of day on the day before"}
    `("returns null for the reversed $value ($reads)", ({ value }) => {
      expect(parseEdifactDateTimePeriod(value, "719")).toBeNull();
    });
  });

  describe("fields are checked, not clamped (TC39 overflow: reject)", () => {
    it.each`
      value                         | reads
      ${"202302291430202406201600"} | ${"29 February 2023 in the start"}
      ${"202406152430202406201600"} | ${"hour 24 in the start"}
      ${"202406151430202406201660"} | ${"minute 60 in the end"}
    `("returns null for $value ($reads)", ({ value }) => {
      expect(parseEdifactDateTimePeriod(value, "719")).toBeNull();
    });
  });

  describe("a code that does not state a period of date-times", () => {
    it.each(edifactFormatsOutside("dateTimePeriod"))(
      "returns null for code '$code' ($reads)",
      ({ code }) => {
        expect(
          parseEdifactDateTimePeriod("202406151430202406201600", code as never),
        ).toBeNull();
        expect(
          parseEdifactDateTimePeriod("24061514302406201600", code as never),
        ).toBeNull();
      },
    );
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => parseEdifactDateTimePeriod(bad as never, "719")}
      ${"format"} | ${(bad: unknown) => parseEdifactDateTimePeriod("202406151430202406201600", bad as never)}
    `("returns null for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBeNull();
      }
    });
  });

  it("returns null when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      parseEdifactDateTimePeriod("202406151430202406201600", "719"),
    ).toBeNull();
  });
});
