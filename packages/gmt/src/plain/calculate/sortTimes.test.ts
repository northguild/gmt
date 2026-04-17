import { sortTimes } from "./sortTimes";

describe("sortTimes", () => {
  describe("ascending (default)", () => {
    it.each`
      times                                   | expected
      ${["14:30:00", "09:00:00", "20:45:00"]} | ${["09:00:00", "14:30:00", "20:45:00"]}
      ${["08:00:00", "12:30:00"]}             | ${["08:00:00", "12:30:00"]}
      ${["23:59:59", "00:00:00", "12:00:00"]} | ${["00:00:00", "12:00:00", "23:59:59"]}
    `("returns $expected for times $times", ({ times, expected }) => {
      expect(sortTimes(times)).toEqual(expected);
    });
  });

  describe("descending", () => {
    it.each`
      times                                   | expected
      ${["14:30:00", "09:00:00", "20:45:00"]} | ${["20:45:00", "14:30:00", "09:00:00"]}
      ${["08:00:00", "12:30:00"]}             | ${["12:30:00", "08:00:00"]}
      ${["23:59:59", "00:00:00", "12:00:00"]} | ${["23:59:59", "12:00:00", "00:00:00"]}
    `(
      "returns $expected for times $times order desc",
      ({ times, expected }) => {
        expect(sortTimes(times, "desc")).toEqual(expected);
      },
    );
  });

  it.each`
    times           | expected
    ${[]}           | ${[]}
    ${["invalid"]}  | ${[]}
    ${["25:00:00"]} | ${[]}
  `("returns $expected for edge case: $times", ({ times, expected }) => {
    expect(sortTimes(times)).toEqual(expected);
  });
});
