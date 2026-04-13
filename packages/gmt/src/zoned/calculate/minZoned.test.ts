import { minZoned } from "./minZoned";

describe("minZoned", () => {
  const tz = "America/New_York";
  it.each`
    zonedDateTimes                                                                                | expected
    ${[`2024-03-10T12:00:00[${tz}]`, `2024-01-01T08:00:00[${tz}]`, `2024-02-15T15:30:00[${tz}]`]} | ${"2024-01-01T08:00:00-05:00[America/New_York]"}
  `(
    "returns $expected for zonedDateTimes $zonedDateTimes",
    ({ zonedDateTimes, expected }) => {
      expect(minZoned(zonedDateTimes)).toBe(expected);
    },
  );

  it.each`
    zonedDateTimes | expected
    ${[]}          | ${null}
    ${["invalid"]} | ${null}
  `(
    "returns $expected for edge case: $zonedDateTimes",
    ({ zonedDateTimes, expected }) => {
      expect(minZoned(zonedDateTimes)).toBe(expected);
    },
  );
});
