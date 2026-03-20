import {
  fractionalSecond,
  hour,
  millisecond,
  minute,
  plainTime,
  second,
} from "./time";

describe("regex/time", () => {
  it.each`
    value   | expected
    ${"00"} | ${true}
    ${"23"} | ${true}
    ${"24"} | ${false}
    ${"9"}  | ${false}
  `(
    "hour pattern matches $value as $expected",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(hour.test(value)).toBe(expected);
    },
  );

  it.each`
    value   | expected
    ${"00"} | ${true}
    ${"59"} | ${true}
    ${"60"} | ${false}
  `(
    "minute pattern matches $value as $expected",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(minute.test(value)).toBe(expected);
    },
  );

  it.each`
    value   | expected
    ${"00"} | ${true}
    ${"59"} | ${true}
    ${"60"} | ${false}
    ${"61"} | ${false}
  `(
    "second pattern matches $value as $expected",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(second.test(value)).toBe(expected);
    },
  );

  it.each`
    value           | expected
    ${"1"}          | ${true}
    ${"123456789"}  | ${true}
    ${""}           | ${false}
    ${"1234567890"} | ${false}
  `(
    "millisecond pattern matches $value as $expected",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(millisecond.test(value)).toBe(expected);
    },
  );

  it.each`
    value           | expected
    ${"1"}          | ${true}
    ${"123456789"}  | ${true}
    ${""}           | ${false}
    ${"1234567890"} | ${false}
  `(
    "fractionalSecond pattern matches $value as $expected",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(fractionalSecond.test(value)).toBe(expected);
    },
  );

  it.each`
    value             | expected
    ${"08:30"}        | ${true}
    ${"08:30:45"}     | ${true}
    ${"08:30:45.123"} | ${true}
    ${"08:30:45,123"} | ${true}
    ${"23:59:60"}     | ${false}
    ${"8:30:45"}      | ${false}
    ${"24:00:00"}     | ${false}
  `(
    "plainTime pattern matches $value as $expected",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(plainTime.test(value)).toBe(expected);
    },
  );
});
