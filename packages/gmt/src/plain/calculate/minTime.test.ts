import { minTime } from "./minTime";

describe("minTime", () => {
  it.each`
    times                                   | expected
    ${["14:30:00", "09:00:00", "20:45:00"]} | ${"09:00:00"}
    ${["08:00:00", "12:30:00"]}             | ${"08:00:00"}
    ${["23:59:59", "00:00:00", "12:00:00"]} | ${"00:00:00"}
  `("returns $expected for times $times", ({ times, expected }) => {
    expect(minTime(times)).toBe(expected);
  });

  it.each`
    times                      | expected
    ${[]}                      | ${null}
    ${["invalid"]}             | ${null}
    ${["25:00:00"]}            | ${null}
    ${["invalid", "09:00:00"]} | ${"09:00:00"}
  `("returns $expected for edge case: $times", ({ times, expected }) => {
    expect(minTime(times)).toBe(expected);
  });
});
