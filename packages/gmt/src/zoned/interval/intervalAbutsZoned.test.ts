import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { intervalAbutsZoned } from "./intervalAbutsZoned";

describe("intervalAbutsZoned", () => {
  it("returns true when A=2024-01-01T09:00:00+00:00[UTC]..2024-06-30T12:00:00+00:00[UTC] and B=2024-06-30T12:00:00.000000001+00:00[UTC]..2024-12-31T17:00:00+00:00[UTC]", () => {
    expect(
      intervalAbutsZoned(
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-06-30T12:00:00+00:00[UTC]",
        "2024-06-30T12:00:00.000000001+00:00[UTC]",
        "2024-12-31T17:00:00+00:00[UTC]",
      ),
    ).toBe(true);
  });

  it("returns false when A=2024-06-30T12:00:00+00:00[UTC]..2024-12-31T17:00:00+00:00[UTC] and B=2024-01-01T09:00:00+00:00[UTC]..2024-06-30T12:00:00.000000001+00:00[UTC]", () => {
    expect(
      intervalAbutsZoned(
        "2024-06-30T12:00:00+00:00[UTC]",
        "2024-12-31T17:00:00+00:00[UTC]",
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-06-30T12:00:00.000000001+00:00[UTC]",
      ),
    ).toBe(false);
  });

  it("returns true when A=2024-06-15T12:00:00+00:00[UTC]..2024-06-15T12:00:00+00:00[UTC] and B=2024-06-15T12:00:00.000000001+00:00[UTC]..2024-06-15T13:00:00+00:00[UTC]", () => {
    expect(
      intervalAbutsZoned(
        "2024-06-15T12:00:00+00:00[UTC]",
        "2024-06-15T12:00:00+00:00[UTC]",
        "2024-06-15T12:00:00.000000001+00:00[UTC]",
        "2024-06-15T13:00:00+00:00[UTC]",
      ),
    ).toBe(true);
  });

  it("returns false for non-adjacent intervals", () => {
    expect(
      intervalAbutsZoned(
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-06-30T12:00:00+00:00[UTC]",
        "2024-06-30T12:00:01+00:00[UTC]",
        "2024-12-31T17:00:00+00:00[UTC]",
      ),
    ).toBe(false);
    expect(
      intervalAbutsZoned(
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-06-30T13:00:00+00:00[UTC]",
        "2024-06-30T12:00:00+00:00[UTC]",
        "2024-12-31T17:00:00+00:00[UTC]",
      ),
    ).toBe(false);
    expect(
      intervalAbutsZoned(
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-06-30T12:00:00+00:00[UTC]",
        "2024-04-01T11:00:00+00:00[UTC]",
        "2024-08-01T13:00:00+00:00[UTC]",
      ),
    ).toBe(false);
  });

  it("returns false for reversed intervals", () => {
    expect(
      intervalAbutsZoned(
        "2024-12-31T17:00:00+00:00[UTC]",
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-06-01T12:00:00+00:00[UTC]",
        "2024-07-01T13:00:00+00:00[UTC]",
      ),
    ).toBe(false);
    expect(
      intervalAbutsZoned(
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-06-30T12:00:00+00:00[UTC]",
        "2024-06-15T12:00:00+00:00[UTC]",
        "2024-06-10T12:00:00+00:00[UTC]",
      ),
    ).toBe(false);
  });

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"invalid"}                        | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${false}
    ${""}                               | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${""}                               | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${""}                               | ${"2024-12-31T17:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"invalid"}                        | ${false}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${""}                               | ${false}
  `(
    "returns false for malformed zoned datetime: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd
    ${null}                             | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${undefined}                        | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${"2024-12-31T17:00:00+00:00[UTC]"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${null}                             | ${"2024-12-31T17:00:00+00:00[UTC]"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-06-30T12:00:00+00:00[UTC]"} | ${"2024-07-01T13:00:00+00:00[UTC]"} | ${undefined}
  `("returns false for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  it("returns false when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalAbutsZoned(
        "2024-01-01T09:00:00+00:00[UTC]",
        "2024-06-30T12:00:00+00:00[UTC]",
        "2024-06-30T12:00:00.000000001+00:00[UTC]",
        "2024-12-31T17:00:00+00:00[UTC]",
      ),
    ).toBe(false);
  });

  it("proves zone-invariance across battleTestTimeZones for adjacent intervals (abuts = true)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bStartInstant = Temporal.Instant.from(
      "2024-06-30T12:00:00.000000001Z",
    );
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(true);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for non-adjacent intervals with gap (abuts = false)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-06-30T12:00:01Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for overlapping intervals (abuts = false)", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T13:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for reversed intervals (abuts = false)", () => {
    const aStartInstant = Temporal.Instant.from("2024-12-31T17:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-01-01T09:00:00Z");
    const bStartInstant = Temporal.Instant.from("2024-06-30T12:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-07-01T13:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for zero-length interval abutting another", () => {
    const instant = Temporal.Instant.from("2024-06-15T12:00:00Z");
    const nextInstant = Temporal.Instant.from("2024-06-15T12:00:00.000000001Z");
    const bEndInstant = Temporal.Instant.from("2024-06-15T13:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = instant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = instant.toZonedDateTimeISO(timeZone).toString();
      const bStart = nextInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(true);
    }
  });

  // E5 (issue #78), decision of record D2 — see isValidZonedDateTime.test.ts for the full
  // rationale: zoned/ rejects any [u-ca=...] calendar annotation outright.
  it.each`
    aStart | aEnd | bStart | bEnd
    ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
  `(
    "returns false when an argument carries a calendar annotation: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }: { aStart: string; aEnd: string; bStart: string; bEnd: string }) => {
      expect(intervalAbutsZoned(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );
});
