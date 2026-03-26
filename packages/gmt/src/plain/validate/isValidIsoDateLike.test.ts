import { isValidIsoDateLike } from "./isValidIsoDateLike";

describe("isValidIsoDateLike", () => {
  it.each`
    value
    ${"2024-02-29"}
    ${"2024-02-29T00:00:00"}
    ${"2024-02-29T12:30:45"}
    ${"2024-02-29T23:59:59"}
    ${"2024-02-29T12:30:45.123"}
    ${"+001234-12-31"}
    ${"+001234-12-31T23:59:59"}
  `(
    "returns true for valid date or datetime string $value",
    ({ value }: { value: string }) => {
      expect(isValidIsoDateLike(value)).toBe(true);
    },
  );

  it.each`
    value
    ${"2024-02-30"}
    ${"2024-02-29T24:00:00"}
    ${"2024-02-29T12:60:00"}
    ${"2024-02-29T12:30:60"}
    ${"2024-02-29T12:30:45.1234567890"}
    ${"invalid-date"}
    ${""}
    ${null}
    ${undefined}
    ${NaN}
    ${true}
    ${false}
  `(
    "returns false for invalid date or datetime string $value",
    ({ value }: { value: string }) => {
      expect(isValidIsoDateLike(value)).toBe(false);
    },
  );
});
