import { addDateTime } from "./addDateTime";

describe("addDateTime", () => {
  it.each`
    value                 | amount  | unit             | expected
    ${"2024-02-29T14:30"} | ${1}    | ${"year"}        | ${"2025-02-28T14:30:00"}
    ${"2024-02-29T14:30"} | ${1}    | ${"month"}       | ${"2024-03-29T14:30:00"}
    ${"2024-02-29T14:30"} | ${2}    | ${"week"}        | ${"2024-03-14T14:30:00"}
    ${"2024-02-29T14:30"} | ${1}    | ${"day"}         | ${"2024-03-01T14:30:00"}
    ${"2024-02-29T14:30"} | ${2}    | ${"hour"}        | ${"2024-02-29T16:30:00"}
    ${"2024-02-29T14:30"} | ${45}   | ${"minute"}      | ${"2024-02-29T15:15:00"}
    ${"2024-02-29T14:30"} | ${45}   | ${"second"}      | ${"2024-02-29T14:30:45"}
    ${"2024-02-29T14:30"} | ${250}  | ${"millisecond"} | ${"2024-02-29T14:30:00.25"}
    ${"2024-02-29T14:30"} | ${500}  | ${"microsecond"} | ${"2024-02-29T14:30:00.0005"}
    ${"2024-02-29T14:30"} | ${1000} | ${"nanosecond"}  | ${"2024-02-29T14:30:00.000001"}
  `(
    "returns $expected for $value + $amount $unit",
    ({ value, amount, unit, expected }) => {
      expect(addDateTime(value, amount, unit)).toBe(expected);
    },
  );

  it.each`
    negativeAmount | expectedDateTime
    ${-1}          | ${"2024-02-29T14:29:00"}
    ${-30}         | ${"2024-02-29T14:00:00"}
    ${-90}         | ${"2024-02-29T13:00:00"}
  `(
    "returns $expectedDateTime when adding a negative amount: $negativeAmount",
    ({ negativeAmount, expectedDateTime }) => {
      expect(addDateTime("2024-02-29T14:30", negativeAmount, "minute")).toBe(
        expectedDateTime,
      );
    },
  );

  it.each`
    invalidAmount
    ${"not-a-number"}
    ${NaN}
    ${null}
    ${undefined}
    ${true}
    ${false}
    ${""}
  `(
    "returns an empty string for an invalid amount: $invalidAmount",
    ({ invalidAmount }) => {
      expect(addDateTime("2024-02-29T14:30", invalidAmount, "minute")).toBe("");
    },
  );

  it.each`
    invalidValue
    ${"not-a-datetime"}
    ${"2024-02-30T14:30:00"}
    ${"2024-02-30T14:30:00Z"}
    ${"2024-02-30"}
    ${NaN}
    ${null}
    ${undefined}
    ${true}
    ${false}
    ${""}
  `(
    "returns an empty string for an invalid datetime: $invalidValue",
    ({ invalidValue }) => {
      expect(addDateTime(invalidValue, 30, "minute")).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for an invalid unit: $invalidUnit",
    ({ invalidUnit }) => {
      expect(addDateTime("2024-02-29T14:30", 1, invalidUnit)).toBe("");
    },
  );
});
