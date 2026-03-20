import { day, month, plainDate, year } from "./date";

describe("regex/date", () => {
  it.each`
    value        | expected
    ${"2024"}    | ${true}
    ${"0000"}    | ${true}
    ${"+001234"} | ${true}
    ${"-000001"} | ${true}
    ${"202"}     | ${false}
    ${"+1234"}   | ${false}
  `(
    "year pattern matches $value as $expected",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(year.test(value)).toBe(expected);
    },
  );

  it.each`
    value   | expected
    ${"01"} | ${true}
    ${"12"} | ${true}
    ${"00"} | ${false}
    ${"13"} | ${false}
  `(
    "month pattern matches $value as $expected",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(month.test(value)).toBe(expected);
    },
  );

  it.each`
    value   | expected
    ${"01"} | ${true}
    ${"31"} | ${true}
    ${"00"} | ${false}
    ${"32"} | ${false}
  `(
    "day pattern matches $value as $expected",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(day.test(value)).toBe(expected);
    },
  );

  it.each`
    value              | expected
    ${"2024-02-29"}    | ${true}
    ${"0000-01-01"}    | ${true}
    ${"+001234-12-31"} | ${true}
    ${"-000001-01-01"} | ${true}
    ${"2024-3-17"}     | ${false}
    ${"2024-13-01"}    | ${false}
    ${"not-a-date"}    | ${false}
  `(
    "plainDate pattern matches $value as $expected",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(plainDate.test(value)).toBe(expected);
    },
  );
});
