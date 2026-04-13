import { maxUnix } from "./maxUnix";

describe("maxUnix", () => {
  it.each`
    unixValues                              | expected
    ${[1707403200, 1704067200, 1708166400]} | ${1708166400}
    ${[1704067200, 1707403200]}             | ${1707403200}
  `(
    "returns $expected for unixValues $unixValues",
    ({ unixValues, expected }) => {
      expect(maxUnix(unixValues)).toBe(expected);
    },
  );

  it.each`
    unixValues              | expected
    ${[]}                   | ${null}
    ${[NaN]}                | ${null}
    ${[NaN, 1704067200]}    | ${1704067200}
    ${[Infinity, Infinity]} | ${null}
  `(
    "returns $expected for edge case: $unixValues",
    ({ unixValues, expected }) => {
      expect(maxUnix(unixValues)).toBe(expected);
    },
  );
});
