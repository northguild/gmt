// Sometimes a UTC datetime needs to be treated as a plain local datetime string.
// This helper removes only the trailing Z/z marker and preserves the time portion.
import { chopUtc } from "./chopUtc";

describe("chopUtc", () => {
  it.each`
    value                         | expected
    ${"2024-02-29T00:00:00Z"}     | ${"2024-02-29T00:00:00"}
    ${"2024-02-29T00:00:00z"}     | ${"2024-02-29T00:00:00"}
    ${"2024-02-29T12:30:45Z"}     | ${"2024-02-29T12:30:45"}
    ${"2024-02-29T23:59:59Z"}     | ${"2024-02-29T23:59:59"}
    ${"2024-02-29T12:30:45.123Z"} | ${"2024-02-29T12:30:45.123"}
    ${"2024-02-29T12:30:45,999Z"} | ${"2024-02-29T12:30:45,999"}
    ${"+001234-12-31T23:59:59Z"}  | ${"+001234-12-31T23:59:59"}
  `(
    "returns $expected for $value",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(chopUtc(value)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"2024-02-29T12:30:45"}
    ${"2024-02-29"}
    ${NaN}
    ${null}
    ${undefined}
    ${true}
    ${false}
    ${""}
  `("returns empty string for $invalidValue", ({ invalidValue }) => {
    expect(chopUtc(invalidValue)).toBe("");
  });
});
