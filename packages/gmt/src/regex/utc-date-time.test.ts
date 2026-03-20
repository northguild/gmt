import { utcDateTime } from "./utc-date-time";

describe("regex/utc-date-time", () => {
  it.each`
    value                         | expected
    ${"2024-02-29T14:30Z"}        | ${true}
    ${"2024-02-29T14:30z"}        | ${true}
    ${"2024-02-29T14:30:45Z"}     | ${true}
    ${"2024-02-29T14:30:45.123Z"} | ${true}
    ${"2024-02-29T14:30:45,123Z"} | ${true}
    ${"2024-02-29T14:30:60Z"}     | ${false}
    ${"+001234-12-31T23:59:59Z"}  | ${true}
    ${"2024-02-29T14:30"}         | ${false}
    ${"2024-02-29T14:30:45"}      | ${false}
    ${"2024-02-29T14:30Z "}       | ${false}
    ${"2024-02-29 14:30:45Z"}     | ${false}
    ${"2024-3-17T14:30:45Z"}      | ${false}
    ${"2024-02-29T24:00:00Z"}     | ${false}
    ${"not-a-datetime"}           | ${false}
  `(
    "utcDateTime pattern matches $value as $expected",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(utcDateTime.test(value)).toBe(expected);
    },
  );
});
