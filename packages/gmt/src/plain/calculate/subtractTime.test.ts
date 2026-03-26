import { subtractTime } from "./subtractTime";

describe("subtractTime", () => {
  it.each`
    value         | units                    | expected
    ${"14:30:00"} | ${{ hours: 2 }}          | ${"12:30:00"}
    ${"14:30:00"} | ${{ minutes: 45 }}       | ${"13:45:00"}
    ${"00:00:30"} | ${{ seconds: 45 }}       | ${"23:59:45"}
    ${"14:30:00"} | ${{ milliseconds: 250 }} | ${"14:29:59.75"}
    ${"14:30:00"} | ${{ microseconds: 500 }} | ${"14:29:59.9995"}
    ${"14:30:00"} | ${{ nanoseconds: 1000 }} | ${"14:29:59.999999"}
  `("returns $expected for $value - $units", ({ value, units, expected }) => {
    expect(subtractTime(value, units)).toBe(expected);
  });

  it.each`
    negativeAmount | expectedTime
    ${-1}          | ${"14:31:00"}
    ${-30}         | ${"15:00:00"}
    ${-90}         | ${"16:00:00"}
  `(
    "returns $expectedTime for $value - $negativeAmount minutes",
    ({ negativeAmount, expectedTime }) => {
      expect(subtractTime("14:30:00", { minutes: negativeAmount })).toBe(
        expectedTime,
      );
    },
  );

  it.each`
    invalidTime
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
    "returns an empty string for an invalid time value: $invalidTime",
    ({ invalidTime }) => {
      expect(subtractTime(invalidTime as never, { minutes: 30 })).toBe("");
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
      expect(subtractTime("14:30:00", { [invalidUnit as never]: 1 })).toBe("");
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
      expect(
        subtractTime("14:30:00", { minutes: invalidAmount } as never),
      ).toBe("");
    },
  );
});
