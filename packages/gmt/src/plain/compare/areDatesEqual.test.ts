import { areDatesEqual } from "./areDatesEqual";

describe("areDatesEqual", () => {
  it.each`
    value1          | value2
    ${"2024-01-01"} | ${"2024-01-01"}
    ${"0000-01-01"} | ${"0000-01-01"}
  `(
    "returns true when comparing valid dates $value1 to $value2",
    ({ value1, value2 }) => {
      expect(areDatesEqual(value1, value2)).toBe(true);
    },
  );

  it.each`
    value1                   | value2
    ${"2024-01-01T06:00:00"} | ${"2024-01-01T00:00:00"}
    ${"2024-01-01T06:00:00"} | ${"2024-01-01T07:00:00"}
  `(
    "returns true for edge-case equivalent dates $value1 and $value2",
    ({ value1, value2 }) => {
      expect(areDatesEqual(value1, value2)).toBe(true);
    },
  );

  it.each`
    value1          | value2
    ${"2024-01-01"} | ${"2024-01-02"}
    ${""}           | ${""}
  `(
    "returns false for non-equal or empty values $value1 and $value2",
    ({ value1, value2 }) => {
      expect(areDatesEqual(value1, value2)).toBe(false);
    },
  );

  it.each`
    invalidValue1   | value2
    ${"not-a-date"} | ${"2024-01-01"}
    ${null}         | ${"2024-01-01"}
    ${undefined}    | ${"2024-01-01"}
  `(
    "returns false for invalid first value $invalidValue1",
    ({ invalidValue1, value2 }) => {
      expect(areDatesEqual(invalidValue1 as never, value2)).toBe(false);
    },
  );

  it.each`
    value1          | invalidValue2
    ${"2024-01-01"} | ${"not-a-date"}
    ${"2024-01-01"} | ${null}
    ${"2024-01-01"} | ${undefined}
  `(
    "returns false for invalid second value $invalidValue2",
    ({ value1, invalidValue2 }) => {
      expect(areDatesEqual(value1, invalidValue2 as never)).toBe(false);
    },
  );
});
