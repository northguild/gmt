import { areUnixEqualBy } from "./areUnixEqualBy";

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
