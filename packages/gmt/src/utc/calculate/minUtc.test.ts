import { minUtc } from "./minUtc";

describe("minUtc", () => {
  it.each`
    utcDateTimes                                                                | expected
    ${["2024-03-10T12:00:00Z", "2024-01-01T08:00:00Z", "2024-02-15T15:30:00Z"]} | ${"2024-01-01T08:00:00Z"}
    ${["2023-12-31T23:59:59Z", "2024-01-01T00:00:00Z"]}                         | ${"2023-12-31T23:59:59Z"}
  `(
    "returns $expected for utcDateTimes $utcDateTimes",
    ({ utcDateTimes, expected }) => {
      expect(minUtc(utcDateTimes)).toBe(expected);
    },
  );

  it.each`
    utcDateTimes   | expected
    ${[]}          | ${null}
    ${["invalid"]} | ${null}
  `(
    "returns $expected for edge case: $utcDateTimes",
    ({ utcDateTimes, expected }) => {
      expect(minUtc(utcDateTimes)).toBe(expected);
    },
  );
});
