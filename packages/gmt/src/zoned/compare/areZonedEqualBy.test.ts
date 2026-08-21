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
