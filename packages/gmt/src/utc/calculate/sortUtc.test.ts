import { sortUtc } from "./sortUtc";

describe("sortUtc", () => {
  describe("ascending (default)", () => {
    it.each`
      utcDateTimes                                                                | expected
      ${["2024-03-10T12:00:00Z", "2024-01-01T08:00:00Z", "2024-02-15T15:30:00Z"]} | ${["2024-01-01T08:00:00Z", "2024-02-15T15:30:00Z", "2024-03-10T12:00:00Z"]}
    `(
      "returns $expected for utcDateTimes $utcDateTimes",
      ({ utcDateTimes, expected }) => {
        expect(sortUtc(utcDateTimes)).toEqual(expected);
      },
    );
  });

  describe("descending", () => {
    it.each`
      utcDateTimes                                                                | expected
      ${["2024-03-10T12:00:00Z", "2024-01-01T08:00:00Z", "2024-02-15T15:30:00Z"]} | ${["2024-03-10T12:00:00Z", "2024-02-15T15:30:00Z", "2024-01-01T08:00:00Z"]}
    `(
      "returns $expected for utcDateTimes $utcDateTimes order desc",
      ({ utcDateTimes, expected }) => {
        expect(sortUtc(utcDateTimes, "desc")).toEqual(expected);
      },
    );
  });

  it.each`
    utcDateTimes   | expected
    ${[]}          | ${[]}
    ${["invalid"]} | ${[]}
  `(
    "returns $expected for edge case: $utcDateTimes",
    ({ utcDateTimes, expected }) => {
      expect(sortUtc(utcDateTimes)).toEqual(expected);
    },
  );
});
