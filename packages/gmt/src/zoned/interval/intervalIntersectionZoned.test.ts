import { Temporal } from "@js-temporal/polyfill";
import { intervalIntersectionZoned } from "./intervalIntersectionZoned";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";

describe("intervalIntersectionZoned", () => {
  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${{ start: "2024-04-01T00:00:00+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${{ start: "2024-06-30T23:59:59+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }}
    ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${{ start: "2024-04-01T00:00:00+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-02-01T00:00:00+00:00[UTC]"} | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${{ start: "2024-02-01T00:00:00+00:00[UTC]", end: "2024-03-01T00:00:00+00:00[UTC]" }}
    ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${{ start: "2024-06-30T23:59:59+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }}
  `(
    "returns $expected when intervals $aStart..$aEnd and $bStart..$bEnd overlap",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionZoned(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-07-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${null}
    ${"2024-07-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${null}
  `(
    "returns $expected for disjoint intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionZoned(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${{ start: "2024-06-30T23:59:59+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }}
    ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${{ start: "2024-06-30T23:59:59+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }}
  `(
    "returns $expected for adjacent intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionZoned(aStart, aEnd, bStart, bEnd)).toEqual(
        expected,
      );
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${null}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalIntersectionZoned(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd
    ${"invalid"}                        | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${""}                               | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${""}                               | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"invalid"}                        | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${""}                               | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"invalid"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${""}
  `(
    "returns null for malformed zoned: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalIntersectionZoned(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd
    ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2025-01-01T00:00:00+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
  `(
    "returns null for leap-second input: $aStart vs $aEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalIntersectionZoned(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${null}         | ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${null}         | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null}         | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${null}
  `(
    "returns null for non-string input: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalIntersectionZoned(
          aStart as never,
          aEnd as never,
          bStart as never,
          bEnd as never,
        ),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalIntersectionZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-06-30T23:59:59+00:00[UTC]",
        "2024-04-01T00:00:00+00:00[UTC]",
        "2024-12-31T23:59:59+00:00[UTC]",
      ),
    ).toBeNull();
  });

  it("proves zone-invariance across battleTestTimeZones for overlapping intervals", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T23:59:59Z");
    const bStartInstant = Temporal.Instant.from("2024-04-01T00:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T23:59:59Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalIntersectionZoned(aStart, aEnd, bStart, bEnd);

      expect(result).not.toBeNull();
      expect(
        Temporal.ZonedDateTime.from(result!.start).toInstant().toString(),
      ).toBe(
        Temporal.Instant.compare(aStartInstant, bStartInstant) >= 0
          ? aStartInstant.toString()
          : bStartInstant.toString(),
      );
      expect(
        Temporal.ZonedDateTime.from(result!.end).toInstant().toString(),
      ).toBe(
        Temporal.Instant.compare(aEndInstant, bEndInstant) <= 0
          ? aEndInstant.toString()
          : bEndInstant.toString(),
      );
    }
  });

  it("proves zone-invariance across battleTestTimeZones for disjoint intervals", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T23:59:59Z");
    const bStartInstant = Temporal.Instant.from("2024-07-01T00:00:00Z");
    const bEndInstant = Temporal.Instant.from("2024-12-31T23:59:59Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalIntersectionZoned(aStart, aEnd, bStart, bEnd)).toBeNull();
    }
  });

  it("proves zone-invariance across battleTestTimeZones for adjacent intervals", () => {
    const aStartInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const aEndInstant = Temporal.Instant.from("2024-06-30T23:59:59Z");
    const bStartInstant = aEndInstant;
    const bEndInstant = Temporal.Instant.from("2024-12-31T23:59:59Z");

    for (const timeZone of battleTestTimeZones) {
      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      const result = intervalIntersectionZoned(aStart, aEnd, bStart, bEnd);

      expect(result).not.toBeNull();
      expect(
        Temporal.ZonedDateTime.from(result!.start).toInstant().toString(),
      ).toBe(aEndInstant.toString());
      expect(
        Temporal.ZonedDateTime.from(result!.end).toInstant().toString(),
      ).toBe(aEndInstant.toString());
    }
  });

  // E5 (issue #78), decision of record D2 — see isValidZonedDateTime.test.ts for the full
  // rationale: zoned/ rejects any [u-ca=...] calendar annotation outright.
  it.each`
    aStart                                           | aEnd                                | bStart                                           | bEnd
    ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
  `(
    "returns null when an argument carries a calendar annotation: $aStart, $aEnd, $bStart, $bEnd",
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
      expect(intervalIntersectionZoned(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );
});
