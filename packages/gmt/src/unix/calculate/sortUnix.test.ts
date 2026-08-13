import { sortUnix } from "./sortUnix";

describe("sortUnix", () => {
  it.each`
    order     | unixValues                  | expected
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
