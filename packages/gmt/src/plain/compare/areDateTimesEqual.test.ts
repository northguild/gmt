import { areDateTimesEqual } from "./areDateTimesEqual";

describe("areDateTimesEqual", () => {
  it("returns true for identical DateTimes", () => {
    expect(
      areDateTimesEqual("2024-01-01T12:00:00", "2024-01-01T12:00:00"),
    ).toBe(true);
  });

  it.each`
    value1                       | value2                       | expected
    ${"2024-01-01T08:30"}        | ${"2024-01-01T08:30:00"}     | ${true}
    ${"2024-01-01T08:30:45.123"} | ${"2024-01-01T08:30:45,123"} | ${true}
    ${"-000001-01-01T00:00"}     | ${"-000001-01-01T00:00:00"}  | ${true}
    ${"2024-01-01T08:30"}        | ${"2024-01-01T08:31"}        | ${false}
    ${"2024-01-01T08:30"}        | ${"invalid-datetime"}        | ${false}
  `(
    "returns $expected when comparing $value1 to $value2",
    ({
      value1,
      value2,
      expected,
    }: {
      value1: string;
      value2: string;
      expected: boolean;
    }) => {
      expect(areDateTimesEqual(value1, value2)).toBe(expected);
    },
  );
});
