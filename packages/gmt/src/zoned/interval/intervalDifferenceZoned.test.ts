import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { intervalDifferenceZoned } from "./intervalDifferenceZoned";

describe("intervalDifferenceZoned", () => {
  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${{ count: 2 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${{ count: 0 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${{ count: 1 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${{ count: 1 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2025-01-01T00:00:00+00:00[UTC]"} | ${"2025-06-01T00:00:00+00:00[UTC]"} | ${{ count: 1 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2023-06-01T00:00:00+00:00[UTC]"} | ${"2023-12-01T00:00:00+00:00[UTC]"} | ${{ count: 1 }}
    ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${{ count: 0 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${{ count: 2 }}
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
      // First piece: A start to just before B start (nanosecond precision)
      expect(
        Temporal.ZonedDateTime.from(result[0].start).toInstant().toString(),
      ).toBe(aStartInstant.toString());
      const firstEndInstant = Temporal.ZonedDateTime.from(
        result[0].end,
      ).toInstant();
      expect(
        Temporal.Instant.compare(firstEndInstant, bStartInstant),
      ).toBeLessThan(0);
      // Second piece: just after B end to A end
      const secondStartInstant = Temporal.ZonedDateTime.from(
        result[1].start,
      ).toInstant();
      expect(
        Temporal.Instant.compare(secondStartInstant, bEndInstant),
      ).toBeGreaterThan(0);
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
      const startEdgeStartInstant = Temporal.ZonedDateTime.from(
        result[0].start,
      ).toInstant();
      expect(
        Temporal.Instant.compare(startEdgeStartInstant, bEndInstant),
      ).toBeGreaterThanOrEqual(0);
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
      const endEdgeEndInstant = Temporal.ZonedDateTime.from(
        result[0].end,
      ).toInstant();
      expect(
        Temporal.Instant.compare(endEdgeEndInstant, bStartInstant),
      ).toBeLessThan(0);
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
});
