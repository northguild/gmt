import { sqlDateTime } from "./sql-date-time";

describe("regex/sql-date-time", () => {
  it.each`
    value                              | expected
    ${"2024-03-15 14:30:00"}           | ${true}
    ${"2024-03-15 14:30"}              | ${true}
    ${"2024-03-15 14:30:00.5"}         | ${true}
    ${"2024-03-15 14:30:00.123456789"} | ${true}
    ${"2024-3-5 14:30:00"}             | ${false}
    ${"2024-03-05 4:30:00"}            | ${false}
    ${"2024-03-15T14:30:00"}           | ${false}
    ${"2024-03-15  14:30:00"}          | ${false}
    ${"2024-03-15 14:30:60"}           | ${false}
    ${"not a date"}                    | ${false}
    ${""}                              | ${false}
  `(
    "sqlDateTime pattern matches $value as $expected",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(sqlDateTime.test(value)).toBe(expected);
    },
  );
});
