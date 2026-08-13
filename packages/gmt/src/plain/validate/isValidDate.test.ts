import { isValidDate } from "./isValidDate";

describe("isValidDate", () => {
  it.each`
    value
    ${"2024-02-29"}
    ${"2024-01-01"}
    ${"2024-12-31"}
    ${"2024-03-31"}
    ${"0000-01-01"}
    ${"+001234-12-31"}
  `("returns true for valid date: $value", ({ value }: { value: string }) => {
    expect(isValidDate(value)).toBe(true);
  });

  it.each`
    value
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
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
