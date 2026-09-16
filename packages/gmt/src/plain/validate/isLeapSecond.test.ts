import { isLeapSecond } from "./isLeapSecond";

describe("isLeapSecond", () => {
  it.each`
    value
    ${"2024-12-31T23:59:60Z"}
    ${"2024-12-31T23:59:60.123Z"}
    ${"2024-12-31T23:59:60+00:00"}
    ${"2024-12-31T23:59:60.123+00:00"}
    ${"2024-12-31t23:59:60Z"}
    ${"2024-12-31 23:59:60Z"}
    ${"2024-12-31T235960Z"}
    ${"20241231T235960+00:00[UTC]"}
  `("returns true for valid leap second datetime $value", ({ value }) => {
    expect(isLeapSecond(value)).toBe(true);
  });

  it.each`
    value
    ${"2024-12-31T23:59:59Z"}
    ${"2024-12-31T23:59:61Z"}
    ${"2024-12-31T23:59:60"}
    ${"2024-12-31T23:59:60.123"}
    ${"2024-01-01T00:00:00Z[x=T123460Z]"}
  `("returns false for non-leap second datetime $value", ({ value }) => {
    expect(isLeapSecond(value)).toBe(false);
  });
});
