import { isValidDate } from "./isValidDate";

describe("isValidDate", () => {
  it.each`
    value
    ${"2026-01-31"}
    ${"2026-01-31"}
    ${"2024-02-29"}
    ${"0000-01-01"}
    ${"-000001-01-01"}
    ${"+001234-12-31"}
  `("returns true for valid date: $value", ({ value }: { value: string }) => {
    expect(isValidDate(value)).toBe(true);
  });

  it.each`
    value
    ${"2026-1-31"}
    ${"2024-02-30"}
    ${"2024-02-28T00:00:00"}
    ${"2023-02-29"}
    ${"-0001-01-01"}
    ${"not-a-date"}
  `(
    "returns false for invalid date: $value",
    ({ value }: { value: string }) => {
      expect(isValidDate(value)).toBe(false);
    },
  );
});
