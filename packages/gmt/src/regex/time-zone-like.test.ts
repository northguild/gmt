import { timeZoneLike } from "./time-zone-like";

describe("regex/timeZoneLike", () => {
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
  `("timeZone pattern matches $value as $expected", ({ value, expected }) => {
    expect(timeZoneLike.test(value)).toBe(expected);
  });
});
