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
    weekStartsOn | label
    ${"tuesday"} | ${"'tuesday'"}
    ${"Monday"}  | ${"'Monday'"}
    ${"SUNDAY"}  | ${"'SUNDAY'"}
    ${""}        | ${"''"}
    ${null}      | ${"null"}
    ${1}         | ${"1"}
    ${7}         | ${"7"}
    ${true}      | ${"true"}
    ${{}}        | ${"{}"}
  `("returns null for invalid weekStartsOn $label", ({ weekStartsOn }) => {
    expect(resolveWeekStartsOn(weekStartsOn)).toBeNull();
  });
});
