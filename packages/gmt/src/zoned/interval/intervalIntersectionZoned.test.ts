import { Temporal } from "@js-temporal/polyfill";
import { intervalIntersectionZoned } from "./intervalIntersectionZoned";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";

describe("intervalIntersectionZoned", () => {
  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${{ start: "2024-04-01T00:00:00+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }}
    ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${{ start: "2024-04-01T00:00:00+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-02-01T00:00:00+00:00[UTC]"} | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${{ start: "2024-02-01T00:00:00+00:00[UTC]", end: "2024-03-01T00:00:00+00:00[UTC]" }}
  `(
    "returns $expected when intervals $aStart to $aEnd and $bStart to $bEnd overlap",
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

  // Half-open [start, end) (coding-standards § 8; A = 2024-01-01T09:00Z, B = 12:00Z, C = 13:00Z,
  // D = 17:00Z). The intersection exists only when `aStart < bEnd && bStart < aEnd` by instant, as
  // in `intersectIntervals`, and is `[max(starts), min(ends))`; on a tie the first interval's
  // boundary (and so its zone) wins.
  it.each`
    aStart                              | aEnd                                          | bStart                                           | bEnd                                | expected                                                                                        | reason
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T13:00:00+00:00[UTC]"}           | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${{ start: "2024-01-01T12:00:00+00:00[UTC]", end: "2024-01-01T13:00:00+00:00[UTC]" }}           | ${"overlapping [A, C) and [B, D) give [B, C)"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${null}                                                                                         | ${"touching [A, B) and [B, D) share no instant"}
    ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"}           | ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${null}                                                                                         | ${"touching, arguments swapped"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T07:00:00-05:00[America/New_York]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${null}                                                                                         | ${"touching across zones"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00.000000001+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${{ start: "2024-01-01T12:00:00+00:00[UTC]", end: "2024-01-01T12:00:00.000000001+00:00[UTC]" }} | ${"one-nanosecond overlap"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"}           | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${{ start: "2024-01-01T12:00:00+00:00[UTC]", end: "2024-01-01T12:00:00+00:00[UTC]" }}           | ${"empty [B, B) strictly inside [A, D) is itself"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"}           | ${"2024-01-01T17:00:00+00:00[UTC]"}              | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${null}                                                                                         | ${"empty [D, D) at the end edge"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"}           | ${"2024-01-01T09:00:00+00:00[UTC]"}              | ${"2024-01-01T09:00:00+00:00[UTC]"} | ${null}                                                                                         | ${"empty [A, A) at the start edge"}
    ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T12:00:00+00:00[UTC]"}              | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${null}                                                                                         | ${"two identical empty intervals"}
  `(
    "returns $expected for [$aStart, $aEnd) and [$bStart, $bEnd) ($reason)",
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

      // Half-open: [aStart, aEnd) excludes aEnd, so touching intervals share no instant.
      expect(intervalIntersectionZoned(aStart, aEnd, bStart, bEnd)).toBeNull();
    }
  });

  // The arguments name different calendars (hebrew and a bare iso8601 string), so the
  // result is the sentinel (there is no single output calendar).
  it.each`
    aStart                                           | aEnd                                | bStart                                           | bEnd
    ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
  `(
    "returns null for mixed calendars: $aStart, $aEnd, $bStart, $bEnd",
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
