import { vi } from "vitest";
import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { parseEdifactDateTimePeriod } from "../parse/parseEdifactDateTimePeriod";
import { formatEdifactDateTimePeriod } from "./formatEdifactDateTimePeriod";

/**
 * Every expected value is the two ISO 8601 date-times placed under the UNTDID 2379 mask by
 * hand: `719` is `CCYYMMDDHHMM-CCYYMMDDHHMM`, run together with no hyphen on the wire. The mask
 * has no seconds, so each end is cut to its minute.
 */
describe("formatEdifactDateTimePeriod", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("719 CCYYMMDDHHMM-CCYYMMDDHHMM: a period between two local date-times", () => {
    // `readsBack` is each end cut to the minute, which the parser returns.
    it.each`
      start                    | end                        | expected                      | readsBack                                                       | reads
      ${"2024-06-15T14:30:00"} | ${"2024-06-20T16:00:00"}   | ${"202406151430202406201600"} | ${{ start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }} | ${"whole minutes"}
      ${"2024-06-15T14:30"}    | ${"2024-06-20T16:00"}      | ${"202406151430202406201600"} | ${{ start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }} | ${"no seconds given"}
      ${"2024-06-15T14:30:45"} | ${"2024-06-20T16:00:59.5"} | ${"202406151430202406201600"} | ${{ start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }} | ${"seconds and a fraction are dropped from both ends"}
      ${"2024-06-15T14:30:00"} | ${"2024-06-15T14:30:00"}   | ${"202406151430202406151430"} | ${{ start: "2024-06-15T14:30:00", end: "2024-06-15T14:30:00" }} | ${"zero length"}
      ${"2024-06-15T14:30:10"} | ${"2024-06-15T14:30:45"}   | ${"202406151430202406151430"} | ${{ start: "2024-06-15T14:30:00", end: "2024-06-15T14:30:00" }} | ${"35 seconds inside one minute: both ends are that minute"}
      ${"0000-01-01T00:00:00"} | ${"9999-12-31T23:59:59"}   | ${"000001010000999912312359"} | ${{ start: "0000-01-01T00:00:00", end: "9999-12-31T23:59:00" }} | ${"the whole four-digit range"}
    `(
      "writes $start to $end as $expected ($reads), which reads back as $readsBack",
      ({ start, end, expected, readsBack }) => {
        expect(formatEdifactDateTimePeriod(start, end, "719")).toBe(expected);
        expect(parseEdifactDateTimePeriod(expected, "719")).toEqual(readsBack);
      },
    );
  });

  describe("an end before its start names no span of time (GMT rule)", () => {
    // The ends are compared as given, before either is cut to the minute.
    it.each`
      start                    | end                      | reads
      ${"2024-06-15T14:31:00"} | ${"2024-06-15T14:30:00"} | ${"the end is one minute before the start"}
      ${"2024-06-20T16:00:00"} | ${"2024-06-15T14:30:00"} | ${"the end is five days before the start"}
      ${"2024-06-15T14:30:45"} | ${"2024-06-15T14:30:10"} | ${"the end is 35 seconds before the start, inside one minute"}
    `("returns '' for $start to $end ($reads)", ({ start, end }) => {
      expect(formatEdifactDateTimePeriod(start, end, "719")).toBe("");
    });
  });

  describe("each end is a local date-time, as isValidDateTime accepts it", () => {
    it.each`
      start                     | end                       | reads
      ${"2024-06-15"}           | ${"2024-06-20"}           | ${"dates: use formatEdifactDatePeriod"}
      ${"2024-06-15T14:30"}     | ${"2024-06-20"}           | ${"a date end"}
      ${"2024-06-15T14:30:00Z"} | ${"2024-06-20T16:00:00Z"} | ${"instants: the code holds no offset"}
      ${"2024-06-15T14:30"}     | ${"2023-02-29T16:00"}     | ${"an end that is not a real date"}
      ${"2024-06-15T14:30"}     | ${"+010000-01-01T00:00"}  | ${"an end in year 10000"}
      ${"2024-06-15T14:30"}     | ${"PT5H"}                 | ${"a duration is not an end"}
      ${"2024-06-15T14:30"}     | ${""}                     | ${"an empty end"}
    `("returns '' for $start to $end ($reads)", ({ start, end }) => {
      expect(formatEdifactDateTimePeriod(start, end, "719")).toBe("");
    });
  });

  describe("a code that does not state a period of date-times", () => {
    it.each(edifactFormatsOutside("dateTimePeriod"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(
          formatEdifactDateTimePeriod(
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
      ${"start"}  | ${(bad: unknown) => formatEdifactDateTimePeriod(bad as never, "2024-06-20T16:00", "719")}
      ${"end"}    | ${(bad: unknown) => formatEdifactDateTimePeriod("2024-06-15T14:30", bad as never, "719")}
      ${"format"} | ${(bad: unknown) => formatEdifactDateTimePeriod("2024-06-15T14:30", "2024-06-20T16:00", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  it("returns '' when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      formatEdifactDateTimePeriod(
        "2024-06-15T14:30",
        "2024-06-20T16:00",
        "719",
      ),
    ).toBe("");
  });
});
