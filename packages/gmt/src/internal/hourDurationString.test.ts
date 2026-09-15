import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalDurationFromThrow } from "../test/mocks";
import { formatHourDuration } from "./hourDurationString";

describe("formatHourDuration", () => {
  // By hand, 1 h = 3 600 000 000 000 ns: 49.5 h = 178 200 000 000 000 ns (+1 ns);
  // 2^53 + 1 = 9 007 199 254 740 993 = 2501 h (9 003 600 000 000 000) + 59 min (3 540 000 000 000)
  // + 59 s + 254 740 993 ns; 1.728 × 10^22 ns / 3.6 × 10^12 = 4.8 × 10^9 h.
  // The second table checks each against Temporal's own Instant.until, never this formatter.
  it.each`
    nanoseconds                 | expected                     | reason
    ${0n}                       | ${"PT0S"}                    | ${"zero"}
    ${178200000000001n}         | ${"PT49H30M0.000000001S"}    | ${"hours, minutes and 1 ns"}
    ${2n ** 53n + 1n}           | ${"PT2501H59M59.254740993S"} | ${"past 2^53, where Number would lose the last ns"}
    ${17280000000000000000000n} | ${"PT4800000000H"}           | ${"the full Instant range"}
  `(
    "formats $nanoseconds ns as $expected ($reason)",
    ({ nanoseconds, expected }) => {
      expect(formatHourDuration(nanoseconds)).toBe(expected);
    },
  );

  it.each`
    start                        | end
    ${"2024-01-01T00:00:00Z"}    | ${"2024-01-03T01:30:00.000000001Z"}
    ${"1970-01-01T00:00:00Z"}    | ${"1970-04-15T05:59:59.254740993Z"}
    ${"-271821-04-20T00:00:00Z"} | ${"+275760-09-13T00:00:00Z"}
  `(
    "matches Instant.until with largestUnit hour from $start to $end",
    ({ start, end }) => {
      const from = Temporal.Instant.from(start);
      const to = Temporal.Instant.from(end);

      expect(
        formatHourDuration(to.epochNanoseconds - from.epochNanoseconds),
      ).toBe(from.until(to, { largestUnit: "hour" }).toString());
    },
  );

  it("returns an empty string for a negative count", () => {
    expect(formatHourDuration(-1n)).toBe("");
  });

  it("returns an empty string when Temporal.Duration.from throws", () => {
    mockTemporalDurationFromThrow();

    expect(formatHourDuration(1n)).toBe("");
  });
});
