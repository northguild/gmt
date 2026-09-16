import { sortUnix } from "./sortUnix";

describe("sortUnix", () => {
  it.each`
    order     | unixValues                  | expected
    ${"asc"}  | ${[3, 1.5, 1]}              | ${[1, 3]}
    ${"asc"}  | ${[1735689599, 1704067200]} | ${[1704067200, 1735689599]}
    ${"desc"} | ${[1704067200, 1735689599]} | ${[1735689599, 1704067200]}
  `(
    "returns $expected for order $order with unixValues $unixValues",
    ({ order, unixValues, expected }) => {
      expect(sortUnix(unixValues, order)).toEqual(expected);
    },
  );

  it.each`
    unixValues | expected
    ${[]}      | ${[]}
    ${[NaN]}   | ${[]}
  `(
    "returns $expected for edge case: $unixValues",
    ({ unixValues, expected }) => {
      expect(sortUnix(unixValues)).toEqual(expected);
    },
  );
});

describe("sortUnix drops values that are not unix epochs", () => {
  // A unix epoch is an integer (isValidUnixMilliseconds / isValidUnixSeconds) naming a
  // Temporal.Instant: |ms| <= 8.64e15 (10^8 days either side of the epoch). With no epochUnit the
  // widest (milliseconds) range applies, which contains the seconds range.
  it.each`
    order     | unixValues                                            | expected
    ${"asc"}  | ${[1e20, 1.5, NaN, "5"]}                              | ${[]}
    ${"asc"}  | ${[3, 1.5, 1, -1e20, "2", Infinity]}                  | ${[1, 3]}
    ${"desc"} | ${[3, 1.5, 1, -1e20, "2", Infinity]}                  | ${[3, 1]}
    ${"asc"}  | ${[8_640_000_000_000_000, -8_640_000_000_000_000, 0]} | ${[-8_640_000_000_000_000, 0, 8_640_000_000_000_000]}
    ${"asc"}  | ${[8_640_000_000_000_001, -8_640_000_000_000_001, 0]} | ${[0]}
  `(
    "returns $expected for order $order with unixValues $unixValues",
    ({ order, unixValues, expected }) => {
      expect(sortUnix(unixValues, order)).toEqual(expected);
    },
  );
});
