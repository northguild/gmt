import { weekOfYearForDateTime } from "./weekOfYearForDateTime";

describe("weekOfYearForDateTime", () => {
  it.each`
    value                    | expected
    ${"2024-01-01T12:00:00"} | ${1}
    ${"2024-01-08T00:00:00"} | ${2}
    ${"2024-12-31T23:59:59"} | ${1}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(weekOfYearForDateTime(value)).toBe(expected);
  });

  it.each`
    nonStringInput
    ${"invalid-datetime"}
    ${"2024-02-30T00:00:00"}
    ${"2024-01-01"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
    ${[]}
  `(
    "returns null for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(weekOfYearForDateTime(nonStringInput)).toBeNull();
    },
  );
});
