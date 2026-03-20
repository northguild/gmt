import { areTimesEqual } from "./areTimesEqual";

describe("areTimesEqual", () => {
  it.each`
    value1            | value2
    ${"08:30"}        | ${"08:30:00"}
    ${"08:30:45.123"} | ${"08:30:45,123"}
  `(
    "returns true for valid equivalent times $value1 and $value2",
    ({ value1, value2 }) => {
      expect(areTimesEqual(value1, value2)).toBe(true);
    },
  );

  it.each`
    value1        | value2
    ${"08:30"}    | ${"08:31"}
    ${"23:59:60"} | ${"23:59:60.0"}
  `(
    "returns false for non-equal or disallowed times $value1 and $value2",
    ({ value1, value2 }) => {
      expect(areTimesEqual(value1, value2)).toBe(false);
    },
  );

  it.each`
    invalidValue1     | value2
    ${"invalid-time"} | ${"08:30"}
    ${null}           | ${"08:30"}
    ${undefined}      | ${"08:30"}
  `(
    "returns false for invalid first value $invalidValue1",
    ({ invalidValue1, value2 }) => {
      expect(areTimesEqual(invalidValue1 as never, value2)).toBe(false);
    },
  );

  it.each`
    value1     | invalidValue2
    ${"08:30"} | ${"invalid-time"}
    ${"08:30"} | ${null}
    ${"08:30"} | ${undefined}
  `(
    "returns false for invalid second value $invalidValue2",
    ({ value1, invalidValue2 }) => {
      expect(areTimesEqual(value1, invalidValue2 as never)).toBe(false);
    },
  );
});
