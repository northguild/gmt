import { isBetweenTime } from "./isBetweenTime";

describe("isBetweenTime", () => {
  it.each`
    time          | start         | end           | expected
    ${"12:00:00"} | ${"00:00:00"} | ${"23:59:59"} | ${true}
    ${"00:00:00"} | ${"00:00:00"} | ${"23:59:59"} | ${true}
    ${"23:59:59"} | ${"00:00:00"} | ${"23:59:59"} | ${true}
    ${"23:59:58"} | ${"00:00:00"} | ${"23:59:59"} | ${true}
    ${"00:00:01"} | ${"00:00:00"} | ${"23:59:59"} | ${true}
    ${"00:00:00"} | ${"12:00:00"} | ${"23:59:59"} | ${false}
    ${"23:59:59"} | ${"00:00:00"} | ${"12:00:00"} | ${false}
  `(
    "returns $expected for time $time between $start and $end",
    ({ time, start, end, expected }) => {
      expect(isBetweenTime(time, start, end)).toBe(expected);
    },
  );

  it.each`
    time          | start         | end           | inclusiveStart | inclusiveEnd | expected
    ${"00:00:00"} | ${"00:00:00"} | ${"23:59:59"} | ${false}       | ${true}      | ${false}
    ${"23:59:59"} | ${"00:00:00"} | ${"23:59:59"} | ${true}        | ${false}     | ${false}
    ${"00:00:00"} | ${"00:00:00"} | ${"23:59:59"} | ${false}       | ${false}     | ${false}
    ${"12:00:00"} | ${"00:00:00"} | ${"23:59:59"} | ${false}       | ${false}     | ${true}
  `(
    "returns $expected for $time between $start and $end with inclusiveStart=$inclusiveStart and inclusiveEnd=$inclusiveEnd",
    ({ time, start, end, inclusiveStart, inclusiveEnd, expected }) => {
      expect(
        isBetweenTime(time, start, end, { inclusiveStart, inclusiveEnd }),
      ).toBe(expected);
    },
  );

  it.each`
    time
    ${"invalid-time"}
    ${"25:00:00"}
    ${"12:60:00"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns false for invalid time $time", ({ time }) => {
    expect(isBetweenTime(time, "00:00:00", "23:59:59")).toBe(false);
  });
});
