import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { intervalUnionZoned } from "./intervalUnionZoned";

describe("intervalUnionZoned", () => {
  // Half-open [start, end) (coding-standards § 8; A = 2024-01-01T09:00Z, B = 12:00Z, C = 13:00Z,
  // D = 17:00Z). The union is the single run `mergeIntervalsZoned` makes of the pair: touching
  // intervals join, a gap gives null, and an empty interval adds no instants, so it is absorbed
  // when it touches the other and dropped when it does not.
  it.each`
    aStart                              | aEnd                                | bStart                                        | bEnd                                | expected                                                                              | reason
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" }} | ${"touching [A, B) and [B, D) join"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00.000000001+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${null}                                                                               | ${"one-nanosecond gap"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T13:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" }} | ${"overlapping [A, C) and [B, D)"}
    ${"2024-01-01T09:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"}           | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T12:00:00+00:00[UTC]" }} | ${"empty [D, D) apart from [A, B) adds nothing"}
    ${"2024-01-01T17:00:00+00:00[UTC]"} | ${"2024-01-01T17:00:00+00:00[UTC]"} | ${"2024-01-01T09:00:00+00:00[UTC]"}           | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T12:00:00+00:00[UTC]" }} | ${"empty first interval apart from the second adds nothing"}
    ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"2024-01-01T12:00:00+00:00[UTC]"}           | ${"2024-01-01T12:00:00+00:00[UTC]"} | ${null}                                                                               | ${"two empty intervals have no instant to span"}
  `(
    "returns $expected for [$aStart, $aEnd) and [$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalUnionZoned(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-12-31T23:59:59+00:00[UTC]" }}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-12-31T23:59:59+00:00[UTC]" }}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-12-31T23:59:59+00:00[UTC]" }}
    ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-12-31T23:59:59+00:00[UTC]" }}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-29T00:00:00+00:00[UTC]"} | ${"2024-06-29T00:00:00+00:00[UTC]"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }}
  `(
    "returns merged interval when $aStart to $aEnd overlaps $bStart to $bEnd",
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
      expect(intervalUnionZoned(aStart, aEnd, bStart, bEnd)).toBeNull();
    },
  );
});
