import { isValidUtc } from "./isValidUtc";

describe("isValidUtc", () => {
  it.each`
    value
    ${"2024-02-29T14:30Z"}
    ${"2024-02-29T14:30:45Z"}
    ${"2024-02-29T14:30:45.123Z"}
    ${"2024-02-29T14:30:45,999Z"}
    ${"+001234-12-31T23:59:59Z"}
  `(
    "returns true for valid UTC datetime: $value",
    ({ value }: { value: string }) => {
      expect(isValidUtc(value)).toBe(true);
    },
  );

  it.each`
    value
    ${"2024-02-29T14:30"}
    ${"2024-02-29T14:30:45"}
    ${"2024-02-29"}
    ${"2024-02-29T24:00:00Z"}
    ${"not-a-datetime"}
    ${"2024-02-29T14:30Z "}
  `(
    "returns false for invalid UTC datetime: $value",
    ({ value }: { value: string }) => {
      expect(isValidUtc(value)).toBe(false);
    },
  );
});
