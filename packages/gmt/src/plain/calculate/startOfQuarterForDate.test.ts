import { startOfQuarterForDate } from "./startOfQuarterForDate";

describe("startOfQuarterForDate", () => {
  it.each`
    value           | expected
    ${"2024-01-15"} | ${"2024-01-01"}
    ${"2024-02-28"} | ${"2024-01-01"}
    ${"2024-03-31"} | ${"2024-01-01"}
    ${"2024-04-15"} | ${"2024-04-01"}
    ${"2024-05-15"} | ${"2024-04-01"}
    ${"2024-06-30"} | ${"2024-04-01"}
    ${"2024-07-15"} | ${"2024-07-01"}
    ${"2024-08-15"} | ${"2024-07-01"}
    ${"2024-09-30"} | ${"2024-07-01"}
    ${"2024-10-15"} | ${"2024-10-01"}
    ${"2024-11-15"} | ${"2024-10-01"}
    ${"2024-12-31"} | ${"2024-10-01"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(startOfQuarterForDate(value)).toBe(expected);
  });

  it.each`
    invalidDate
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${"2024-02-29T00:00:00Z"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid date $invalidDate", ({ invalidDate }) => {
    expect(startOfQuarterForDate(invalidDate)).toBe("");
  });
});
