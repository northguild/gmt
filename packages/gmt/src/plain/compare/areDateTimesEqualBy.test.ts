import { areDateTimesEqualBy } from "./areDateTimesEqualBy";

describe("areDateTimesEqualBy", () => {
  it.each`
    value1                             | value2                             | unit
    ${"2024-03-15T10:00:00"}           | ${"2024-03-15T20:00:00"}           | ${"day"}
    ${"2024-03-01T00:00:00"}           | ${"2024-03-31T23:59:59"}           | ${"month"}
    ${"2024-01-01T00:00:00"}           | ${"2024-12-31T23:59:59"}           | ${"year"}
    ${"2024-03-11T00:00:00"}           | ${"2024-03-17T23:59:59"}           | ${"week"}
    ${"2024-03-15T10:15:00"}           | ${"2024-03-15T10:45:00"}           | ${"hour"}
    ${"2024-03-15T10:15:30"}           | ${"2024-03-15T10:15:59"}           | ${"minute"}
    ${"2024-03-15T10:15:30.100"}       | ${"2024-03-15T10:15:30.900"}       | ${"second"}
    ${"2024-03-15T10:15:30.100100"}    | ${"2024-03-15T10:15:30.100900"}    | ${"millisecond"}
    ${"2024-03-15T10:15:30.100100100"} | ${"2024-03-15T10:15:30.100100900"} | ${"microsecond"}
    ${"2024-03-15T10:15:30.100100100"} | ${"2024-03-15T10:15:30.100100100"} | ${"nanosecond"}
  `(
    "returns true for $value1 and $value2 equal by $unit",
    ({ value1, value2, unit }) => {
      expect(areDateTimesEqualBy(value1, value2, unit)).toBe(true);
    },
  );

  it.each`
    value1                             | value2                             | unit
    ${"2024-03-15T10:00:00"}           | ${"2024-03-16T10:00:00"}           | ${"day"}
    ${"2024-03-31T00:00:00"}           | ${"2024-04-01T00:00:00"}           | ${"month"}
    ${"2024-01-01T00:00:00"}           | ${"2025-01-01T00:00:00"}           | ${"year"}
    ${"2024-03-17T00:00:00"}           | ${"2024-03-18T00:00:00"}           | ${"week"}
    ${"2024-03-15T10:00:00"}           | ${"2024-03-15T11:00:00"}           | ${"hour"}
    ${"2024-03-15T10:15:00"}           | ${"2024-03-15T10:16:00"}           | ${"minute"}
    ${"2024-03-15T10:15:30.000"}       | ${"2024-03-15T10:15:31.000"}       | ${"second"}
    ${"2024-03-15T10:15:30.100"}       | ${"2024-03-15T10:15:30.200"}       | ${"millisecond"}
    ${"2024-03-15T10:15:30.100100100"} | ${"2024-03-15T10:15:30.100200100"} | ${"microsecond"}
    ${"2024-03-15T10:15:30.100100100"} | ${"2024-03-15T10:15:30.100100200"} | ${"nanosecond"}
  `(
    "returns false for $value1 and $value2 unequal by $unit",
    ({ value1, value2, unit }) => {
      expect(areDateTimesEqualBy(value1, value2, unit)).toBe(false);
    },
  );

  it("returns false when the same month falls in different years", () => {
    expect(
      areDateTimesEqualBy(
        "2023-03-15T00:00:00",
        "2024-03-15T00:00:00",
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
        areDateTimesEqualBy(
          "2024-03-11T00:00:00",
          "2024-03-17T00:00:00",
          "week",
          { weekStartsOn },
        ),
      ).toBe(expected);
    },
  );

  it("returns false for an unsupported unit", () => {
    expect(
      areDateTimesEqualBy(
        "2024-03-15T00:00:00",
        "2024-03-15T00:00:00",
        "decade" as never,
      ),
    ).toBe(false);
  });

  it.each`
    value1                   | value2
    ${""}                    | ${""}
    ${null}                  | ${"2024-03-15T00:00:00"}
    ${undefined}             | ${"2024-03-15T00:00:00"}
    ${"not-a-datetime"}      | ${"2024-03-15T00:00:00"}
    ${"2024-03-15T00:00:00"} | ${null}
    ${"2024-03-15T00:00:00"} | ${undefined}
    ${"2024-03-15T00:00:00"} | ${"not-a-datetime"}
  `(
    "returns false for invalid input $value1 and $value2",
    ({ value1, value2 }) => {
      expect(
        areDateTimesEqualBy(value1 as never, value2 as never, "month"),
      ).toBe(false);
    },
  );
});
