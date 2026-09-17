import { Temporal } from "@js-temporal/polyfill";
import { intervalOverlappingDaysZoned } from "./intervalOverlappingDaysZoned";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";

describe("intervalOverlappingDaysZoned", () => {
  it.each`
    aStart                                            | aEnd                                              | expected
    ${"2024-03-09T12:00:00-05:00[America/New_York]"}  | ${"2024-03-11T12:00:00-04:00[America/New_York]"}  | ${3}
    ${"2024-11-02T12:00:00-04:00[America/New_York]"}  | ${"2024-11-04T12:00:00-05:00[America/New_York]"}  | ${3}
    ${"2024-03-30T12:00:00+01:00[Europe/Berlin]"}     | ${"2024-04-01T12:00:00+02:00[Europe/Berlin]"}     | ${3}
    ${"2011-12-29T12:00:00-10:00[Pacific/Apia]"}      | ${"2011-12-31T12:00:00+14:00[Pacific/Apia]"}      | ${2}
    ${"2011-12-29T23:00:00-10:00[Pacific/Apia]"}      | ${"2011-12-31T01:00:00+14:00[Pacific/Apia]"}      | ${2}
    ${"2010-11-07T00:00:30-03:00[America/Goose_Bay]"} | ${"2010-11-06T23:30:00-04:00[America/Goose_Bay]"} | ${2}
    ${"2010-11-06T23:59:00-03:00[America/Goose_Bay]"} | ${"2010-11-06T23:30:00-04:00[America/Goose_Bay]"} | ${2}
    ${"2024-04-06T12:00:00-03:00[America/Santiago]"}  | ${"2024-04-07T12:00:00-04:00[America/Santiago]"}  | ${2}
    ${"2024-01-01T00:00:00+00:00[UTC]"}               | ${"2024-01-02T00:00:00+00:00[UTC]"}               | ${1}
    ${"2024-01-01T12:00:00+00:00[UTC]"}               | ${"2024-01-01T12:00:00+00:00[UTC]"}               | ${0}
  `(
    // Distinct local dates of the instants in the half-open span [start, end) (tzdb): the end is
    // excluded, so [01-01T00:00, 01-02T00:00) UTC touches one date and an empty span none. Apia
    // deleted 2011-12-30, and
    // Goose_Bay (2010, at 00:01) fell back into the previous date; Santiago (2024, 24:00 -> 23:00)
    // repeats an hour of the same date.
    "returns $expected for self-overlapping $aStart to $aEnd",
    ({ aStart, aEnd, expected }) => {
      expect(intervalOverlappingDaysZoned(aStart, aEnd, aStart, aEnd)).toBe(
        expected,
      );
    },
  );

  it("counts days in aStart's zone, so swapping a/b can change the answer (non-commutative)", () => {
    const nyStart = "2024-01-01T00:00:00-05:00[America/New_York]";
    const nyEnd = "2024-01-03T01:00:00-05:00[America/New_York]";
    const tokyoStart = "2024-01-02T00:00:00+09:00[Asia/Tokyo]";
    const tokyoEnd = "2024-01-05T00:00:00+09:00[Asia/Tokyo]";

    expect(
      intervalOverlappingDaysZoned(nyStart, nyEnd, tokyoStart, tokyoEnd),
    ).toBe(3);
    expect(
      intervalOverlappingDaysZoned(tokyoStart, tokyoEnd, nyStart, nyEnd),
    ).toBe(2);
  });

  // An empty interval strictly inside the other overlaps it, but the intersection is that empty
  // span [12:00, 12:00), which holds no instant and so no date (CORE-6 empty-interval rule).
  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-03T00:00:00+00:00[UTC]"} | ${"2024-01-02T12:00:00+00:00[UTC]"} | ${"2024-01-02T12:00:00+00:00[UTC]"}
    ${"2024-01-02T12:00:00+00:00[UTC]"} | ${"2024-01-02T12:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-03T00:00:00+00:00[UTC]"}
  `(
    "returns 0 when the intersection of [$aStart, $aEnd) and [$bStart, $bEnd) is an empty interval inside the other",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalOverlappingDaysZoned(aStart, aEnd, bStart, bEnd)).toBe(0);
    },
  );

  it("returns 0 for disjoint UTC intervals", () => {
    expect(
      intervalOverlappingDaysZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-02T00:00:00+00:00[UTC]",
        "2024-01-03T00:00:00+00:00[UTC]",
        "2024-01-04T00:00:00+00:00[UTC]",
      ),
    ).toBe(0);
  });

  // Half-open (coding-standards § 8): touching intervals share no instant, so the intersection is
  // empty and no date is shared.
  it.each`
    aStart                              | aEnd                                | bStart                                           | bEnd
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"}              | ${"2024-01-03T00:00:00+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}              | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"2024-01-01T19:00:00-05:00[America/New_York]"} | ${"2024-01-03T00:00:00+00:00[UTC]"}
  `(
    "returns 0 for touching intervals [$aStart, $aEnd) and [$bStart, $bEnd)",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalOverlappingDaysZoned(aStart, aEnd, bStart, bEnd)).toBe(0);
    },
  );

  it("counts the date of the instant one nanosecond before an exclusive end at midnight", () => {
    expect(
      intervalOverlappingDaysZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-03T00:00:00+00:00[UTC]",
        "2024-01-01T12:00:00+00:00[UTC]",
        "2024-01-02T00:00:00.000000001+00:00[UTC]",
      ),
    ).toBe(2);
  });

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd
    ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2025-01-01T00:00:00+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
  `(
    "returns null for leap-second input: $aStart vs $aEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalOverlappingDaysZoned(aStart, aEnd, bStart, bEnd),
      ).toBeNull();
    },
  );

  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd
    ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
  `(
    "returns null for inverted interval $aStart to $aEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalOverlappingDaysZoned(aStart, aEnd, bStart, bEnd),
      ).toBeNull();
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
      expect(
        intervalOverlappingDaysZoned(aStart, aEnd, bStart, bEnd),
      ).toBeNull();
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
        intervalOverlappingDaysZoned(
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
      intervalOverlappingDaysZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-06-30T23:59:59+00:00[UTC]",
        "2024-04-01T00:00:00+00:00[UTC]",
        "2024-12-31T23:59:59+00:00[UTC]",
      ),
    ).toBeNull();
  });

  it("counts the same instants per zone across battleTestTimeZones for self-overlapping instants", () => {
    // [2024-01-01T00:00Z, 2024-01-03T00:00Z) is 48 hours. Where the zone's offset is zero it starts at
    // local midnight and touches 2 dates; any other offset starts mid-day and touches 3 (no battle
    // zone changes offset on 2024-01-01..03).
    const startInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-01-03T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const startZdt = startInstant.toZonedDateTimeISO(timeZone);
      const start = startZdt.toString();
      const end = endInstant.toZonedDateTimeISO(timeZone).toString();
      const expected = startZdt.offsetNanoseconds === 0 ? 2 : 3;

      expect(intervalOverlappingDaysZoned(start, end, start, end)).toBe(
        expected,
      );
    }
  });

  // The arguments name different calendars (hebrew and a bare iso8601 string), so the
  // result is the sentinel (the day count is a difference, and TC39 CalendarEquals makes until throw).
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
      expect(
        intervalOverlappingDaysZoned(aStart, aEnd, bStart, bEnd),
      ).toBeNull();
    },
  );

  it("returns null when the intersection crosses more than 10,000 zone transitions (America/New_York, 1970 to 7000)", () => {
    const start = "1970-01-01T00:00:00-05:00[America/New_York]";
    const end = "7000-01-01T00:00:00-05:00[America/New_York]";
    expect(intervalOverlappingDaysZoned(start, end, start, end)).toBeNull();
  });
});
