import { sameInstantBattleCases } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { spanMs } from "./spanMs";
import { spanNs } from "./spanNs";

/** The last instant whose span from the earliest representable one still fits a safe integer of milliseconds. */
const maxSafeMillisecondEnd = "+013606-01-30T08:59:00.991Z";
/** One millisecond past it. */
const firstUnsafeMillisecondEnd = "+013606-01-30T08:59:00.992Z";
const earliestInstant = "-271821-04-20T00:00:00Z";

describe("spanMs", () => {
  it.each`
    start                                            | end                       | expected
    ${"2024-03-10T12:00:00Z"}                        | ${"2024-03-10T12:00:00Z"} | ${0}
    ${"2024-03-10T12:00:00Z"}                        | ${"2024-03-10T12:00:01Z"} | ${1000}
    ${"2024-03-10T12:00:01Z"}                        | ${"2024-03-10T12:00:00Z"} | ${-1000}
    ${"1969-12-31T23:59:59Z"}                        | ${"1970-01-01T00:00:00Z"} | ${1000}
    ${"1970-01-01T00:00:00Z"}                        | ${"1969-12-31T23:59:59Z"} | ${-1000}
    ${"2024-03-10T12:00:00-05:00"}                   | ${"2024-03-10T12:00:00Z"} | ${-18000000}
    ${"2024-03-10T07:00:00-05:00[America/New_York]"} | ${"2024-03-10T12:00:00Z"} | ${0}
    ${"2024-02-29T00:00:00Z"}                        | ${"2024-03-01T00:00:00Z"} | ${86400000}
  `(
    "returns $expected milliseconds from $start to $end",
    ({ start, end, expected }) => {
      expect(spanMs(start, end)).toBe(expected);
    },
  );

  it.each`
    start                               | end                                 | expected
    ${"2024-03-10T12:00:00Z"}           | ${"2024-03-10T12:00:00.0005Z"}      | ${0.5}
    ${"2024-03-10T12:00:00Z"}           | ${"2024-03-10T12:00:00.000000001Z"} | ${0.000001}
    ${"2024-03-10T12:00:00.000000001Z"} | ${"2024-03-10T12:00:00Z"}           | ${-0.000001}
    ${"2024-03-10T12:00:00Z"}           | ${"2024-03-10T12:00:00.123456789Z"} | ${123.456789}
    ${"2024-03-10T12:00:00.123456789Z"} | ${"2024-03-10T12:00:00Z"}           | ${-123.456789}
  `(
    "returns the fractional millisecond span $expected from $start to $end",
    ({ start, end, expected }) => {
      expect(spanMs(start, end)).toBe(expected);
    },
  );

  it.each`
    start                                               | end                                                 | expected    | transition
    ${"2024-03-09T12:00:00-05:00[America/New_York]"}    | ${"2024-03-10T12:00:00-04:00[America/New_York]"}    | ${82800000} | ${"spring forward"}
    ${"2024-11-02T12:00:00-04:00[America/New_York]"}    | ${"2024-11-03T12:00:00-05:00[America/New_York]"}    | ${90000000} | ${"fall back"}
    ${"2024-04-06T12:00:00+13:45[Pacific/Chatham]"}     | ${"2024-04-07T12:00:00+12:45[Pacific/Chatham]"}     | ${90000000} | ${"quarter-hour zone fall back"}
    ${"2024-04-06T12:00:00+11:00[Australia/Lord_Howe]"} | ${"2024-04-07T12:00:00+10:30[Australia/Lord_Howe]"} | ${88200000} | ${"half-hour transition"}
  `(
    "measures exact elapsed time, not a wall-clock day, across $transition",
    ({ start, end, expected }) => {
      expect(spanMs(start, end)).toBe(expected);
      expect(spanMs(start, end)).not.toBe(86400000);
    },
  );

  it.each`
    start                    | end                      | expected
    ${earliestInstant}       | ${maxSafeMillisecondEnd} | ${Number.MAX_SAFE_INTEGER}
    ${maxSafeMillisecondEnd} | ${earliestInstant}       | ${-Number.MAX_SAFE_INTEGER}
  `(
    "returns $expected at the safe-integer millisecond boundary",
    ({ start, end, expected }) => {
      expect(spanMs(start, end)).toBe(expected);
    },
  );

  it.each`
    start                                  | end                                    | reason
    ${earliestInstant}                     | ${firstUnsafeMillisecondEnd}           | ${"one millisecond past the safe-integer ceiling"}
    ${firstUnsafeMillisecondEnd}           | ${earliestInstant}                     | ${"one millisecond past the floor"}
    ${earliestInstant}                     | ${"+275760-09-13T00:00:00Z"}           | ${"the full representable-instant range"}
    ${earliestInstant}                     | ${"+013606-01-30T08:59:00.991000001Z"} | ${"the safe-integer millisecond plus one nanosecond"}
    ${earliestInstant}                     | ${"+013606-01-30T08:59:00.991999999Z"} | ${"a sub-millisecond fraction that would round up to 2^53"}
    ${"+013606-01-30T08:59:00.991999999Z"} | ${earliestInstant}                     | ${"the same fraction, negated"}
  `(
    "returns NaN when the span overflows a safe integer of milliseconds ($reason)",
    ({ start, end }) => {
      expect(spanMs(start, end)).toBeNaN();
    },
  );

  it("never returns a number above Number.MAX_SAFE_INTEGER", () => {
    // The guard is on the exact span, not the truncated whole-millisecond part:
    // MAX_SAFE_INTEGER ms plus a fraction recombines to 2^53, which is not a safe integer.
    expect(
      spanMs(earliestInstant, "+013606-01-30T08:59:00.991999999Z"),
    ).toBeNaN();
    expect(spanMs(earliestInstant, maxSafeMillisecondEnd)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(
      Number.isSafeInteger(spanMs(earliestInstant, maxSafeMillisecondEnd)),
    ).toBe(true);
  });

  it("returns an exact value from spanNs where spanMs overflows", () => {
    expect(spanMs(earliestInstant, "+275760-09-13T00:00:00Z")).toBeNaN();
    expect(spanNs(earliestInstant, "+275760-09-13T00:00:00Z")).toBe(
      17280000000000000000000n,
    );
  });

  it.each`
    start                     | end
    ${"2024-03-10T12:00:00Z"} | ${"2024-09-01T08:17:03.123456789Z"}
    ${"2024-09-01T08:17:03Z"} | ${"2024-03-10T12:00:00Z"}
  `("negates when $start and $end are swapped", ({ start, end }) => {
    expect(spanMs(end, start)).toBe(-spanMs(start, end));
  });

  it.each(sameInstantBattleCases)(
    "returns 0 between 2024-02-29T00:00:00Z and the same instant in $timeZone",
    ({ value }) => {
      expect(spanMs("2024-02-29T00:00:00Z", value)).toBe(0);
      expect(spanMs(value, "2024-02-29T00:00:00Z")).toBe(0);
    },
  );

  it.each`
    start                                       | end                                         | reason
    ${"invalid"}                                | ${"2024-03-10T12:00:00Z"}                   | ${"unparseable start"}
    ${"2024-03-10T12:00:00Z"}                   | ${"invalid"}                                | ${"unparseable end"}
    ${"2024-03-10"}                             | ${"2024-03-11"}                             | ${"date-only, no offset"}
    ${"2024-03-10T12:00:00"}                    | ${"2024-03-11T12:00:00"}                    | ${"no offset designator"}
    ${"2024-03-10T12:00:00[America/New_York]"}  | ${"2024-03-11T12:00:00[America/New_York]"}  | ${"bracketed zone but no offset designator"}
    ${"2016-12-31T23:59:60Z"}                   | ${"2017-01-01T00:00:00Z"}                   | ${"leap second start"}
    ${"20161231 235960Z"}                       | ${"2017-01-01T00:00:00Z"}                   | ${"leap second, basic format and space"}
    ${"2024-03-10T12:00:00-05:00[u-ca=hebrew]"} | ${"2024-03-11T12:00:00-04:00"}              | ${"calendar annotation on start"}
    ${"2024-03-10T12:00:00Z"}                   | ${"2024-03-11T12:00:00-05:00[u-ca=hebrew]"} | ${"calendar annotation on end"}
    ${"+275760-09-13T00:00:00.001Z"}            | ${"2024-03-10T12:00:00Z"}                   | ${"start past the representable range"}
    ${"2024-03-10T12:00:00Z"}                   | ${"-271821-04-19T23:59:59Z"}                | ${"end before the representable range"}
    ${""}                                       | ${"2024-03-10T12:00:00Z"}                   | ${"empty string"}
  `("returns NaN when the pair is invalid ($reason)", ({ start, end }) => {
    expect(spanMs(start, end)).toBeNaN();
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${1710072000123456789n}
    ${true}
    ${[]}
    ${{}}
  `("returns NaN when $value is non-string input", ({ value }) => {
    expect(
      spanMs(value as unknown as string, "2024-03-10T12:00:00Z"),
    ).toBeNaN();
    expect(
      spanMs("2024-03-10T12:00:00Z", value as unknown as string),
    ).toBeNaN();
  });

  it("returns NaN when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();

    expect(spanMs("2024-03-10T12:00:00Z", "2024-03-10T12:00:01Z")).toBeNaN();
  });
});
