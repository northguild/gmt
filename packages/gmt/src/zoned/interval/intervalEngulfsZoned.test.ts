import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { intervalEngulfsZoned } from "./intervalEngulfsZoned";

describe("intervalEngulfsZoned", () => {
  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${true}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${true}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${true}
    ${"2024-06-01T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2023-12-01T00:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2025-01-01T00:00:00+00:00[UTC]"} | ${false}
    ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${true}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"2024-06-10T00:00:00+00:00[UTC]"} | ${false}
  `(
    "returns $expected when A=$aStart to $aEnd, B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(expected);
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
  `("returns false for $reason", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalEngulfsZoned(aStart as any, aEnd, bStart, bEnd)).toBe(false);
  });

  it("returns false when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalEngulfsZoned(
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-12-31T17:00:00+00:00[UTC]",
        "2024-06-01T12:00:00+00:00[UTC]",
        "2024-07-01T13:00:00+00:00[UTC]",
      ),
    ).toBe(false);
  });

  it("proves zone-invariance across battleTestTimeZones for B fully inside A (engulfs = true)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-06-01T12:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-07-01T13:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(true);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for identical intervals (engulfs = true)", () => {
    const instant = Temporal.Instant.from("2024-06-15T12:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = instant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = instant.toZonedDateTimeISO(timeZone).toString();
      const bStart = instant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = instant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(true);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for B partially outside A start (engulfs = false)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const bStartInstant = Temporal.Instant.from("2023-12-01T00:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-06-15T12:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for B partially outside A end (engulfs = false)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-06-15T12:00:00Z");
    const bEndInstant = Temporal.Instant.from("2025-01-01T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for reversed intervals (engulfs = false)", () => {
    const aStartInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-06-01T12:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-07-01T13:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for B completely outside A (engulfs = false)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-07-01T13:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    }
  });

  // E5 (issue #78), decision of record D2 — see isValidZonedDateTime.test.ts for the full
  // rationale: zoned/ rejects any [u-ca=...] calendar annotation outright.
  it.each`
    aStart                                           | aEnd                                | bStart                                           | bEnd
    ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
  `(
    "returns false when an argument carries a calendar annotation: $aStart, $aEnd, $bStart, $bEnd",
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
      expect(intervalEngulfsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );
});
