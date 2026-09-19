import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { intervalDifferenceZoned } from "./intervalDifferenceZoned";

describe("intervalDifferenceZoned", () => {
  // Half-open [start, end), as in `subtractIntervals`: touching intervals share no instant, so A minus
  // B is A whole, and every cut lands exactly on B's own start or end, keeping B's zone there (coding-standards § 8;
  // A = 2024-01-01T09:00Z, B = 12:00Z, C = 13:00Z, D = 17:00Z).
  it.each`
    aStart                              | aEnd                                | bStart                                           | bEnd                                             | expected                                                                                                                                                                                              | reason
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T13:00:00+00:00[UTC]"}              | ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T12:00:00+00:00[UTC]" }, { start: "2024-01-01T13:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" }]}                           | ${"[A, D) minus [B, C) is [A, B) and [C, D)"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${"2024-01-01T07:00:00-05:00[America/New_York]"} | ${"2024-01-01T08:00:00-05:00[America/New_York]"} | ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T07:00:00-05:00[America/New_York]" }, { start: "2024-01-01T08:00:00-05:00[America/New_York]", end: "2024-01-01T17:00:00+00:00[UTC]" }]} | ${"cuts from a New York B keep B's zone"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"}              | ${"2024-12-31T17:00:00+00:00[UTC]"}              | ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-06-30T12:00:00+00:00[UTC]" }]}                                                                                                               | ${"A ends where B starts"}
    ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-06-30T12:00:00+00:00[UTC]"}              | ${[{ start: "2024-06-30T12:00:00+00:00[UTC]", end: "2024-12-31T17:00:00+00:00[UTC]" }]}                                                                                                               | ${"A starts where B ends"}
    ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-01-01T10:00:00+00:00[UTC]"}              | ${[]}                                                                                                                                                                                                 | ${"empty A holds no instant"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${[{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" }]}                                                                                                               | ${"empty B strictly inside removes nothing"}
  `(
    "returns $expected for A=[$aStart, $aEnd) minus B=[$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceZoned(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${{ count: 2 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${{ count: 0 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${{ count: 1 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${{ count: 1 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2025-01-01T00:00:00+00:00[UTC]"} | ${"2025-06-01T00:00:00+00:00[UTC]"} | ${{ count: 1 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2023-06-01T00:00:00+00:00[UTC]"} | ${"2023-12-01T00:00:00+00:00[UTC]"} | ${{ count: 1 }}
    ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${{ count: 0 }}
  `(
    "returns $expected when A=$aStart to $aEnd, B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      const result = intervalDifferenceZoned(aStart, aEnd, bStart, bEnd);
      expect(result).toHaveLength(expected.count);
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | reason
    ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"reversed A"}
    ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"reversed B"}
    ${"invalid"}                        | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"invalid A start"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"invalid A end"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"invalid B start"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"invalid B end"}
    ${123}                              | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"wrong type A start"}
    ${null}                             | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"null A start"}
  `("returns [] for $reason", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalDifferenceZoned(aStart as any, aEnd, bStart, bEnd)).toEqual(
      [],
    );
  });

  // B entirely before A removes nothing from A: the remaining piece is A itself, never a piece that
  // starts one nanosecond after B ends, inside the gap between them. (The count-only row above for a
  // 2023 B cannot tell the two apart.)
  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-31T09:00:00+00:00[UTC]"} | ${[{ start: "2024-06-01T12:00:00+00:00[UTC]", end: "2024-06-30T12:00:00+00:00[UTC]" }]}
  `(
    "returns $expected for A=[$aStart, $aEnd] minus B=[$bStart, $bEnd] entirely before A",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalDifferenceZoned(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it("cuts interior boundaries exactly at B's own start and end — no nanosecond step, not rounded to the second", () => {
    // Half-open: the piece before B ends at B's start (excluded from it) and the piece after B starts
    // at B's end (excluded from B), so no boundary is stepped by a nanosecond.
    const result = intervalDifferenceZoned(
      "2024-01-01T09:00:00+00:00[UTC]",
      "2024-12-31T17:00:00+00:00[UTC]",
      "2024-06-01T12:00:00+00:00[UTC]",
      "2024-07-01T13:00:00+00:00[UTC]",
    );
    expect(result).toEqual([
      {
        start: "2024-01-01T09:00:00+00:00[UTC]",
        end: "2024-06-01T12:00:00+00:00[UTC]",
      },
      {
        start: "2024-07-01T13:00:00+00:00[UTC]",
        end: "2024-12-31T17:00:00+00:00[UTC]",
      },
    ]);
  });

  it("proves zone-invariance across battleTestTimeZones for interval difference", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T23:59:59Z");
    const bStartInstant = Temporal.Instant.from("2024-04-01T00:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-06-15T12:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalDifferenceZoned(aStart, aEnd, bStart, bEnd);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(
        Temporal.ZonedDateTime.from(result[0].start).toInstant().toString(),
      ).toBe(aStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[1].end).toInstant().toString(),
      ).toBe(aEndInstant.toString());
    }
  });

  it("returns [] when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalDifferenceZoned(
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-12-31T17:00:00+00:00[UTC]",
        "2024-06-01T12:00:00+00:00[UTC]",
        "2024-07-01T13:00:00+00:00[UTC]",
      ),
    ).toEqual([]);
  });

  it("proves zone-invariance across battleTestTimeZones for B fully inside A with gaps on both sides", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-06-01T12:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-07-01T13:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalDifferenceZoned(aStart, aEnd, bStart, bEnd);

      expect(result).toHaveLength(2);
      // First piece: A start to B start (excluded)
      expect(
        Temporal.ZonedDateTime.from(result[0].start).toInstant().toString(),
      ).toBe(aStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
      ).toBe(bStartInstant.toString());
      // Second piece: B end (which B excludes) to A end
      expect(
        Temporal.ZonedDateTime.from(result[1].start).toInstant().toString(),
      ).toBe(bEndInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[1].end).toInstant().toString(),
      ).toBe(aEndInstant.toString());
    }
  });

  it("proves zone-invariance across battleTestTimeZones for B fully covering A", () => {
    const aStartInstant = Temporal.Instant.from("2024-06-01T12:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-07-01T13:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalDifferenceZoned(aStart, aEnd, bStart, bEnd)).toEqual([]);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for B overlapping A start edge", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-06-15T12:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalDifferenceZoned(aStart, aEnd, bStart, bEnd);

      expect(result).toHaveLength(1);
      expect(
        Temporal.ZonedDateTime.from(result[0].start).toInstant().toString(),
      ).toBe(bEndInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
      ).toBe(aEndInstant.toString());
    }
  });

  it("proves zone-invariance across battleTestTimeZones for B overlapping A end edge", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-06-15T12:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalDifferenceZoned(aStart, aEnd, bStart, bEnd);

      expect(result).toHaveLength(1);
      expect(
        Temporal.ZonedDateTime.from(result[0].start).toInstant().toString(),
      ).toBe(aStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
      ).toBe(bStartInstant.toString());
    }
  });

  it("proves zone-invariance across battleTestTimeZones for B completely outside A", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const bStartInstant = Temporal.Instant.from("2025-01-01T00:00:00Z");
    const bEndInstant = Temporal.Instant.from("2025-06-01T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalDifferenceZoned(aStart, aEnd, bStart, bEnd);

      expect(result).toHaveLength(1);
      expect(
        Temporal.ZonedDateTime.from(result[0].start).toInstant().toString(),
      ).toBe(aStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
      ).toBe(aEndInstant.toString());
    }
  });

  it("proves zone-invariance across battleTestTimeZones for identical intervals", () => {
    const instant = Temporal.Instant.from("2024-06-15T12:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = instant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = instant.toZonedDateTimeISO(timeZone).toString();
      const bStart = instant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = instant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalDifferenceZoned(aStart, aEnd, bStart, bEnd)).toEqual([]);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for touching intervals (A minus B keeps A whole)", () => {
    // A ends at the instant B starts. Half-open, so A excludes that instant and B removes nothing.
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const sharedInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const result = intervalDifferenceZoned(
        aStartInstant.toZonedDateTimeISO(timeZone).toString(),
        sharedInstant.toZonedDateTimeISO(timeZone).toString(),
        sharedInstant.toZonedDateTimeISO(timeZone).toString(),
        bEndInstant.toZonedDateTimeISO(timeZone).toString(),
      );
      const instants = result.map(({ start, end }) => [
        Temporal.ZonedDateTime.from(start).toInstant().toString(),
        Temporal.ZonedDateTime.from(end).toInstant().toString(),
      ]);

      expect(instants).toEqual([
        [aStartInstant.toString(), sharedInstant.toString()],
      ]);
    }
  });

  // The arguments name different calendars (hebrew and a bare iso8601 string), so the
  // result is the sentinel (there is no single output calendar).
  it.each`
    aStart                                           | aEnd                                | bStart                                           | bEnd
    ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
  `(
    "returns [] for mixed calendars: $aStart, $aEnd, $bStart, $bEnd",
    ({
      aStart,
      aEnd,
      bStart,
      bEnd,
    }: {
      aStart: string;
      aEnd: string;
      bStart: string;
      bEnd: string;
    }) => {
      expect(intervalDifferenceZoned(aStart, aEnd, bStart, bEnd)).toEqual([]);
    },
  );
});
