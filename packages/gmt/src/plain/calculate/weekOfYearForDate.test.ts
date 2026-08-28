import { weekOfYearForDate } from "./weekOfYearForDate";

describe("weekOfYearForDate", () => {
  it.each`
    value           | expected
    ${"2024-01-01"} | ${1}
    ${"2024-01-07"} | ${1}
    ${"2024-01-08"} | ${2}
    ${"2024-12-31"} | ${1}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(weekOfYearForDate(value)).toBe(expected);
  });

  it.each`
    nonStringInput
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-01-01T00:00:00"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
    ${[]}
  `(
    "returns null for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(weekOfYearForDate(nonStringInput)).toBeNull();
    },
  );
});
