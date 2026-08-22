import { rfc3339DateTime } from "./rfc-3339";

describe("regex/rfc-3339", () => {
  it.each`
    value                               | expected
    ${"2024-03-15T14:30:00Z"}           | ${true}
    ${"2024-03-15t14:30:00z"}           | ${true}
    ${"2024-03-15 14:30:00Z"}           | ${true}
    ${"2024-03-15T14:30:00-04:00"}      | ${true}
    ${"2024-03-15T14:30:00.5Z"}         | ${true}
    ${"2024-03-15T14:30:00.123456789Z"} | ${true}
    ${"2024-03-15T14:30:00"}            | ${false}
    ${"2024-03-15T14:30:00+00:00[UTC]"} | ${false}
    ${"2024-03-15T14:30:00-0400"}       | ${false}
    ${"2024-3-15T14:30:00Z"}            | ${false}
    ${"2024-03-15T14:30:60Z"}           | ${false}
    ${"not a date"}                     | ${false}
    ${""}                               | ${false}
  `(
    "rfc3339DateTime pattern matches $value as $expected",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(rfc3339DateTime.test(value)).toBe(expected);
    },
  );
});
