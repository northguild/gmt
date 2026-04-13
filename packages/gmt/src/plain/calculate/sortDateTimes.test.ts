import { sortDateTimes } from "./sortDateTimes";

describe("sortDateTimes", () => {
  describe("ascending (default)", () => {
    it.each`
      dateTimes                                                                | expected
      ${["2024-03-10T12:00:00", "2024-01-01T08:00:00", "2024-02-15T15:30:00"]} | ${["2024-01-01T08:00:00", "2024-02-15T15:30:00", "2024-03-10T12:00:00"]}
    `(
      "returns $expected for dateTimes $dateTimes",
      ({ dateTimes, expected }) => {
        expect(sortDateTimes(dateTimes)).toEqual(expected);
      },
    );
  });

  describe("descending", () => {
    it.each`
      dateTimes                                                                | expected
      ${["2024-03-10T12:00:00", "2024-01-01T08:00:00", "2024-02-15T15:30:00"]} | ${["2024-03-10T12:00:00", "2024-02-15T15:30:00", "2024-01-01T08:00:00"]}
    `(
      "returns $expected for dateTimes $dateTimes order desc",
      ({ dateTimes, expected }) => {
        expect(sortDateTimes(dateTimes, "desc")).toEqual(expected);
      },
    );
  });

  it.each`
    dateTimes      | expected
    ${[]}          | ${[]}
    ${["invalid"]} | ${[]}
  `(
    "returns $expected for edge case: $dateTimes",
    ({ dateTimes, expected }) => {
      expect(sortDateTimes(dateTimes)).toEqual(expected);
    },
  );
});
