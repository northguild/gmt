import { startOfQuarterForUtc } from "./startOfQuarterForUtc";

describe("startOfQuarterForUtc", () => {
  it.each`
    value                     | expected
    ${"2024-01-15T12:00:00Z"} | ${"2024-01-01T00:00:00Z"}
    ${"2024-04-15T12:00:00Z"} | ${"2024-04-01T00:00:00Z"}
    ${"2024-07-15T12:00:00Z"} | ${"2024-07-01T00:00:00Z"}
    ${"2024-10-15T12:00:00Z"} | ${"2024-10-01T00:00:00Z"}
    ${"2024-03-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"}
    ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(startOfQuarterForUtc(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-29T12:00:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(startOfQuarterForUtc(invalidValue as never)).toBe("");
    },
  );
});
