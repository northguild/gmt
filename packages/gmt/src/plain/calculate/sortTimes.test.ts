import { sortTimes } from "./sortTimes";

describe("sortTimes", () => {
  it.each`
    times                                   | order     | expected
    ${["14:30:00", "09:00:00", "20:45:00"]} | ${"asc"}  | ${["09:00:00", "14:30:00", "20:45:00"]}
    ${["08:00:00", "12:30:00"]}             | ${"asc"}  | ${["08:00:00", "12:30:00"]}
    ${["23:59:59", "00:00:00", "12:00:00"]} | ${"asc"}  | ${["00:00:00", "12:00:00", "23:59:59"]}
    ${["14:30:00", "09:00:00", "20:45:00"]} | ${"desc"} | ${["20:45:00", "14:30:00", "09:00:00"]}
    ${["08:00:00", "12:30:00"]}             | ${"desc"} | ${["12:30:00", "08:00:00"]}
    ${["23:59:59", "00:00:00", "12:00:00"]} | ${"desc"} | ${["23:59:59", "12:00:00", "00:00:00"]}
  `(
    "returns $expected for times $times order $order",
    ({ times, order, expected }) => {
      expect(sortTimes(times, order)).toEqual(expected);
    },
  );

  it.each`
    times           | expected
    ${[]}           | ${[]}
    ${["invalid"]}  | ${[]}
    ${["25:00:00"]} | ${[]}
  `("returns $expected for edge case: $times", ({ times, expected }) => {
    expect(sortTimes(times)).toEqual(expected);
  });
});
