import { Temporal } from "@js-temporal/polyfill";
import { intervalOverlappingDaysZoned } from "./intervalOverlappingDaysZoned";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";

describe("intervalOverlappingDaysZoned", () => {
  it.each`
    aStart                                           | aEnd                                             | expected
    ${"2024-03-09T12:00:00-05:00[America/New_York]"} | ${"2024-03-11T12:00:00-04:00[America/New_York]"} | ${3}
    ${"2024-11-02T12:00:00-04:00[America/New_York]"} | ${"2024-11-04T12:00:00-05:00[America/New_York]"} | ${3}
    ${"2024-03-30T12:00:00+01:00[Europe/Berlin]"}    | ${"2024-04-01T12:00:00+02:00[Europe/Berlin]"}    | ${3}
    ${"2011-12-29T12:00:00-10:00[Pacific/Apia]"}     | ${"2011-12-31T12:00:00+14:00[Pacific/Apia]"}     | ${3}
  `(
    "returns $expected for self-overlapping $aStart..$aEnd",
    ({ aStart, aEnd, expected }) => {
      expect(intervalOverlappingDaysZoned(aStart, aEnd, aStart, aEnd)).toBe(
        expected,
      );
    },
  );

  it("counts days in aStart's zone, so swapping a/b can change the answer (non-commutative)", () => {
    const nyStart = "2024-01-01T00:00:00-05:00[America/New_York]";
    const nyEnd = "2024-01-03T00:00:00-05:00[America/New_York]";
    const tokyoStart = "2024-01-02T00:00:00+09:00[Asia/Tokyo]";
    const tokyoEnd = "2024-01-05T00:00:00+09:00[Asia/Tokyo]";

    expect(
      intervalOverlappingDaysZoned(nyStart, nyEnd, tokyoStart, tokyoEnd),
    ).toBe(3);
    expect(
      intervalOverlappingDaysZoned(tokyoStart, tokyoEnd, nyStart, nyEnd),
    ).toBe(2);
  });

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

  it("returns 1 for adjacent intervals sharing one instant", () => {
    expect(
      intervalOverlappingDaysZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-06-30T23:59:59+00:00[UTC]",
        "2024-06-30T23:59:59+00:00[UTC]",
        "2024-12-31T23:59:59+00:00[UTC]",
      ),
    ).toBe(1);
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
    "returns null for inverted interval $aStart..$aEnd",
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
    aStart                              | aEnd                                | bStart                              | bEnd
    ${null} | ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${null} | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null} | ${"2024-01-01"}
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

  it("proves zone-invariance across battleTestTimeZones for self-overlapping instants", () => {
    const startInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-01-03T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const start = startInstant.toZonedDateTimeISO(timeZone).toString();
      const end = endInstant.toZonedDateTimeISO(timeZone).toString();

      expect(intervalOverlappingDaysZoned(start, end, start, end)).toBe(3);
    }
  });
});
