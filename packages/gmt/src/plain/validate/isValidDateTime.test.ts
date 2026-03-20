import { isValidDateTime } from "./isValidDateTime";

describe("isValidDateTime", () => {
  it.each`
    value
    ${"2026-01-31T23:59:59"}
    ${"2024-02-29T08:30:45.123"}
    ${"0000-01-01T00:00"}
    ${"-000001-12-31T23:59"}
    ${"2024-02-29T08:30:45,123"}
  `(
    "returns true for valid date-time: $value",
    ({ value }: { value: string }) => {
      expect(isValidDateTime(value)).toBe(true);
    },
  );

  it.each`
    value
    ${"2026-1-31T23:59:59"}
    ${"2026-02-30T12:00:00"}
    ${"2026-01-31 23:59:59"}
    ${"2026-01-31T24:00:00"}
    ${"2024-02-29T23:59:60"}
    ${"2026-01-31T12:00:00.1234567891"}
    ${"-0001-01-01T00:00"}
  `(
    "returns false for invalid date-time: $value",
    ({ value }: { value: string }) => {
      expect(isValidDateTime(value)).toBe(false);
    },
  );
});
