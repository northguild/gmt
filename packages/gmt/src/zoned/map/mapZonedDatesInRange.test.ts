import { localRangeBattleCases } from "../test/timezoneFixtures";
import { mapZonedDatesInRange } from "./mapZonedDatesInRange";

describe("mapZonedDatesInRange", () => {
  it.each`
    start                                            | end                                              | stepDays | expected
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${1}     | ${["2024-03-01", "2024-03-02", "2024-03-03"]}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-07T10:00:00-05:00[America/New_York]"} | ${2}     | ${["2024-03-01", "2024-03-03", "2024-03-05", "2024-03-07"]}
    ${"2024-03-05T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${1}     | ${[]}
  `(
    "maps zoned dates from $start to $end with step $stepDays",
    ({
      start,
      end,
      stepDays,
      expected,
    }: {
      start: string;
      end: string;
      stepDays: number;
      expected: string[];
    }) => {
      expect(mapZonedDatesInRange(start, end, stepDays)).toEqual(expected);
    },
  );

  it.each`
    start                                            | end                                              | stepDays | expected
    ${"2024-03-10T10:00:00-04:00[America/New_York]"} | ${"2024-03-12T10:00:00-04:00[America/New_York]"} | ${1}     | ${["2024-03-10", "2024-03-11", "2024-03-12"]}
  `(
    "maps edge case zoned dates from $start to $end",
    ({ start, end, stepDays, expected }) => {
      expect(mapZonedDatesInRange(start, end, stepDays)).toEqual(expected);
    },
  );

  it.each`
    start                                            | end
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T15:00:00+00:00[UTC]"}
  `("returns an empty array for mismatched time zones", ({ start, end }) => {
    expect(mapZonedDatesInRange(start, end)).toEqual([]);
  });

  it.each`
    start                                            | end                                              | invalidStep
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${0}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${-1}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${1.5}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${null}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${undefined}
  `(
    "returns an empty array for invalid stepDays $invalidStep",
    ({ start, end, invalidStep }) => {
      expect(mapZonedDatesInRange(start, end, invalidStep as never)).toEqual(
        [],
      );
    },
  );

  it.each`
    invalidStart             | end                                              | stepDays
    ${"invalid"}             | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${1}
    ${"2024-03-01T10:00:00"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${1}
    ${""}                    | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${1}
    ${null}                  | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${1}
  `(
    "returns an empty array for invalid start value $invalidStart",
    ({ invalidStart, end, stepDays }) => {
      expect(
        mapZonedDatesInRange(invalidStart as never, end, stepDays),
      ).toEqual([]);
    },
  );

  it.each`
    start                                            | invalidEnd
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"invalid"}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00"}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${""}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${null}
  `(
    "returns an empty array for invalid end value $invalidEnd",
    ({ start, invalidEnd }) => {
      expect(mapZonedDatesInRange(start, invalidEnd as never)).toEqual([]);
    },
  );

  for (const { timeZone, start, end, expected } of localRangeBattleCases) {
    it(`maps a normal date range in battle-test timezone ${timeZone}`, () => {
      expect(mapZonedDatesInRange(start, end)).toEqual(expected);
    });
  }
});
