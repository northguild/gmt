import { vi } from "vitest";
import { NON_STRINGS, x12FormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { parseX12DateTimeRange } from "../parse/parseX12DateTimeRange";
import { formatX12DateTimeRange } from "./formatX12DateTimeRange";

/**
 * Every expected value is the two ISO 8601 date-times placed under the X12 1250 mask by hand:
 * `RDT` is `CCYYMMDDHHMM-CCYYMMDDHHMM` and `DTS` is `CCYYMMDDHHMMSS-CCYYMMDDHHMMSS`, joined by
 * one hyphen. What a mask has no field for is left out of both ends, never rounded.
 */
describe("formatX12DateTimeRange", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("RDT and DTS: a range between two local date-times, written with its hyphen", () => {
    // `readsBack` is each end cut to the mask's smallest field, which the parser returns.
    it.each`
      code     | start                    | end                        | expected                           | readsBack                                                       | reads
      ${"RDT"} | ${"2024-06-15T14:30:00"} | ${"2024-06-20T16:00:00"}   | ${"202406151430-202406201600"}     | ${{ start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }} | ${"whole minutes"}
      ${"RDT"} | ${"2024-06-15T14:30:45"} | ${"2024-06-20T16:00:59.5"} | ${"202406151430-202406201600"}     | ${{ start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }} | ${"seconds and a fraction are dropped from both ends"}
      ${"RDT"} | ${"2024-06-15T14:30:10"} | ${"2024-06-15T14:30:45"}   | ${"202406151430-202406151430"}     | ${{ start: "2024-06-15T14:30:00", end: "2024-06-15T14:30:00" }} | ${"35 seconds inside one minute: both ends are that minute"}
      ${"DTS"} | ${"2024-06-15T14:30:45"} | ${"2024-06-20T16:00:30"}   | ${"20240615143045-20240620160030"} | ${{ start: "2024-06-15T14:30:45", end: "2024-06-20T16:00:30" }} | ${"seconds"}
      ${"DTS"} | ${"2024-06-15T14:30"}    | ${"2024-06-15T14:30:45.9"} | ${"20240615143000-20240615143045"} | ${{ start: "2024-06-15T14:30:00", end: "2024-06-15T14:30:45" }} | ${"no seconds given, and a fraction dropped"}
      ${"DTS"} | ${"0000-01-01T00:00:00"} | ${"9999-12-31T23:59:59"}   | ${"00000101000000-99991231235959"} | ${{ start: "0000-01-01T00:00:00", end: "9999-12-31T23:59:59" }} | ${"the whole four-digit range"}
    `(
      "writes $start to $end under $code as $expected ($reads), which reads back as $readsBack",
      ({ code, start, end, expected, readsBack }) => {
        expect(formatX12DateTimeRange(start, end, code)).toBe(expected);
        expect(parseX12DateTimeRange(expected, code)).toEqual(readsBack);
      },
    );
  });

  describe("an end before its start names no span of time (GMT rule)", () => {
    // The ends are compared as given, before either is cut to the mask.
    it.each`
      code     | start                      | end                        | reads
      ${"RDT"} | ${"2024-06-15T14:31:00"}   | ${"2024-06-15T14:30:00"}   | ${"the end is one minute before the start"}
      ${"RDT"} | ${"2024-06-15T14:30:45"}   | ${"2024-06-15T14:30:10"}   | ${"the end is 35 seconds before the start, inside one minute"}
      ${"DTS"} | ${"2024-06-15T14:30:01"}   | ${"2024-06-15T14:30:00"}   | ${"the end is one second before the start"}
      ${"DTS"} | ${"2024-06-15T14:30:00.5"} | ${"2024-06-15T14:30:00.1"} | ${"the end is four tenths of a second before the start, inside one second"}
    `(
      "returns '' for $start to $end under $code ($reads)",
      ({ code, start, end }) => {
        expect(formatX12DateTimeRange(start, end, code)).toBe("");
      },
    );
  });

  describe("each end is a local date-time, as isValidDateTime accepts it", () => {
    it.each`
      start                     | end                       | reads
      ${"2024-06-15"}           | ${"2024-06-20"}           | ${"dates: use formatX12DateRange"}
      ${"2024-06-15"}           | ${"2024-06-20T16:00"}     | ${"a date start: DDT is not written"}
      ${"2024-06-15T14:30"}     | ${"2024-06-20"}           | ${"a date end: DTD is not written"}
      ${"2024-06-15T14:30:00Z"} | ${"2024-06-20T16:00:00Z"} | ${"instants: no 1250 code carries an offset"}
      ${"2024-06-15T14:30"}     | ${"2023-02-29T16:00"}     | ${"an end that is not a real date"}
      ${"2024-06-15T14:30"}     | ${"+010000-01-01T00:00"}  | ${"an end in year 10000"}
      ${"2024-06-15T14:30"}     | ${""}                     | ${"an empty end"}
    `("returns '' for $start to $end ($reads)", ({ start, end }) => {
      expect(formatX12DateTimeRange(start, end, "RDT")).toBe("");
      expect(formatX12DateTimeRange(start, end, "DTS")).toBe("");
    });
  });

  describe("a code that does not state a range of date-times", () => {
    it.each(x12FormatsOutside("dateTimeRange"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(
          formatX12DateTimeRange(
            "2024-06-15T14:30",
            "2024-06-20T16:00",
            code as never,
          ),
        ).toBe("");
      },
    );
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"start"}  | ${(bad: unknown) => formatX12DateTimeRange(bad as never, "2024-06-20T16:00", "RDT")}
      ${"end"}    | ${(bad: unknown) => formatX12DateTimeRange("2024-06-15T14:30", bad as never, "RDT")}
      ${"format"} | ${(bad: unknown) => formatX12DateTimeRange("2024-06-15T14:30", "2024-06-20T16:00", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  it("returns '' when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      formatX12DateTimeRange("2024-06-15T14:30", "2024-06-20T16:00", "RDT"),
    ).toBe("");
  });
});
