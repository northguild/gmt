import { sortZoned } from "./sortZoned";

describe("sortZoned", () => {
  const tz = "America/New_York";
  describe("ascending (default)", () => {
    it.each`
      zonedDateTimes                                                                                | expected
      ${[`2024-03-10T12:00:00[${tz}]`, `2024-01-01T08:00:00[${tz}]`, `2024-02-15T15:30:00[${tz}]`]} | ${["2024-01-01T08:00:00-05:00[America/New_York]", "2024-02-15T15:30:00-05:00[America/New_York]", "2024-03-10T12:00:00-04:00[America/New_York]"]}
    `(
      "returns $expected for zonedDateTimes $zonedDateTimes",
      ({ zonedDateTimes, expected }) => {
        expect(sortZoned(zonedDateTimes)).toEqual(expected);
      },
    );
  });

  describe("descending", () => {
    it.each`
      zonedDateTimes                                                                                | expected
      ${[`2024-03-10T12:00:00[${tz}]`, `2024-01-01T08:00:00[${tz}]`, `2024-02-15T15:30:00[${tz}]`]} | ${["2024-03-10T12:00:00-04:00[America/New_York]", "2024-02-15T15:30:00-05:00[America/New_York]", "2024-01-01T08:00:00-05:00[America/New_York]"]}
    `(
      "returns $expected for zonedDateTimes $zonedDateTimes order desc",
      ({ zonedDateTimes, expected }) => {
        expect(sortZoned(zonedDateTimes, "desc")).toEqual(expected);
      },
    );
  });

  it.each`
    zonedDateTimes | expected
    ${[]}          | ${[]}
    ${["invalid"]} | ${[]}
  `(
    "returns $expected for edge case: $zonedDateTimes",
    ({ zonedDateTimes, expected }) => {
      expect(sortZoned(zonedDateTimes)).toEqual(expected);
    },
  );
});
