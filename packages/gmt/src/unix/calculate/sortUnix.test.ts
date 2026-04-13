import { sortUnix } from "./sortUnix";

describe("sortUnix", () => {
  describe("ascending (default)", () => {
    it.each`
      unixValues                              | expected
      ${[1707403200, 1704067200, 1708166400]} | ${[1704067200, 1707403200, 1708166400]}
    `(
      "returns $expected for unixValues $unixValues",
      ({ unixValues, expected }) => {
        expect(sortUnix(unixValues)).toEqual(expected);
      },
    );
  });

  describe("descending", () => {
    it.each`
      unixValues                              | expected
      ${[1707403200, 1704067200, 1708166400]} | ${[1708166400, 1707403200, 1704067200]}
    `(
      "returns $expected for unixValues $unixValues order desc",
      ({ unixValues, expected }) => {
        expect(sortUnix(unixValues, "desc")).toEqual(expected);
      },
    );
  });

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
