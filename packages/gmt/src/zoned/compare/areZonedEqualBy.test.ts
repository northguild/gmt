import { localNoonBattleCases, sameInstantBattleCases } from "../../test";
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

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns true for identical battle-test zoned datetime in ${timeZone}`, () => {
      expect(areZonedEqualBy(value, value, "day")).toBe(true);
    });
  }
});

// Across zone transitions, two values are equal by `unit` when their real local buckets start
// on the same local wall-clock label (see `startOfZoned`). Chatham's 15-minute 03:00 hour is a
// bucket of its own, so 03:50 and 04:05 are different hours even though local 03:00 would
// otherwise resolve after both. Every start verified against `floorToZone` on
// @js-temporal/polyfill@0.5.1.
describe("areZonedEqualBy across zone transitions", () => {
  it.each`
    value1                                           | value2                                           | unit      | expected | description
    ${"2024-09-29T03:50:00+13:45[Pacific/Chatham]"}  | ${"2024-09-29T04:05:00+13:45[Pacific/Chatham]"}  | ${"hour"} | ${false} | ${"the 15-minute 03:00 hour and the 04:00 hour"}
    ${"2024-09-29T03:46:00+13:45[Pacific/Chatham]"}  | ${"2024-09-29T03:59:00+13:45[Pacific/Chatham]"}  | ${"hour"} | ${true}  | ${"both inside the 15-minute 03:00 hour"}
    ${"2024-04-07T02:50:00+13:45[Pacific/Chatham]"}  | ${"2024-04-07T02:50:00+12:45[Pacific/Chatham]"}  | ${"hour"} | ${false} | ${"Chatham's 02:00 hour and the 02:45 hour opened by its fall-back"}
    ${"2020-10-04T00:00:30+08:00[Antarctica/Casey]"} | ${"2020-10-04T03:30:00+11:00[Antarctica/Casey]"} | ${"hour"} | ${false} | ${"Casey's 00:00 hour and the 03:01 hour after its jump"}
    ${"2024-11-03T01:30:00-04:00[America/New_York]"} | ${"2024-11-03T01:30:00-05:00[America/New_York]"} | ${"hour"} | ${true}  | ${"both passes of New York's repeated hour read 01:00 locally"}
  `(
    "returns $expected for $value1 and $value2 by $unit ($description)",
    ({ value1, value2, unit, expected }) => {
      expect(areZonedEqualBy(value1, value2, unit)).toBe(expected);
    },
  );
});
