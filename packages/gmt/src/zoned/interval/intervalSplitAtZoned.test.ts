import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { intervalSplitAtZoned } from "./intervalSplitAtZoned";

describe("intervalSplitAtZoned", () => {
  it("splits at a single in-range point", () => {
    expect(
      intervalSplitAtZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-10T00:00:00+00:00[UTC]",
        ["2024-01-05T00:00:00+00:00[UTC]"],
      ),
    ).toEqual([
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-01-05T00:00:00+00:00[UTC]",
      },
      {
        start: "2024-01-05T00:00:00+00:00[UTC]",
        end: "2024-01-10T00:00:00+00:00[UTC]",
      },
    ]);
  });

  it("sorts unsorted points (by instant) before splitting into 3+ segments", () => {
    const result = intervalSplitAtZoned(
      "2024-01-01T00:00:00+00:00[UTC]",
      "2024-01-10T00:00:00+00:00[UTC]",
      ["2024-01-07T00:00:00+00:00[UTC]", "2024-01-03T00:00:00+00:00[UTC]"],
    );
    expect(result).toEqual([
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-01-03T00:00:00+00:00[UTC]",
      },
      {
        start: "2024-01-03T00:00:00+00:00[UTC]",
        end: "2024-01-07T00:00:00+00:00[UTC]",
      },
      {
        start: "2024-01-07T00:00:00+00:00[UTC]",
        end: "2024-01-10T00:00:00+00:00[UTC]",
      },
    ]);
  });

  it("drops points outside the interval", () => {
    expect(
      intervalSplitAtZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-10T00:00:00+00:00[UTC]",
        ["2024-06-01T00:00:00+00:00[UTC]"],
      ),
    ).toEqual([
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-01-10T00:00:00+00:00[UTC]",
      },
    ]);
  });

  it("drops points exactly on the boundaries (same instant as start/end)", () => {
    expect(
      intervalSplitAtZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-10T00:00:00+00:00[UTC]",
        ["2024-01-01T00:00:00+00:00[UTC]", "2024-01-10T00:00:00+00:00[UTC]"],
      ),
    ).toEqual([
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-01-10T00:00:00+00:00[UTC]",
      },
    ]);
  });

  it("collapses duplicate-instant points (same wall clock) to a single boundary", () => {
    expect(
      intervalSplitAtZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-10T00:00:00+00:00[UTC]",
        ["2024-01-05T00:00:00+00:00[UTC]", "2024-01-05T00:00:00+00:00[UTC]"],
      ),
    ).toEqual([
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-01-05T00:00:00+00:00[UTC]",
      },
      {
        start: "2024-01-05T00:00:00+00:00[UTC]",
        end: "2024-01-10T00:00:00+00:00[UTC]",
      },
    ]);
  });

  it("collapses duplicate points expressed via different time zones (same instant)", () => {
    const result = intervalSplitAtZoned(
      "2024-01-01T00:00:00+00:00[UTC]",
      "2024-01-10T00:00:00+00:00[UTC]",
      [
        "2024-01-05T00:00:00+00:00[UTC]",
        "2024-01-05T00:00:00-05:00[America/New_York]", // 2024-01-05T05:00:00Z, a different instant
      ],
    );
    expect(result).toHaveLength(3);
  });

  it("splits using instant comparison even when the point carries a different time zone", () => {
    const result = intervalSplitAtZoned(
      "2024-01-01T00:00:00+00:00[UTC]",
      "2024-01-10T00:00:00+00:00[UTC]",
      ["2024-01-05T00:00:00-05:00[America/New_York]"],
    );
    expect(result).toHaveLength(2);
    expect(
      Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
    ).toBe("2024-01-05T05:00:00Z");
  });

  it("returns the whole interval unsplit for an empty points array", () => {
    expect(
      intervalSplitAtZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-10T00:00:00+00:00[UTC]",
        [],
      ),
    ).toEqual([
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-01-10T00:00:00+00:00[UTC]",
      },
    ]);
  });

  it.each`
    start                               | end
    ${"invalid"}                        | ${"2024-01-10T00:00:00+00:00[UTC]"}
    ${"2024-01-10T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}
    ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2024-01-10T00:00:00+00:00[UTC]"}
  `("returns [] for invalid $start, $end", ({ start, end }) => {
    expect(
      intervalSplitAtZoned(start, end, ["2024-01-05T00:00:00+00:00[UTC]"]),
    ).toEqual([]);
  });

  it.each`
    points
    ${"not-an-array"}
    ${["not-a-zoneddatetime"]}
    ${["2024-01-05T00:00:00Z"]}
    ${["2024-06-30T23:59:60+00:00[UTC]"]}
    ${[123]}
    ${[null]}
  `("returns [] for invalid points $points", ({ points }) => {
    expect(
      intervalSplitAtZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-10T00:00:00+00:00[UTC]",
        points,
      ),
    ).toEqual([]);
  });

  it("proves zone-invariance across battleTestTimeZones for split point", () => {
    const startInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-06-30T23:59:59Z");
    const pointInstant = Temporal.Instant.from("2024-03-15T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const start = startInstant.toZonedDateTimeISO(timeZone).toString();
      const end = endInstant.toZonedDateTimeISO(timeZone).toString();
      const point = pointInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalSplitAtZoned(start, end, [point]);
      expect(result).toHaveLength(2);
      expect(
        Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
      ).toBe(pointInstant.toString());
    }
  });

  it("returns [] when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalSplitAtZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-10T00:00:00+00:00[UTC]",
        ["2024-01-05T00:00:00+00:00[UTC]"],
      ),
    ).toEqual([]);
  });

  it("proves zone-invariance across battleTestTimeZones", () => {
    const startInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-01-10T00:00:00Z");
    const pointInstant = Temporal.Instant.from("2024-01-05T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const start = startInstant.toZonedDateTimeISO(timeZone).toString();
      const end = endInstant.toZonedDateTimeISO(timeZone).toString();
      const point = pointInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalSplitAtZoned(start, end, [point]);
      expect(result).toHaveLength(2);
      expect(
        Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
      ).toBe(pointInstant.toString());
    }
  });

  it("splits at a wall-clock time that falls in the America/Chicago spring-forward gap", () => {
    // Verified against real Temporal: wall clock 2024-03-10T02:30:00 does not exist in
    // America/Chicago (clocks jump 02:00 -> 03:00); Temporal.ZonedDateTime.from resolves it
    // forward (compatible disambiguation) to 2024-03-10T03:30:00-05:00[America/Chicago].
    const start = "2024-03-10T00:00:00-06:00[America/Chicago]";
    const end = "2024-03-10T06:00:00-05:00[America/Chicago]";
    const gapPoint = "2024-03-10T02:30:00[America/Chicago]";

    const result = intervalSplitAtZoned(start, end, [gapPoint]);

    expect(result).toEqual([
      { start, end: "2024-03-10T03:30:00-05:00[America/Chicago]" },
      { start: "2024-03-10T03:30:00-05:00[America/Chicago]", end },
    ]);
  });

  it("treats America/Chicago fall-back points with the same wall clock but different offsets as distinct instants", () => {
    // Verified against real Temporal: 2024-11-03T01:30:00 occurs twice in America/Chicago
    // (clocks fall back 02:00 -> 01:00). The -05:00 occurrence (before the fold) is
    // 2024-11-03T06:30:00Z; the -06:00 occurrence (after the fold) is 2024-11-03T07:30:00Z.
    const start = "2024-11-03T00:00:00-05:00[America/Chicago]";
    const end = "2024-11-03T04:00:00-06:00[America/Chicago]";
    const earlierFold = "2024-11-03T01:30:00-05:00[America/Chicago]";
    const laterFold = "2024-11-03T01:30:00-06:00[America/Chicago]";

    const result = intervalSplitAtZoned(start, end, [laterFold, earlierFold]);

    expect(result).toEqual([
      { start, end: earlierFold },
      { start: earlierFold, end: laterFold },
      { start: laterFold, end },
    ]);
  });
  // E5 (issue #78), decision of record D2 — see isValidZonedDateTime.test.ts for the full
  // rationale: zoned/ rejects any [u-ca=...] calendar annotation outright.
  it("returns [] when start carries a calendar annotation", () => {
    expect(
      intervalSplitAtZoned(
        "2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]",
        "2024-06-30T23:59:59+00:00[UTC]",
        [],
      ),
    ).toEqual([]);
  });
});
