import { areUnixEqualBy } from "./areUnixEqualBy";
import { dateLineCrossingAt, dateLineCrossingTimeZones } from "../../test";

const options = { timeZone: "UTC" } as const;

describe("areUnixEqualBy", () => {
  it.each`
    value1           | value2           | unit
    ${1710468000000} | ${1710540000000} | ${"day"}
    ${1709251200000} | ${1711929599000} | ${"month"}
    ${1704067200000} | ${1735689599000} | ${"year"}
    ${1710115200000} | ${1710719999000} | ${"week"}
    ${1710497700000} | ${1710499500000} | ${"hour"}
  `(
    "returns true for $value1 and $value2 equal by $unit",
    ({ value1, value2, unit }) => {
      expect(areUnixEqualBy(value1, value2, unit, options)).toBe(true);
    },
  );

  it.each`
    value1           | value2           | unit
    ${1710468000000} | ${1710554400000} | ${"day"}
    ${1711929599000} | ${1711929600000} | ${"month"}
    ${1735689599000} | ${1735689600000} | ${"year"}
    ${1710633600000} | ${1710720000000} | ${"week"}
    ${1710496800000} | ${1710500400000} | ${"hour"}
  `(
    "returns false for $value1 and $value2 unequal at the next-finer unit than $unit",
    ({ value1, value2, unit }) => {
      expect(areUnixEqualBy(value1, value2, unit, options)).toBe(false);
    },
  );

  it("returns false when the same month falls in different years", () => {
    expect(areUnixEqualBy(1678838400000, 1710460800000, "month", options)).toBe(
      false,
    );
  });

  it.each`
    weekStartsOn | expected
    ${"monday"}  | ${true}
    ${"sunday"}  | ${false}
  `(
    "returns $expected for 2024-03-11 vs 2024-03-17 by week when weekStartsOn is $weekStartsOn",
    ({ weekStartsOn, expected }) => {
      expect(
        areUnixEqualBy(1710115200000, 1710633600000, "week", {
          ...options,
          weekStartsOn,
        }),
      ).toBe(expected);
    },
  );

  it("supports epochUnit: seconds", () => {
    expect(
      areUnixEqualBy(1710468000, 1710540000, "day", {
        ...options,
        epochUnit: "seconds",
      }),
    ).toBe(true);
  });

  it("returns false for an unsupported unit", () => {
    expect(
      areUnixEqualBy(1710468000000, 1710468000000, "decade" as never, options),
    ).toBe(false);
  });

  it.each`
    value1           | value2
    ${Number.NaN}    | ${1710468000000}
    ${null}          | ${1710468000000}
    ${undefined}     | ${1710468000000}
    ${1710468000000} | ${Number.NaN}
    ${1710468000000} | ${null}
    ${1710468000000} | ${undefined}
  `(
    "returns false for invalid input $value1 and $value2",
    ({ value1, value2 }) => {
      expect(
        areUnixEqualBy(value1 as never, value2 as never, "month", options),
      ).toBe(false);
    },
  );

  it("returns different results for the same pair depending on the requested timeZone", () => {
    // epoch1 = 2024-02-29T23:30:00Z, epoch2 = 2024-03-01T00:30:00Z (1 hour apart).
    const epoch1 = 1709249400000;
    const epoch2 = 1709253000000;

    // In UTC, epoch1 is Feb 29 and epoch2 is Mar 1 — different days.
    expect(areUnixEqualBy(epoch1, epoch2, "day", { timeZone: "UTC" })).toBe(
      false,
    );

    // In Pacific/Apia (+13:00), both fall on local March 1 — same day.
    expect(
      areUnixEqualBy(epoch1, epoch2, "day", { timeZone: "Pacific/Apia" }),
    ).toBe(true);
  });
});

