import { addDate } from "./addDate";

describe("addDate", () => {
  it.each`
    value           | units                                         | expected
    ${"2024-02-29"} | ${{ days: 1 }}                                | ${"2024-03-01"}
    ${"2024-02-29"} | ${{ weeks: 1 }}                               | ${"2024-03-07"}
    ${"2024-01-31"} | ${{ months: 1 }}                              | ${"2024-02-29"}
    ${"2024-02-29"} | ${{ years: 1 }}                               | ${"2025-02-28"}
    ${"2024-02-29"} | ${{ years: 1, months: 1, weeks: 1, days: 1 }} | ${"2025-04-06"}
  `("returns $expected for $value + $units", ({ value, units, expected }) => {
    expect(addDate(value, units)).toBe(expected);
  });

  it.each`
    negativeAmount                                    | expectedDate
    ${{ years: -1 }}                                  | ${"2023-02-28"}
    ${{ months: -1 }}                                 | ${"2024-01-29"}
    ${{ weeks: -1 }}                                  | ${"2024-02-22"}
    ${{ days: -1 }}                                   | ${"2024-02-28"}
    ${{ years: -1, months: -1, weeks: -1, days: -1 }} | ${"2023-01-21"}
  `(
    "returns the correct date when adding a negative amount: $negativeAmount",
    ({ negativeAmount, expectedDate }) => {
      expect(addDate("2024-02-29", negativeAmount)).toEqual(expectedDate);
    },
  );

  it.each`
    value           | units                      | expected
    ${"2024-01-01"} | ${{ days: 0 }}             | ${"2024-01-01"}
    ${"2024-02-29"} | ${{ days: 0 }}             | ${"2024-02-29"}
    ${"2024-01-01"} | ${{ months: 0, years: 0 }} | ${"2024-01-01"}
  `(
    "returns $expected for zero-unit $value + $units",
    ({ value, units, expected }) => {
      expect(addDate(value, units)).toBe(expected);
    },
  );

  it.each`
    invalidDate
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
  `(
    "returns an empty string for an invalid date $invalidDate",
    ({ invalidDate }) => {
      expect(addDate(invalidDate, { days: 1 })).toEqual("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `("returns an empty string for an invalid unit", ({ invalidUnit }) => {
    expect(addDate("2024-02-29", { [invalidUnit as never]: 1 })).toEqual("");
  });

  it.each`
    invalidAmount
    ${"not-a-number"}
    ${NaN}
    ${null}
    ${undefined}
    ${true}
    ${false}
  `(
    "returns an empty string for an invalid amount: $invalidAmount",
    ({ invalidAmount }) => {
      expect(
        addDate("2024-02-29", { days: invalidAmount as never } as never),
      ).toEqual("");
    },
  );

  it.each`
    value           | units             | overflow       | expected
    ${"2024-01-31"} | ${{ months: 1 }}  | ${undefined}   | ${"2024-02-29"}
    ${"2024-01-31"} | ${{ months: 1 }}  | ${"constrain"} | ${"2024-02-29"}
    ${"2024-01-31"} | ${{ months: 1 }}  | ${"reject"}    | ${""}
    ${"2024-01-31"} | ${{ months: 13 }} | ${undefined}   | ${"2025-02-28"}
    ${"2024-01-31"} | ${{ months: 13 }} | ${"constrain"} | ${"2025-02-28"}
    ${"2024-01-31"} | ${{ months: 13 }} | ${"reject"}    | ${""}
    ${"2024-02-29"} | ${{ years: 1 }}   | ${undefined}   | ${"2025-02-28"}
    ${"2024-02-29"} | ${{ years: 1 }}   | ${"constrain"} | ${"2025-02-28"}
    ${"2024-02-29"} | ${{ years: 1 }}   | ${"reject"}    | ${""}
    ${"2024-01-15"} | ${{ months: 1 }}  | ${"reject"}    | ${"2024-02-15"}
    ${"2024-01-15"} | ${{ days: 1 }}    | ${"reject"}    | ${"2024-01-16"}
    ${"2024-03-31"} | ${{ months: -1 }} | ${undefined}   | ${"2024-02-29"}
    ${"2024-03-31"} | ${{ months: -1 }} | ${"constrain"} | ${"2024-02-29"}
    ${"2024-03-31"} | ${{ months: -1 }} | ${"reject"}    | ${""}
  `(
    "returns $expected for $value + $units with overflow $overflow",
    ({ value, units, overflow, expected }) => {
      expect(
        addDate(
          value,
          units,
          overflow === undefined ? undefined : { overflow },
        ),
      ).toBe(expected);
    },
  );
});
