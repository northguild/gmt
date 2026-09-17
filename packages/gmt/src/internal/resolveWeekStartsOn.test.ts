import { resolveWeekStartsOn } from "./resolveWeekStartsOn";

describe("resolveWeekStartsOn", () => {
  it.each`
    weekStartsOn | expected
    ${undefined} | ${"monday"}
    ${"monday"}  | ${"monday"}
    ${"sunday"}  | ${"sunday"}
  `(
    "returns $expected for weekStartsOn $weekStartsOn",
    ({ weekStartsOn, expected }) => {
      expect(resolveWeekStartsOn(weekStartsOn)).toBe(expected);
    },
  );

  it.each`
    weekStartsOn
    ${"tuesday"}
    ${"Monday"}
    ${"SUNDAY"}
    ${""}
    ${null}
    ${1}
    ${7}
    ${true}
    ${{}}
  `(
    "returns null for invalid weekStartsOn $weekStartsOn",
    ({ weekStartsOn }) => {
      expect(resolveWeekStartsOn(weekStartsOn)).toBeNull();
    },
  );
});
