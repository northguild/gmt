import { diffDate } from "./diffDate";

describe("diffDate", () => {
  it.each`
    date1           | date2           | unit       | expected
    ${"2023-01-01"} | ${"2024-01-01"} | ${"year"}  | ${1}
    ${"2023-01-01"} | ${"2024-01-02"} | ${"year"}  | ${1}
    ${"2023-01-01"} | ${"2023-12-31"} | ${"year"}  | ${0}
    ${"2023-01-01"} | ${"2024-01-01"} | ${"month"} | ${12}
    ${"2023-01-01"} | ${"2023-02-01"} | ${"month"} | ${1}
    ${"2023-01-01"} | ${"2023-01-01"} | ${"month"} | ${0}
    ${"2023-01-01"} | ${"2023-01-08"} | ${"week"}  | ${1}
    ${"2023-01-01"} | ${"2023-01-07"} | ${"week"}  | ${0}
    ${"2023-01-01"} | ${"2023-01-31"} | ${"day"}   | ${30}
    ${"2023-01-01"} | ${"2023-01-01"} | ${"day"}   | ${0}
  `(
    "returns $expected for $unit comparing $date1, $date2",
    ({ date1, date2, unit, expected }) => {
      expect(diffDate(date1, date2, unit)).toBe(expected);
    },
  );

  it.each`
    date1           | date2           | unit       | expected
    ${"2024-02-29"} | ${"2025-02-28"} | ${"year"}  | ${0}
    ${"2024-12-31"} | ${"2025-01-01"} | ${"day"}   | ${1}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"week"}  | ${52}
    ${"2024-01-31"} | ${"2024-02-29"} | ${"month"} | ${0}
  `(
    "returns $expected for edge cases: $unit comparing $date1, $date2",
    ({ date1, date2, unit, expected }) => {
      expect(diffDate(date1, date2, unit)).toBe(expected);
    },
  );

  it.each`
    date1           | date2
    ${"2024-01-01"} | ${"2023-01-01"}
    ${"2024-12-31"} | ${"2024-01-01"}
    ${"2023-06-15"} | ${"2023-01-01"}
  `(
    "returns negative difference for date1 before date2: $date1, $date2",
    ({ date1, date2 }) => {
      expect(diffDate(date1, date2, "day")).toBeLessThan(0);
    },
  );

  it.each`
    invalidDate1
    ${"2024-02-30"}
    ${"not-a-date"}
    ${"2024-13-01"}
    ${"2024-00-10"}
    ${""}
    ${true}
    ${null}
    ${undefined}
    ${"12"}
    ${"2024"}
    ${"2024-02"}
    ${"2024-02-29T12:00:00"}
    ${"2024-02-29T12:00:00Z"}
  `("returns null for invalid date1", ({ invalidDate1 }) => {
    expect(diffDate(invalidDate1 as never, "2024-01-01", "day")).toBeNull();
  });

  it.each`
    invalidDate2
    ${"2024-02-30"}
    ${"not-a-date"}
    ${"2024-13-01"}
    ${"2024-00-10"}
    ${""}
    ${true}
    ${null}
    ${undefined}
    ${"12"}
    ${"2024"}
    ${"2024-02"}
    ${"2024-02-29T12:00:00"}
    ${"2024-02-29T12:00:00Z"}
  `("returns null for invalid date2", ({ invalidDate2 }) => {
    expect(diffDate("2024-01-01", invalidDate2 as never, "day")).toBeNull();
  });

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
    ${"hours"}
    ${"days"}
    ${"months"}
    ${"years"}
  `("returns null for invalid unit", ({ invalidUnit }) => {
    expect(
      diffDate("2024-01-01", "2024-01-02", invalidUnit as never),
    ).toBeNull();
  });
});
