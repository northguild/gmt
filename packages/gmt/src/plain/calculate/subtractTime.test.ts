import { subtractTime } from "./subtractTime";

describe("subtractTime", () => {
  it.each`
    value         | amount  | unit             | expected
    ${"14:30:00"} | ${2}    | ${"hour"}        | ${"12:30:00"}
    ${"14:30:00"} | ${45}   | ${"minute"}      | ${"13:45:00"}
    ${"00:00:30"} | ${45}   | ${"second"}      | ${"23:59:45"}
    ${"14:30:00"} | ${250}  | ${"millisecond"} | ${"14:29:59.75"}
    ${"14:30:00"} | ${500}  | ${"microsecond"} | ${"14:29:59.9995"}
    ${"14:30:00"} | ${1000} | ${"nanosecond"}  | ${"14:29:59.999999"}
  `(
    "returns $expected for $value - $amount $unit",
    ({ value, amount, unit, expected }) => {
      expect(subtractTime(value, amount, unit)).toBe(expected);
    },
  );

  it.each`
    negativeAmount | expectedTime
    ${-1}          | ${"14:31:00"}
    ${-30}         | ${"15:00:00"}
    ${-90}         | ${"16:00:00"}
  `(
    "returns $expectedTime for $value - $negativeAmount minutes",
    ({ negativeAmount, expectedTime }) => {
      expect(subtractTime("14:30:00", negativeAmount, "minute")).toBe(
        expectedTime,
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
      expect(subtractTime("14:30:00", invalidAmount as never, "minute")).toBe(
        "",
      );
    },
  );

  it.each`
    invalidValue
    ${"not-a-time"}
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
    "returns an empty string for an invalid time value: $invalidValue",
    ({ invalidValue }) => {
      expect(subtractTime(invalidValue as never, 30, "minute")).toBe("");
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
      expect(subtractTime("14:30:00", 1, invalidUnit as never)).toBe("");
    },
  );
});
