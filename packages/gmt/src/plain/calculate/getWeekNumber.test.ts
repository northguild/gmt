import { getWeekNumber } from "./getWeekNumber";

describe("getWeekNumber", () => {
  it.each`
    date            | weekStartsOn | expected
    ${"2024-01-01"} | ${"monday"}  | ${1}
    ${"2024-01-02"} | ${"monday"}  | ${1}
    ${"2024-01-03"} | ${"monday"}  | ${1}
    ${"2024-01-04"} | ${"monday"}  | ${1}
    ${"2024-01-07"} | ${"monday"}  | ${1}
    ${"2024-01-08"} | ${"monday"}  | ${2}
    ${"2024-06-15"} | ${"monday"}  | ${24}
    ${"2024-12-28"} | ${"monday"}  | ${52}
    ${"2024-12-31"} | ${"monday"}  | ${1}
    ${"2024-01-01"} | ${"sunday"}  | ${1}
    ${"2024-01-06"} | ${"sunday"}  | ${1}
    ${"2024-01-07"} | ${"sunday"}  | ${2}
    ${"2024-06-15"} | ${"sunday"}  | ${24}
    ${"2024-12-28"} | ${"sunday"}  | ${52}
    ${"2024-12-31"} | ${"sunday"}  | ${53}
  `(
    "returns $expected for $date with weekStartsOn $weekStartsOn",
    ({ date, weekStartsOn, expected }) => {
      expect(getWeekNumber(date, weekStartsOn)).toBe(expected);
    },
  );

  it.each`
    nonStringInput
    ${"invalid-date"}
    ${"2024-02-30"}
    ${null}
    ${undefined}
  `(
    "returns null for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(getWeekNumber(nonStringInput as never)).toBeNull();
    },
  );
});
