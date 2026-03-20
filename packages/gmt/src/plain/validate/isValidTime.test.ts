import { isValidTime } from "./isValidTime";

describe("isValidTime", () => {
  it.each`
    value
    ${"00:00:00"}
    ${"23:59:59"}
    ${"08:30"}
    ${"08:30:45.123"}
    ${"08:30:45,123"}
    ${"12:34:56.123456789"}
  `("returns true for valid time: $value", ({ value }: { value: string }) => {
    expect(isValidTime(value)).toBe(true);
  });

  it.each`
    value
    ${"8:30:45"}
    ${"24:00:00"}
    ${"23:59:60"}
    ${"12:34:56.1234567891"}
    ${"hello"}
  `(
    "returns false for invalid time: $value",
    ({ value }: { value: string }) => {
      expect(isValidTime(value)).toBe(false);
    },
  );
});
