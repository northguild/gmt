import { isValidDateTime } from "./isValidDateTime";

describe("isValidDateTime", () => {
  it.each`
    value
    ${"2024-02-29T00:00:00"}
    ${"2024-02-29T12:00:00"}
    ${"2024-02-29T23:59:59"}
    ${"2024-02-29T08:30:45.123"}
    ${"0000-01-01T00:00"}
    ${"+001234-12-31T23:59"}
  `(
    "returns true for valid date-time: $value",
    ({ value }: { value: string }) => {
      expect(isValidDateTime(value)).toBe(true);
    },
  );

  it.each`
    value
    ${"2024-02-30T12:00:00"}
    ${"2024-02-29T24:00:00"}
    ${"2024-02-29T23:59:60"}
    ${"2024-02-29T12:30:45.1234567891"}
    ${"-0001-01-01T00:00"}
    ${"not-a-datetime"}
  `(
    "returns false for invalid date-time: $value",
    ({ value }: { value: string }) => {
      expect(isValidDateTime(value)).toBe(false);
    },
  );
});
