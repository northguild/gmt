import { timezoneLike } from "./timezone-like";

describe("regex/timezoneLike", () => {
  it.each`
    value                 | expected
    ${"UTC"}              | ${true}
    ${"GMT"}              | ${true}
    ${"America/New_York"} | ${true}
    ${"Europe/London"}    | ${true}
    ${"Asia/Kathmandu"}   | ${true}
    ${"Not/AZone"}        | ${true}
    ${"UTC+1"}            | ${false}
    ${"America"}          | ${false}
    ${""}                 | ${false}
  `("timezone pattern matches $value as $expected", ({ value, expected }) => {
    expect(timezoneLike.test(value)).toBe(expected);
  });
});
