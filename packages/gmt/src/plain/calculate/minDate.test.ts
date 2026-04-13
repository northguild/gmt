import { minDate } from "./minDate";

describe("minDate", () => {
  it.each`
    dates                                         | expected
    ${["2024-03-10", "2024-01-01", "2024-02-15"]} | ${"2024-01-01"}
    ${["2023-12-31", "2024-01-01"]}               | ${"2023-12-31"}
    ${["2024-06-15", "2024-03-20", "2024-09-01"]} | ${"2024-03-20"}
  `("returns $expected for dates $dates", ({ dates, expected }) => {
    expect(minDate(dates)).toBe(expected);
  });

  it.each`
    dates                        | expected
    ${[]}                        | ${null}
    ${["invalid"]}               | ${null}
    ${["2024-02-30"]}            | ${null}
    ${["invalid", "2024-01-01"]} | ${"2024-01-01"}
  `("returns $expected for edge case: $dates", ({ dates, expected }) => {
    expect(minDate(dates)).toBe(expected);
  });
});
