import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { intervalXorZoned } from "./intervalXorZoned";

describe("intervalXorZoned", () => {
  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-04-01T11:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${{ count: 2 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-04-01T11:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${{ count: 2 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${{ count: 0 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2025-01-01T00:00:00+00:00[UTC]"} | ${"2025-06-01T00:00:00+00:00[UTC]"} | ${{ count: 2 }}
    ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${{ count: 0 }}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${{ count: 2 }}
  `(
    "returns $expected when A=$aStart to $aEnd, B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      const result = intervalXorZoned(aStart, aEnd, bStart, bEnd);
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
    expect(intervalXorZoned(aStart as any, aEnd, bStart, bEnd)).toEqual([]);
  });

  it("returns [] when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalXorZoned(
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-06-30T12:00:00+00:00[UTC]",
        "2024-04-01T11:00:00+00:00[UTC]",
        "2024-12-31T17:00:00+00:00[UTC]",
      ),
    ).toEqual([]);
  });

  it("proves zone-invariance across battleTestTimeZones for overlapping intervals with xor on both sides", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-04-01T11:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalXorZoned(aStart, aEnd, bStart, bEnd);

      expect(result).toHaveLength(2);
      // First piece: A start to B start
      expect(
        Temporal.ZonedDateTime.from(result[0].start).toInstant().toString(),
      ).toBe(aStartInstant.toString());
      const xorFirstEnd = Temporal.ZonedDateTime.from(
        result[0].end,
      ).toInstant();
      expect(Temporal.Instant.compare(xorFirstEnd, bStartInstant)).toBeLessThan(
        0,
      );
      // Second piece: A end to B end
      const xorSecondStart = Temporal.ZonedDateTime.from(
        result[1].start,
      ).toInstant();
      expect(
        Temporal.Instant.compare(xorSecondStart, aEndInstant),
      ).toBeGreaterThanOrEqual(0);
      expect(
        Temporal.ZonedDateTime.from(result[1].end).toInstant().toString(),
      ).toBe(bEndInstant.toString());
    }
  });

  it("proves zone-invariance across battleTestTimeZones for identical intervals (xor is empty)", () => {
    const instant = Temporal.Instant.from("2024-06-15T12:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = instant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = instant.toZonedDateTimeISO(timeZone).toString();
      const bStart = instant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = instant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalXorZoned(aStart, aEnd, bStart, bEnd)).toEqual([]);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for disjoint intervals (xor is both)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const bStartInstant = Temporal.Instant.from("2025-01-01T00:00:00Z");
    const bEndInstant = Temporal.Instant.from("2025-06-01T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalXorZoned(aStart, aEnd, bStart, bEnd);

      expect(result).toHaveLength(2);
      expect(
        Temporal.ZonedDateTime.from(result[0].start).toInstant().toString(),
      ).toBe(aStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
      ).toBe(aEndInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[1].start).toInstant().toString(),
      ).toBe(bStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[1].end).toInstant().toString(),
      ).toBe(bEndInstant.toString());
    }
  });

  it("proves zone-invariance across battleTestTimeZones for adjacent intervals (xor is both)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-07-01T13:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalXorZoned(aStart, aEnd, bStart, bEnd);

      expect(result).toHaveLength(2);
      expect(
        Temporal.ZonedDateTime.from(result[0].start).toInstant().toString(),
      ).toBe(aStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[0].end).toInstant().toString(),
      ).toBe(aEndInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[1].start).toInstant().toString(),
      ).toBe(bStartInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result[1].end).toInstant().toString(),
      ).toBe(bEndInstant.toString());
    }
  });

  // E5 (issue #78), decision of record D2 — see isValidZonedDateTime.test.ts for the full
  // rationale: zoned/ rejects any [u-ca=...] calendar annotation outright.
  it.each`
    aStart | aEnd | bStart | bEnd
    ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
  `(
    "returns [] when an argument carries a calendar annotation: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }: { aStart: string; aEnd: string; bStart: string; bEnd: string }) => {
      expect(intervalXorZoned(aStart, aEnd, bStart, bEnd)).toEqual([]);
    },
  );
});
