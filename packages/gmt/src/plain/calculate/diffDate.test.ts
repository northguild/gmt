import { diffDate } from "./diffDate";

describe("diffDate", () => {
  it.each`
    date1           | date2           | unit        | expected
    ${"2023-01-01"} | ${"2024-01-01"} | ${"years"}  | ${1}
    ${"2023-01-01"} | ${"2023-02-01"} | ${"months"} | ${1}
    ${"2023-01-01"} | ${"2023-01-08"} | ${"weeks"}  | ${1}
    ${"2023-01-01"} | ${"2023-01-02"} | ${"days"}   | ${1}
  `(
    "returns int $expected for single $unit comparing $date1, $date2",
    ({ date1, date2, unit, expected }) => {
      expect(diffDate(date1, date2, unit)).toEqual(expected);
    },
  );

  it.each`
    date1           | date2           | units                                   | expected
    ${"2023-01-01"} | ${"2024-01-01"} | ${["years", "months"]}                  | ${{ years: 1, months: 0 }}
    ${"2023-01-01"} | ${"2024-01-01"} | ${["years", "months", "weeks", "days"]} | ${{ years: 1, months: 0, weeks: 0, days: 0 }}
  `(
    "returns $expected for $unit comparing $date1, $date2",
    ({ date1, date2, units, expected }) => {
      expect(diffDate(date1, date2, units)).toEqual(expected);
    },
  );

  it.each`
    date1           | date2           | units         | expected
    ${"2024-02-29"} | ${"2025-02-28"} | ${["years"]}  | ${{ years: 0 }}
    ${"2024-12-31"} | ${"2025-01-01"} | ${["days"]}   | ${{ days: 1 }}
    ${"2024-01-01"} | ${"2024-12-31"} | ${["weeks"]}  | ${{ weeks: 52 }}
    ${"2024-01-31"} | ${"2024-02-29"} | ${["months"]} | ${{ months: 0 }}
  `(
    "returns $expected for edge cases: $units comparing $date1, $date2",
    ({ date1, date2, units, expected }) => {
      expect(diffDate(date1, date2, units)).toEqual(expected);
    },
  );

  it.each`
    date1           | date2           | expected
    ${"2024-01-01"} | ${"2023-01-01"} | ${{ days: -365 }}
    ${"2024-01-31"} | ${"2024-01-01"} | ${{ days: -30 }}
    ${"2024-02-29"} | ${"2024-01-31"} | ${{ days: -29 }}
  `(
    "returns negative difference for date1 before date2: $date1, $date2",
    ({ date1, date2, expected }) => {
      expect(diffDate(date1, date2, ["days"])).toEqual(expected);
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
    expect(diffDate(invalidDate1 as never, "2024-01-01", ["days"])).toBeNull();
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
    expect(diffDate("2024-01-01", invalidDate2 as never, ["days"])).toBeNull();
  });

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
    ${"hour"}
    ${"day"}
    ${"month"}
    ${"year"}
  `("returns null for invalid unit", ({ invalidUnit }) => {
    expect(
      diffDate("2024-01-01", "2024-01-02", [invalidUnit] as never),
    ).toBeNull();
  });
});
