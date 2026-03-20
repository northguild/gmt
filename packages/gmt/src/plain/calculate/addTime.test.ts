import { addTime } from "./addTime";

describe("addTime", () => {
  it.each`
    value         | amount  | unit             | expected
    ${"14:30:00"} | ${2}    | ${"hour"}        | ${"16:30:00"}
    ${"14:30:00"} | ${45}   | ${"minute"}      | ${"15:15:00"}
    ${"23:59:30"} | ${45}   | ${"second"}      | ${"00:00:15"}
    ${"14:30:00"} | ${250}  | ${"millisecond"} | ${"14:30:00.25"}
    ${"14:30:00"} | ${500}  | ${"microsecond"} | ${"14:30:00.0005"}
    ${"14:30:00"} | ${1000} | ${"nanosecond"}  | ${"14:30:00.000001"}
  `(
    "returns $expected for $value + $amount $unit",
    ({ value, amount, unit, expected }) => {
      expect(addTime(value, amount, unit)).toBe(expected);
    },
  );

  it.each`
    negativeAmount | expectedTime
    ${-1}          | ${"14:29:00"}
    ${-30}         | ${"14:00:00"}
    ${-90}         | ${"13:00:00"}
  `(
    "returns $expectedTime for $value + $negativeAmount minutes",
    ({
      negativeAmount,
      expectedTime,
    }: {
      negativeAmount: number;
      expectedTime: string;
    }) => {
      expect(addTime("14:30:00", negativeAmount, "minute")).toBe(expectedTime);
    },
  );

  it.each`
    invalidAmount     | expected
    ${"not-a-number"} | ${""}
    ${NaN}            | ${""}
    ${null}           | ${""}
    ${undefined}      | ${""}
    ${true}           | ${""}
    ${false}          | ${""}
    ${""}             | ${""}
  `(
    "returns an empty string for an invalid amount: $invalidAmount",
    ({ invalidAmount, expected }) => {
      expect(addTime("14:30:00", invalidAmount as never, "minute")).toBe(
        expected,
      );
    },
  );

  it.each`
    invalidValue
    ${"not-a-time"}
    ${"2024-02-30T14:30:00"}
    ${"2024-02-30T14:30:00Z"}
    ${"2024-02-30"}
    ${NaN}                    | ${""}
    ${null}                   | ${""}
    ${undefined}              | ${""}
    ${true}                   | ${""}
    ${false}                  | ${""}
    ${""}                     | ${""}
  `(
    "returns an empty string for an invalid time value: $invalidValue",
    ({ invalidValue }) => {
      expect(addTime(invalidValue, 30, "minute")).toBe("");
    },
  );
});
