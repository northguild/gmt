import type { TimeDurationUnit } from "../../types";
import { addTime } from "./addTime";

describe("addTime", () => {
  it.each`
    value         | units                    | expected
    ${"14:30:00"} | ${{ hours: 2 }}          | ${"16:30:00"}
    ${"14:30:00"} | ${{ minutes: 45 }}       | ${"15:15:00"}
    ${"23:59:30"} | ${{ seconds: 45 }}       | ${"00:00:15"}
    ${"14:30:00"} | ${{ milliseconds: 250 }} | ${"14:30:00.25"}
    ${"14:30:00"} | ${{ microseconds: 500 }} | ${"14:30:00.0005"}
    ${"14:30:00"} | ${{ nanoseconds: 1000 }} | ${"14:30:00.000001"}
  `("returns $expected for $value + $units", ({ value, units, expected }) => {
    expect(addTime(value, units)).toBe(expected);
  });

  it.each`
    negativeUnits       | expectedTime
    ${{ minutes: -1 }}  | ${"14:29:00"}
    ${{ minutes: -30 }} | ${"14:00:00"}
    ${{ minutes: -90 }} | ${"13:00:00"}
  `(
    "returns $expectedTime for $value + $negativeUnits",
    ({
      negativeUnits,
      expectedTime,
    }: {
      negativeUnits: Partial<Record<TimeDurationUnit, number>>;
      expectedTime: string;
    }) => {
      expect(addTime("14:30:00", negativeUnits)).toBe(expectedTime);
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
      expect(addTime("14:30:00", { minutes: invalidAmount } as never)).toBe(
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
      expect(addTime(invalidValue, { minutes: 30 })).toBe("");
    },
  );

  it.each`
    value         | units            | overflow       | expected
    ${"23:00:00"} | ${{ hours: 2 }}  | ${undefined}   | ${"01:00:00"}
    ${"23:00:00"} | ${{ hours: 2 }}  | ${"constrain"} | ${"01:00:00"}
    ${"23:00:00"} | ${{ hours: 2 }}  | ${"reject"}    | ${"01:00:00"}
    ${"23:00:00"} | ${{ hours: 24 }} | ${undefined}   | ${"23:00:00"}
    ${"23:00:00"} | ${{ hours: 24 }} | ${"constrain"} | ${"23:00:00"}
    ${"23:00:00"} | ${{ hours: 24 }} | ${"reject"}    | ${"23:00:00"}
  `(
    "produces the identical wrapped result $expected for $value + $units regardless of overflow $overflow (PlainTime always wraps around the clock)",
    ({ value, units, overflow, expected }) => {
      expect(
        addTime(
          value,
          units,
          overflow === undefined ? undefined : { overflow },
        ),
      ).toBe(expected);
    },
  );
});
