import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { intervalUnionZoned } from "./intervalUnionZoned";

describe("intervalUnionZoned", () => {
  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-12-31T23:59:59+00:00[UTC]" }}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-12-31T23:59:59+00:00[UTC]" }}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-12-31T23:59:59+00:00[UTC]" }}
    ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-12-31T23:59:59+00:00[UTC]" }}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-29T00:00:00+00:00[UTC]"} | ${"2024-06-29T00:00:00+00:00[UTC]"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }}
    ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${{ start: "2024-06-30T23:59:59+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }}
  `(
    "returns merged interval when $aStart..$aEnd overlaps $bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionZoned(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-07-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${null}
    ${"2024-07-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${null}
  `(
    "returns null when $aEnd is before $bStart (disjoint)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionZoned(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-12-31T23:59:59+00:00[UTC]" }}
    ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }}
  `(
    "returns merged interval when $aEnd equals $bStart (adjacent)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionZoned(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${null}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-15T00:00:00+00:00[UTC]"} | ${"2024-06-10T00:00:00+00:00[UTC]"} | ${null}
  `(
    "returns null when $aStart is after $aEnd (reversed)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionZoned(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd
    ${"invalid"}                        | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${""}                               | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-13-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${""}                               | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"invalid"}                        | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${""}                               | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"invalid"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${""}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-13-01T00:00:00+00:00[UTC]"}
    ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:60+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:60+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:60+00:00[UTC]"}
  `(
    "returns null for malformed zoned datetime: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalUnionZoned(aStart, aEnd, bStart, bEnd)).toBeNull();
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
        intervalUnionZoned(
          aStart as never,
          aEnd as never,
          bStart as never,
          bEnd as never,
        ),
      ).toBeNull();
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd
    ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2025-01-01T00:00:00+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
  `(
    "returns null for leap-second input: $aStart vs $aEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalUnionZoned(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it("returns null when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalUnionZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-06-30T23:59:59+00:00[UTC]",
        "2024-04-01T00:00:00+00:00[UTC]",
        "2024-12-31T23:59:59+00:00[UTC]",
      ),
    ).toBeNull();
  });

  it.each(
    battleTestTimeZones.map((timeZone) => {
      const aStartInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
      const aEndInstant = Temporal.Instant.from("2024-06-30T23:59:59Z");
      const bStartInstant = Temporal.Instant.from("2024-04-01T00:00:00Z");
      const bEndInstant = Temporal.Instant.from("2024-12-31T23:59:59Z");

      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      return {
        timeZone,
        aStart,
        aEnd,
        bStart,
        bEnd,
        expectedStart:
          Temporal.Instant.compare(aStartInstant, bStartInstant) <= 0
            ? aStartInstant.toString()
            : bStartInstant.toString(),
        expectedEnd:
          Temporal.Instant.compare(aEndInstant, bEndInstant) >= 0
            ? aEndInstant.toString()
            : bEndInstant.toString(),
      };
    }),
  )(
    "intervalUnionZoned($aStart, $aEnd, $bStart, $bEnd) -> { start: $expectedStart, end: $expectedEnd } ($timeZone)",
    ({ aStart, aEnd, bStart, bEnd, expectedStart, expectedEnd }) => {
      const result = intervalUnionZoned(aStart, aEnd, bStart, bEnd);

      expect(result).not.toBeNull();
      expect(
        Temporal.ZonedDateTime.from(result!.start).toInstant().toString(),
      ).toBe(expectedStart);
      expect(
        Temporal.ZonedDateTime.from(result!.end).toInstant().toString(),
      ).toBe(expectedEnd);
    },
  );

  it.each(
    battleTestTimeZones.map((timeZone) => {
      const aStartInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
      const aEndInstant = Temporal.Instant.from("2024-06-30T23:59:59Z");
      const bStartInstant = Temporal.Instant.from("2024-07-01T00:00:00Z");
      const bEndInstant = Temporal.Instant.from("2024-12-31T23:59:59Z");

      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      return { timeZone, aStart, aEnd, bStart, bEnd };
    }),
  )(
    "intervalUnionZoned($aStart, $aEnd, $bStart, $bEnd) -> null ($timeZone)",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalUnionZoned(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );

  it.each(
    battleTestTimeZones.map((timeZone) => {
      const aStartInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
      const aEndInstant = Temporal.Instant.from("2024-06-30T23:59:59Z");
      const bStartInstant = aEndInstant;
      const bEndInstant = Temporal.Instant.from("2024-12-31T23:59:59Z");

      const aStart = aStartInstant.toZonedDateTimeISO(timeZone).toString();
      const aEnd = aEndInstant.toZonedDateTimeISO(timeZone).toString();
      const bStart = bStartInstant.toZonedDateTimeISO(timeZone).toString();
      const bEnd = bEndInstant.toZonedDateTimeISO(timeZone).toString();

      return {
        timeZone,
        aStart,
        aEnd,
        bStart,
        bEnd,
        expectedStart: aStartInstant.toString(),
        expectedEnd: bEndInstant.toString(),
      };
    }),
  )(
    "intervalUnionZoned($aStart, $aEnd, $bStart, $bEnd) -> { start: $expectedStart, end: $expectedEnd } ($timeZone)",
    ({ aStart, aEnd, bStart, bEnd, expectedStart, expectedEnd }) => {
      const result = intervalUnionZoned(aStart, aEnd, bStart, bEnd);

      expect(result).not.toBeNull();
      expect(
        Temporal.ZonedDateTime.from(result!.start).toInstant().toString(),
      ).toBe(expectedStart);
      expect(
        Temporal.ZonedDateTime.from(result!.end).toInstant().toString(),
      ).toBe(expectedEnd);
    },
  );
  // E5 (issue #78), decision of record D2 -- see isValidZonedDateTime.test.ts for the full
  // rationale: zoned/ rejects any [u-ca=...] calendar annotation outright.
  it.each`
    aStart | aEnd | bStart | bEnd
    ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
  `(
    "returns null when an argument carries a calendar annotation: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }: { aStart: string; aEnd: string; bStart: string; bEnd: string }) => {
      expect(intervalUnionZoned(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );
});
