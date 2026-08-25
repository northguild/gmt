import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { intervalLengthZoned } from "./intervalLengthZoned";

describe("intervalLengthZoned", () => {
  it.each`
    start                                            | end                                              | unit       | expected
    ${"2024-03-10T00:00:00-05:00[America/New_York]"} | ${"2024-03-11T00:00:00-04:00[America/New_York]"} | ${"hour"}  | ${23}
    ${"2024-03-10T00:00:00-05:00[America/New_York]"} | ${"2024-03-11T00:00:00-04:00[America/New_York]"} | ${"day"}   | ${1}
    ${"2024-11-03T00:00:00-04:00[America/New_York]"} | ${"2024-11-04T00:00:00-05:00[America/New_York]"} | ${"hour"}  | ${25}
    ${"2024-11-03T00:00:00-04:00[America/New_York]"} | ${"2024-11-04T00:00:00-05:00[America/New_York]"} | ${"day"}   | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-01-08T00:00:00+00:00[UTC]"}              | ${"week"}  | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-03-05T00:00:00+00:00[UTC]"}              | ${"month"} | ${2.129032258064516}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2025-01-01T00:00:00+00:00[UTC]"}              | ${"year"}  | ${1}
    ${"2024-02-29T00:00:00+00:00[UTC]"}              | ${"2024-03-01T00:00:00+00:00[UTC]"}              | ${"day"}   | ${1}
  `(
    "returns $expected $unit for $start..$end",
    ({ start, end, unit, expected }) => {
      expect(intervalLengthZoned(start, end, unit)).toBeCloseTo(expected, 9);
    },
  );

  it.each`
    start                               | end                                 | unit
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"day"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"hour"}
  `(
    "returns 0 for zero-length $start..$end in $unit",
    ({ start, end, unit }) => {
      expect(intervalLengthZoned(start, end, unit)).toBe(0);
    },
  );

  it.each`
    start                               | end                                 | unit
    ${"invalid"}                        | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
    ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"day"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"invalid"}
    ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
  `(
    "returns null for invalid $start, $end, or $unit",
    ({ start, end, unit }) => {
      expect(intervalLengthZoned(start, end, unit)).toBeNull();
    },
  );

  it.each`
    start   | end                                 | unit
    ${123}  | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
    ${null} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"day"}
  `("returns null for wrong-type start $start", ({ start, end, unit }) => {
    expect(intervalLengthZoned(start as never, end, unit)).toBeNull();
  });

  it("returns null when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalLengthZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-02T00:00:00+00:00[UTC]",
        "day",
      ),
    ).toBeNull();
  });

  it("proves zone-invariance across battleTestTimeZones for a fixed real-time span measured in hours", () => {
    const startInstant = Temporal.Instant.from("2024-06-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-06-01T05:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const start = startInstant.toZonedDateTimeISO(timeZone).toString();
      const end = endInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalLengthZoned(start, end, "hour")).toBe(5);
    }
  });
  // E5 (issue #78), decision of record D2 — see isValidZonedDateTime.test.ts for the full
  // rationale: zoned/ rejects any [u-ca=...] calendar annotation outright.
  it("returns null when start carries a calendar annotation", () => {
    expect(intervalLengthZoned("2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]", "2024-06-30T23:59:59+00:00[UTC]", "day")).toBeNull();
  });
});
