import { sortDateTimes } from "./sortDateTimes";

describe("sortDateTimes", () => {
  it.each`
    dateTimes                                                                | order     | expected
    ${["2024-03-10T12:00:00", "2024-01-01T08:00:00", "2024-02-15T15:30:00"]} | ${"asc"}  | ${["2024-01-01T08:00:00", "2024-02-15T15:30:00", "2024-03-10T12:00:00"]}
    ${["2024-03-10T12:00:00", "2024-01-01T08:00:00", "2024-02-15T15:30:00"]} | ${"desc"} | ${["2024-03-10T12:00:00", "2024-02-15T15:30:00", "2024-01-01T08:00:00"]}
  `(
    "returns $expected for dateTimes $dateTimes order $order",
    ({ dateTimes, order, expected }) => {
      expect(sortDateTimes(dateTimes, order)).toEqual(expected);
    },
  );

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