// Across zone transitions, two epochs are equal by `unit` when they fall in the same real local
// bucket (see `startOfUnix`). Every start verified against `floorToZone` on
// @js-temporal/polyfill@0.5.1.
// 1727532300000 is 2024-09-29T03:50:00+13:45[Pacific/Chatham]
// 1727533200000 is 2024-09-29T04:05:00+13:45[Pacific/Chatham]
// 1727532060000 is 2024-09-29T03:46:00+13:45[Pacific/Chatham]
// 1727532840000 is 2024-09-29T03:59:00+13:45[Pacific/Chatham]
// 1712408700000 is 2024-04-07T02:50:00+13:45[Pacific/Chatham]
// 1712412300000 is 2024-04-07T02:50:00+12:45[Pacific/Chatham]
// The New York, Havana and Goose Bay rows are the same instants as the `areZonedEqualBy`
// transition rows, so both functions agree:
// 1730611800000 is 2024-11-03T01:30:00-04:00[America/New_York] (and 00:30:00-05:00[America/Havana])
// 1730615400000 is 2024-11-03T01:30:00-05:00[America/New_York]
// 1730608200000 is 2024-11-03T00:30:00-04:00[America/Havana]
// 1289097000000 is 2010-11-06T23:30:00-03:00[America/Goose_Bay]
// 1289100600000 is 2010-11-06T23:30:00-04:00[America/Goose_Bay]
describe("areUnixEqualBy across zone transitions", () => {
  it.each`
    value1           | value2           | unit      | timeZone               | expected
    ${1727532300000} | ${1727533200000} | ${"hour"} | ${"Pacific/Chatham"}   | ${false}
    ${1727532060000} | ${1727532840000} | ${"hour"} | ${"Pacific/Chatham"}   | ${true}
    ${1712408700000} | ${1712412300000} | ${"hour"} | ${"Pacific/Chatham"}   | ${false}
    ${1730611800000} | ${1730615400000} | ${"hour"} | ${"America/New_York"}  | ${false}
    ${1730611800000} | ${1730615400000} | ${"day"}  | ${"America/New_York"}  | ${true}
    ${1730608200000} | ${1730611800000} | ${"hour"} | ${"America/Havana"}    | ${false}
    ${1730608200000} | ${1730611800000} | ${"day"}  | ${"America/Havana"}    | ${true}
    ${1289097000000} | ${1289100600000} | ${"day"}  | ${"America/Goose_Bay"} | ${false}
  `(
    "returns $expected for $value1 and $value2 by $unit in $timeZone",
    ({ value1, value2, unit, timeZone, expected }) => {
      expect(areUnixEqualBy(value1, value2, unit, { timeZone })).toBe(expected);
    },
  );
});

// weekStartsOn only names "monday" or "sunday"; any other value is invalid input, for every unit
// (Temporal GetOption rejects a value outside its allowed list; undefined means the default).
// 1710504000000 is 2024-03-15T12:00:00Z.
describe("areUnixEqualBy with an invalid weekStartsOn", () => {
  it.each`
    unit      | weekStartsOn
    ${"week"} | ${"tuesday"}
    ${"week"} | ${"Monday"}
    ${"week"} | ${""}
    ${"week"} | ${null}
    ${"week"} | ${1}
    ${"week"} | ${true}
    ${"day"}  | ${"tuesday"}
    ${"day"}  | ${"Monday"}
    ${"day"}  | ${""}
    ${"day"}  | ${null}
    ${"day"}  | ${1}
    ${"day"}  | ${true}
  `(
    "returns false for unit $unit with invalid weekStartsOn $weekStartsOn",
    ({ unit, weekStartsOn }) => {
      expect(
        areUnixEqualBy(1710504000000, 1710504000000, unit, {
          timeZone: "UTC",
          weekStartsOn,
        }),
      ).toBe(false);
    },
  );
});

// The 1844 date-line crossings (zoned.E): Asia/Manila, Pacific/Guam, Saipan, Kosrae and Palau
// skipped 1844-12-31, jumping a whole day forward at local 1844-12-31T00:00 in LMT. Expected values
// are Chromium 153 native Temporal, never the polyfill (whose transition search starts at
// 1847-01-01). `dateLineCrossingAt(zone, h)` is the zone h hours from its crossing, from exact time.

describe("areUnixEqualBy across the 1844 date-line crossings (zoned.E)", () => {
  it.each(dateLineCrossingTimeZones)(
    "puts 1844-12-30 and 1845-01-02 in one week in $timeZone",
    (crossing) => {
      expect(
        areUnixEqualBy(
          dateLineCrossingAt(crossing, -12).epochMilliseconds,
          dateLineCrossingAt(crossing, 36).epochMilliseconds,
          "week",
          { timeZone: crossing.timeZone },
        ),
      ).toBe(true);
    },
  );
});
