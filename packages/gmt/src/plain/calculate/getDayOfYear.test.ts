import { getDayOfYear } from "./getDayOfYear";

describe("getDayOfYear", () => {
  it.each`
    value           | expected
    ${"2024-01-01"} | ${1}
    ${"2023-01-01"} | ${1}
    ${"2023-03-01"} | ${60}
    ${"2024-03-01"} | ${61}
    ${"2024-12-31"} | ${366}
    ${"2023-12-31"} | ${365}
    ${"2024-02-29"} | ${60}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(getDayOfYear(value)).toBe(expected);
  });

  it.each`
    nonStringInput
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
    ${[]}
  `(
    "returns null for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(getDayOfYear(nonStringInput)).toBeNull();
    },
  );
});
