import { vi } from "vitest";
import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { parseEdifactDatePeriod } from "../parse/parseEdifactDatePeriod";
import { formatEdifactDatePeriod } from "./formatEdifactDatePeriod";

/**
 * Every expected value is the two ISO 8601 dates placed under the UNTDID 2379 mask by hand:
 * `718` is `CCYYMMDD-CCYYMMDD`, run together with no hyphen on the wire.
 */
describe("formatEdifactDatePeriod", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("718 CCYYMMDD-CCYYMMDD: a period between two dates, written without a hyphen", () => {
    it.each`
      start           | end             | expected              | reads
      ${"2024-06-15"} | ${"2024-06-20"} | ${"2024061520240620"} | ${"five days"}
      ${"2024-06-15"} | ${"2024-06-15"} | ${"2024061520240615"} | ${"one day: the end equals the start"}
      ${"2023-12-31"} | ${"2024-01-01"} | ${"2023123120240101"} | ${"across a year end"}
      ${"2024-02-28"} | ${"2024-02-29"} | ${"2024022820240229"} | ${"into leap day 2024"}
      ${"0000-01-01"} | ${"9999-12-31"} | ${"0000010199991231"} | ${"the whole four-digit range"}
    `(
      "writes $start to $end as $expected ($reads), which reads back",
      ({ start, end, expected }) => {
        expect(formatEdifactDatePeriod(start, end, "718")).toBe(expected);
        expect(parseEdifactDatePeriod(expected, "718")).toEqual({ start, end });
      },
    );
  });

  describe("an end before its start names no span of time (GMT rule)", () => {
    it.each`
      start           | end             | reads
      ${"2024-06-20"} | ${"2024-06-15"} | ${"the end date is five days before the start"}
      ${"2024-01-01"} | ${"2023-12-31"} | ${"the end is the day before, in the year before"}
    `("returns '' for $start to $end ($reads)", ({ start, end }) => {
      expect(formatEdifactDatePeriod(start, end, "718")).toBe("");
    });
  });

  describe("each end is a date, as isValidDate accepts it", () => {
    it.each`
      start                      | end                   | reads
      ${"2024-06-15T14:30"}      | ${"2024-06-20"}       | ${"a date-time start: use formatEdifactDateTimePeriod"}
      ${"2024-06-15"}            | ${"2024-06-20T16:00"} | ${"a date-time end"}
      ${"2024-06-15T14:30:00Z"}  | ${"2024-06-20"}       | ${"an instant start"}
      ${"2024-06-15/2024-06-20"} | ${"2024-06-20"}       | ${"an interval string is not a start"}
      ${"2024-06-15"}            | ${"P5D"}              | ${"a duration is not an end"}
      ${"2024-06-15"}            | ${"2023-02-29"}       | ${"an end that is not a real date"}
      ${"2024-06-15"}            | ${"+010000-01-01"}    | ${"an end in year 10000"}
      ${"-000001-12-31"}         | ${"2024-06-15"}       | ${"a start before year 0000"}
      ${"20240615"}              | ${"20240620"}         | ${"basic format: the input is extended ISO 8601"}
      ${"2024-06-15"}            | ${""}                 | ${"an empty end"}
      ${""}                      | ${"2024-06-20"}       | ${"an empty start"}
    `("returns '' for $start to $end ($reads)", ({ start, end }) => {
      expect(formatEdifactDatePeriod(start, end, "718")).toBe("");
    });
  });

  describe("a code that does not state a period of dates", () => {
    it.each(edifactFormatsOutside("datePeriod"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(
          formatEdifactDatePeriod("2024-06-15", "2024-06-20", code as never),
        ).toBe("");
      },
    );
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"start"}  | ${(bad: unknown) => formatEdifactDatePeriod(bad as never, "2024-06-20", "718")}
      ${"end"}    | ${(bad: unknown) => formatEdifactDatePeriod("2024-06-15", bad as never, "718")}
      ${"format"} | ${(bad: unknown) => formatEdifactDatePeriod("2024-06-15", "2024-06-20", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  it("returns '' when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(formatEdifactDatePeriod("2024-06-15", "2024-06-20", "718")).toBe("");
  });
});
