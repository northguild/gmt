import { sortDates } from "./sortDates";

describe("sortDates", () => {
  it.each`
    dates                                         | order     | expected
    ${["2024-03-10", "2024-01-01", "2024-02-15"]} | ${"asc"}  | ${["2024-01-01", "2024-02-15", "2024-03-10"]}
    ${["2023-12-31", "2024-01-01"]}               | ${"asc"}  | ${["2023-12-31", "2024-01-01"]}
    ${["2024-06-15", "2024-03-20", "2024-09-01"]} | ${"asc"}  | ${["2024-03-20", "2024-06-15", "2024-09-01"]}
    ${["2024-03-10", "2024-01-01", "2024-02-15"]} | ${"desc"} | ${["2024-03-10", "2024-02-15", "2024-01-01"]}
    ${["2023-12-31", "2024-01-01"]}               | ${"desc"} | ${["2024-01-01", "2023-12-31"]}
    ${["2024-06-15", "2024-03-20", "2024-09-01"]} | ${"desc"} | ${["2024-09-01", "2024-06-15", "2024-03-20"]}
  `(
    "returns $expected for dates $dates order $order",
    ({ dates, order, expected }) => {
      expect(sortDates(dates, order)).toEqual(expected);
    },
  );

  it.each`
    dates             | expected
    ${[]}             | ${[]}
    ${["invalid"]}    | ${[]}
    ${["2024-02-30"]} | ${[]}
  `("returns $expected for edge case: $dates", ({ dates, expected }) => {
    expect(sortDates(dates)).toEqual(expected);
  });
});
