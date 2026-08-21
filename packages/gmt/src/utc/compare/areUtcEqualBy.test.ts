import { areUtcEqualBy } from "./areUtcEqualBy";

describe("areUtcEqualBy", () => {
  it.each`
    value1                    | value2                    | unit
    ${"2024-03-15T02:00:00Z"} | ${"2024-03-15T22:00:00Z"} | ${"day"}
    ${"2024-03-01T00:00:00Z"} | ${"2024-03-31T23:59:59Z"} | ${"month"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"year"}
    ${"2024-03-11T00:00:00Z"} | ${"2024-03-17T23:59:59Z"} | ${"week"}
    ${"2024-03-15T10:15:00Z"} | ${"2024-03-15T10:45:00Z"} | ${"hour"}
  `(
    "returns true for $value1 and $value2 equal by $unit",
    ({ value1, value2, unit }) => {
      expect(areUtcEqualBy(value1, value2, unit)).toBe(true);
    },
  );

  it.each`
    value1                    | value2                    | unit
    ${"2024-03-15T23:30:00Z"} | ${"2024-03-16T00:30:00Z"} | ${"day"}
    ${"2024-03-31T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"month"}
    ${"2024-12-31T23:59:59Z"} | ${"2025-01-01T00:00:00Z"} | ${"year"}
    ${"2024-03-17T00:00:00Z"} | ${"2024-03-18T00:00:00Z"} | ${"week"}
    ${"2024-03-15T10:00:00Z"} | ${"2024-03-15T11:00:00Z"} | ${"hour"}
  `(
    "returns false for $value1 and $value2 unequal at the next-finer unit than $unit",
    ({ value1, value2, unit }) => {
      expect(areUtcEqualBy(value1, value2, unit)).toBe(false);
    },
  );

  it("returns false when the same month falls in different years", () => {
    expect(
      areUtcEqualBy("2023-03-15T00:00:00Z", "2024-03-15T00:00:00Z", "month"),
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
        areUtcEqualBy("2024-03-11T00:00:00Z", "2024-03-17T00:00:00Z", "week", {
          weekStartsOn,
        }),
      ).toBe(expected);
    },
  );

  it("returns false for an unsupported unit", () => {
    expect(
      areUtcEqualBy(
        "2024-03-15T00:00:00Z",
        "2024-03-15T00:00:00Z",
        "decade" as never,
      ),
    ).toBe(false);
  });

  it.each`
    value1                    | value2
    ${""}                     | ${""}
    ${null}                   | ${"2024-03-15T00:00:00Z"}
    ${undefined}              | ${"2024-03-15T00:00:00Z"}
    ${"not-a-utc-datetime"}   | ${"2024-03-15T00:00:00Z"}
    ${"2024-03-15T00:00:00Z"} | ${null}
    ${"2024-03-15T00:00:00Z"} | ${undefined}
    ${"2024-03-15T00:00:00Z"} | ${"not-a-utc-datetime"}
  `(
    "returns false for invalid input $value1 and $value2",
    ({ value1, value2 }) => {
      expect(areUtcEqualBy(value1 as never, value2 as never, "month")).toBe(
        false,
      );
    },
  );
});
