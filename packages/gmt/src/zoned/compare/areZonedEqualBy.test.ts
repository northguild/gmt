import {
  dateLineCrossingAt,
  dateLineCrossingTimeZones,
  localNoonBattleCases,
  sameInstantBattleCases,
} from "../../test";
import { areZonedEqualBy } from "./areZonedEqualBy";

describe("areZonedEqualBy", () => {
  it.each`
    value1                                     | value2                                     | unit
    ${"2024-03-15T10:00:00[America/New_York]"} | ${"2024-03-15T20:00:00[America/New_York]"} | ${"day"}
    ${"2024-03-01T00:00:00[America/New_York]"} | ${"2024-03-31T23:59:59[America/New_York]"} | ${"month"}
    ${"2024-01-01T00:00:00[America/New_York]"} | ${"2024-12-31T23:59:59[America/New_York]"} | ${"year"}
    ${"2024-03-11T00:00:00[America/New_York]"} | ${"2024-03-17T23:59:59[America/New_York]"} | ${"week"}
    ${"2024-03-15T10:15:00[America/New_York]"} | ${"2024-03-15T10:45:00[America/New_York]"} | ${"hour"}
  `(
    "returns true for $value1 and $value2 equal by $unit",
    ({ value1, value2, unit }) => {
      expect(areZonedEqualBy(value1, value2, unit)).toBe(true);
    },
  );

  it.each`
    value1                                     | value2                                     | unit
    ${"2024-03-15T10:00:00[America/New_York]"} | ${"2024-03-16T10:00:00[America/New_York]"} | ${"day"}
    ${"2024-03-31T00:00:00[America/New_York]"} | ${"2024-04-01T00:00:00[America/New_York]"} | ${"month"}
    ${"2024-01-01T00:00:00[America/New_York]"} | ${"2025-01-01T00:00:00[America/New_York]"} | ${"year"}
    ${"2024-03-17T00:00:00[America/New_York]"} | ${"2024-03-18T00:00:00[America/New_York]"} | ${"week"}
    ${"2024-03-15T10:00:00[America/New_York]"} | ${"2024-03-15T11:00:00[America/New_York]"} | ${"hour"}
  `(
    "returns false for $value1 and $value2 unequal at the next-finer unit than $unit",
    ({ value1, value2, unit }) => {
      expect(areZonedEqualBy(value1, value2, unit)).toBe(false);
    },
  );

  it("returns false when the same month falls in different years", () => {
    expect(
      areZonedEqualBy(
        "2023-03-15T00:00:00[America/New_York]",
        "2024-03-15T00:00:00[America/New_York]",
        "month",
      ),
    ).toBe(false);
  });

  it.each`
    weekStartsOn | expected
    ${"monday"}  | ${true}
    ${"sunday"}  | ${false}
  `(
    "returns $expected for 2024-03-11 vs 2024-03-17 by week when weekStartsOn is $weekStartsOn",
    ({ weekStartsOn, expected }) => {
      expect(
        areZonedEqualBy(
          "2024-03-11T00:00:00[America/New_York]",
          "2024-03-17T00:00:00[America/New_York]",
          "week",
          { weekStartsOn },
        ),
      ).toBe(expected);
    },
  );

  it.each`
    unit
    ${"decade"}
  `("returns false for unsupported unit $unit", ({ unit }) => {
    expect(
      areZonedEqualBy(
        "2024-03-15T00:00:00[America/New_York]",
        "2024-03-15T00:00:00[America/New_York]",
        unit,
      ),
    ).toBe(false);
  });

  it.each`
    value1                                     | value2
    ${""}                                      | ${""}
    ${null}                                    | ${"2024-03-15T00:00:00[America/New_York]"}
    ${undefined}                               | ${"2024-03-15T00:00:00[America/New_York]"}
    ${"not-a-zoned-datetime"}                  | ${"2024-03-15T00:00:00[America/New_York]"}
    ${"2024-03-15T00:00:00[America/New_York]"} | ${null}
    ${"2024-03-15T00:00:00[America/New_York]"} | ${undefined}
    ${"2024-03-15T00:00:00[America/New_York]"} | ${"not-a-zoned-datetime"}
  `(
    "returns false for invalid input $value1 and $value2",
    ({ value1, value2 }) => {
      expect(areZonedEqualBy(value1 as never, value2 as never, "month")).toBe(
        false,
      );
    },
  );

  it("returns false when the same instant falls on a different local day in another zone", () => {
    const utc = sameInstantBattleCases.find((c) => c.timeZone === "UTC")!;
    const newYork = sameInstantBattleCases.find(
      (c) => c.timeZone === "America/New_York",
    )!;

    // battleTestInstant is 2024-02-29T00:00:00Z: local day 29 in UTC, but
    // still local day 28 in America/New_York (-05:00) — same instant,
    // different calendar day per each value's own zone.
    expect(areZonedEqualBy(utc.value, newYork.value, "day")).toBe(false);
  });

  it("returns true when two different zones share the same local calendar day", () => {
    const utc = localNoonBattleCases.find((c) => c.timeZone === "UTC")!;
    const newYork = localNoonBattleCases.find(
      (c) => c.timeZone === "America/New_York",
    )!;

    // Both are local noon on 2024-02-29 in their own zone, despite being
    // different absolute instants.
    expect(areZonedEqualBy(utc.value, newYork.value, "day")).toBe(true);
  });

  it("returns true for New York 10:00 and Berlin 20:00 on the same local date by day", () => {
    expect(
      areZonedEqualBy(
        "2024-03-15T10:00:00-04:00[America/New_York]",
        "2024-03-15T20:00:00+01:00[Europe/Berlin]",
        "day",
      ),
    ).toBe(true);
  });

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns true for identical battle-test zoned datetime in ${timeZone}`, () => {
      expect(areZonedEqualBy(value, value, "day")).toBe(true);
    });
  }
});

// Across zone transitions, two values in the same zone are equal by `unit` only when they fall in
// the same real local bucket (see `startOfZoned`) — the bucket starts are compared as instants,
// as `areUnixEqualBy` does. Chatham's 15-minute 03:00 hour is a bucket of its own, so 03:50 and
// 04:05 are different hours; New York's two 01:00 hours share a label but not a bucket. Every
// start verified against `floorToZone` on @js-temporal/polyfill@0.5.1.
describe("areZonedEqualBy across zone transitions", () => {
  it.each`
    value1                                            | value2                                            | unit      | expected | description
    ${"2024-09-29T03:50:00+13:45[Pacific/Chatham]"}   | ${"2024-09-29T04:05:00+13:45[Pacific/Chatham]"}   | ${"hour"} | ${false} | ${"the 15-minute 03:00 hour and the 04:00 hour"}
    ${"2024-09-29T03:46:00+13:45[Pacific/Chatham]"}   | ${"2024-09-29T03:59:00+13:45[Pacific/Chatham]"}   | ${"hour"} | ${true}  | ${"both inside the 15-minute 03:00 hour"}
    ${"2024-04-07T02:50:00+13:45[Pacific/Chatham]"}   | ${"2024-04-07T02:50:00+12:45[Pacific/Chatham]"}   | ${"hour"} | ${false} | ${"Chatham's 02:00 hour and the 02:45 hour opened by its fall-back"}
    ${"2020-10-04T00:00:30+08:00[Antarctica/Casey]"}  | ${"2020-10-04T03:30:00+11:00[Antarctica/Casey]"}  | ${"hour"} | ${false} | ${"Casey's 00:00 hour and the 03:01 hour after its jump"}
    ${"2024-11-03T01:30:00-04:00[America/New_York]"}  | ${"2024-11-03T01:30:00-05:00[America/New_York]"}  | ${"hour"} | ${false} | ${"both passes of New York's repeated hour read 01:00 locally, but are different real hours"}
    ${"2024-11-03T01:30:00-04:00[America/New_York]"}  | ${"2024-11-03T01:30:00-05:00[America/New_York]"}  | ${"day"}  | ${true}  | ${"both passes sit in the same 25-hour day"}
    ${"2024-11-03T00:30:00-04:00[America/Havana]"}    | ${"2024-11-03T00:30:00-05:00[America/Havana]"}    | ${"hour"} | ${false} | ${"both passes of Havana's repeated midnight hour are different real hours"}
    ${"2024-11-03T00:30:00-04:00[America/Havana]"}    | ${"2024-11-03T00:30:00-05:00[America/Havana]"}    | ${"day"}  | ${true}  | ${"both passes sit in Havana's one 25-hour day"}
    ${"2010-11-06T23:30:00-03:00[America/Goose_Bay]"} | ${"2010-11-06T23:30:00-04:00[America/Goose_Bay]"} | ${"day"}  | ${false} | ${"Goose Bay's 00:01 fall-back changes the label back to 6 November, re-opening a new day bucket"}
  `(
    "returns $expected for $value1 and $value2 by $unit ($description)",
    ({ value1, value2, unit, expected }) => {
      expect(areZonedEqualBy(value1, value2, unit)).toBe(expected);
    },
  );

  // Temporal §13.17 GetTemporalUnitValuedOption: a plural unit name is the same unit as its singular.
  it.each`
    unit              | value1                                                  | value2                                                  | expected
    ${"years"}        | ${"2024-01-01T12:00:00+01:00[Europe/Berlin]"}           | ${"2024-12-31T12:00:00+01:00[Europe/Berlin]"}           | ${true}
    ${"years"}        | ${"2024-12-31T12:00:00+01:00[Europe/Berlin]"}           | ${"2025-01-01T12:00:00+01:00[Europe/Berlin]"}           | ${false}
    ${"months"}       | ${"2024-02-01T12:00:00+01:00[Europe/Berlin]"}           | ${"2024-02-29T12:00:00+01:00[Europe/Berlin]"}           | ${true}
    ${"months"}       | ${"2024-02-29T12:00:00+01:00[Europe/Berlin]"}           | ${"2024-03-01T12:00:00+01:00[Europe/Berlin]"}           | ${false}
    ${"weeks"}        | ${"2024-02-26T12:00:00+01:00[Europe/Berlin]"}           | ${"2024-03-03T12:00:00+01:00[Europe/Berlin]"}           | ${true}
    ${"weeks"}        | ${"2024-03-03T12:00:00+01:00[Europe/Berlin]"}           | ${"2024-03-04T12:00:00+01:00[Europe/Berlin]"}           | ${false}
    ${"days"}         | ${"2024-02-29T12:00:00+01:00[Europe/Berlin]"}           | ${"2024-02-29T12:00:00+01:00[Europe/Berlin]"}           | ${true}
    ${"days"}         | ${"2024-02-29T12:00:00+01:00[Europe/Berlin]"}           | ${"2024-03-01T12:00:00+01:00[Europe/Berlin]"}           | ${false}
    ${"hours"}        | ${"2024-02-29T13:00:00+01:00[Europe/Berlin]"}           | ${"2024-02-29T13:59:59.999999999+01:00[Europe/Berlin]"} | ${true}
    ${"hours"}        | ${"2024-02-29T13:59:59.999999999+01:00[Europe/Berlin]"} | ${"2024-02-29T14:00:00+01:00[Europe/Berlin]"}           | ${false}
    ${"minutes"}      | ${"2024-02-29T13:45:00+01:00[Europe/Berlin]"}           | ${"2024-02-29T13:45:59.999999999+01:00[Europe/Berlin]"} | ${true}
    ${"minutes"}      | ${"2024-02-29T13:45:59.999999999+01:00[Europe/Berlin]"} | ${"2024-02-29T13:46:00+01:00[Europe/Berlin]"}           | ${false}
    ${"seconds"}      | ${"2024-02-29T13:45:30+01:00[Europe/Berlin]"}           | ${"2024-02-29T13:45:30.999999999+01:00[Europe/Berlin]"} | ${true}
    ${"seconds"}      | ${"2024-02-29T13:45:30.999999999+01:00[Europe/Berlin]"} | ${"2024-02-29T13:45:31+01:00[Europe/Berlin]"}           | ${false}
    ${"milliseconds"} | ${"2024-02-29T13:45:30.123+01:00[Europe/Berlin]"}       | ${"2024-02-29T13:45:30.123999999+01:00[Europe/Berlin]"} | ${true}
    ${"milliseconds"} | ${"2024-02-29T13:45:30.123999999+01:00[Europe/Berlin]"} | ${"2024-02-29T13:45:30.124+01:00[Europe/Berlin]"}       | ${false}
    ${"microseconds"} | ${"2024-02-29T13:45:30.123456+01:00[Europe/Berlin]"}    | ${"2024-02-29T13:45:30.123456999+01:00[Europe/Berlin]"} | ${true}
    ${"microseconds"} | ${"2024-02-29T13:45:30.123456999+01:00[Europe/Berlin]"} | ${"2024-02-29T13:45:30.123457+01:00[Europe/Berlin]"}    | ${false}
    ${"nanoseconds"}  | ${"2024-02-29T13:45:30.123456789+01:00[Europe/Berlin]"} | ${"2024-02-29T13:45:30.123456789+01:00[Europe/Berlin]"} | ${true}
    ${"nanoseconds"}  | ${"2024-02-29T13:45:30.123456789+01:00[Europe/Berlin]"} | ${"2024-02-29T13:45:30.12345679+01:00[Europe/Berlin]"}  | ${false}
  `(
    "returns $expected for $value1 and $value2 by plural unit $unit",
    ({ unit, value1, value2, expected }) => {
      expect(areZonedEqualBy(value1, value2, unit)).toBe(expected);
    },
  );

  // weekStartsOn only names "monday" or "sunday"; any other value is invalid input, for every unit
  // (Temporal GetOption rejects a value outside its allowed list; undefined means the default).
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
    "returns false by unit $unit with invalid weekStartsOn $weekStartsOn",
    ({ unit, weekStartsOn }) => {
      expect(
        areZonedEqualBy(
          "2024-02-29T13:45:30+01:00[Europe/Berlin]",
          "2024-02-29T13:45:30+01:00[Europe/Berlin]",
          unit,
          { weekStartsOn },
        ),
      ).toBe(false);
    },
  );
});

// The 1844 date-line crossings (zoned.E): Asia/Manila, Pacific/Guam, Saipan, Kosrae and Palau
// skipped 1844-12-31, jumping a whole day forward at local 1844-12-31T00:00 in LMT. Expected values
// are Chromium 153 native Temporal, never the polyfill (whose transition search starts at
// 1847-01-01). `dateLineCrossingAt(zone, h)` is the zone h hours from its crossing, from exact time.

describe("areZonedEqualBy across the 1844 date-line crossings (zoned.E)", () => {
  // Monday 1844-12-30 and Thursday 1845-01-02 share a week; Sunday 12-29 closes the one before.
  it.each(dateLineCrossingTimeZones)(
    "puts 1844-12-30 and 1845-01-02 in one week in $timeZone, and 1844-12-29 in the one before",
    (crossing) => {
      const monday = dateLineCrossingAt(crossing, -12).toString();
      expect(
        areZonedEqualBy(
          monday,
          dateLineCrossingAt(crossing, 36).toString(),
          "week",
        ),
      ).toBe(true);
      expect(
        areZonedEqualBy(
          monday,
          dateLineCrossingAt(crossing, -36).toString(),
          "week",
        ),
      ).toBe(false);
    },
  );
});
