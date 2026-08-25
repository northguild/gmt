import { subtractDate } from "./subtractDate";

describe("subtractDate", () => {
  it.each`
    value           | units            | expected
    ${"2024-02-29"} | ${{ days: 1 }}   | ${"2024-02-28"}
    ${"2024-02-29"} | ${{ weeks: 1 }}  | ${"2024-02-22"}
    ${"2024-03-31"} | ${{ months: 1 }} | ${"2024-02-29"}
    ${"2024-02-29"} | ${{ years: 1 }}  | ${"2023-02-28"}
    ${"2024-02-29"} | ${{ days: -1 }}  | ${"2024-03-01"}
    ${"2024-02-29"} | ${{ days: -10 }} | ${"2024-03-10"}
  `("returns $expected for $value - $units", ({ value, units, expected }) => {
    expect(subtractDate(value, units)).toBe(expected);
  });

  it.each`
    value           | units                      | expected
    ${"2024-01-01"} | ${{ days: 0 }}             | ${"2024-01-01"}
    ${"2024-02-29"} | ${{ days: 0 }}             | ${"2024-02-29"}
    ${"2024-01-01"} | ${{ months: 0, years: 0 }} | ${"2024-01-01"}
  `(
    "returns $expected for zero-unit $value - $units",
    ({ value, units, expected }) => {
      expect(subtractDate(value, units)).toBe(expected);
    },
  );

  it.each`
    nonStringInput
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
    "returns an empty string for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(subtractDate(nonStringInput, { days: 1 })).toEqual("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `("returns an empty string for an invalid unit", ({ invalidUnit }) => {
    expect(subtractDate("2024-02-29", { [invalidUnit as never]: 1 })).toEqual(
      "",
    );
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
        subtractDate("2024-02-29", { days: invalidAmount } as never),
      ).toEqual("");
    },
  );

  it.each`
    value           | units             | overflow       | expected
    ${"2024-03-31"} | ${{ months: 1 }}  | ${"constrain"} | ${"2024-02-29"}
    ${"2024-03-31"} | ${{ months: 1 }}  | ${"reject"}    | ${""}
    ${"2024-03-31"} | ${{ months: 13 }} | ${"constrain"} | ${"2023-02-28"}
    ${"2024-03-31"} | ${{ months: 13 }} | ${"reject"}    | ${""}
    ${"2024-02-29"} | ${{ years: 1 }}   | ${"constrain"} | ${"2023-02-28"}
    ${"2024-02-29"} | ${{ years: 1 }}   | ${"reject"}    | ${""}
    ${"2024-01-15"} | ${{ months: 1 }}  | ${"reject"}    | ${"2023-12-15"}
  `(
    "returns $expected for $value - $units with overflow $overflow",
    ({ value, units, overflow, expected }) => {
      expect(subtractDate(value, units, { overflow })).toBe(expected);
    },
  );

  // E5 (issue #78): mirror of addDate's calendar-aware coverage — see its JSDoc/tests for
  // the full rationale. Goldens verified directly against @js-temporal/polyfill.
  it.each`
    value                                     | units            | expected                                   | note
    ${"5784-07-15[u-ca=hebrew]"}              | ${{ months: 1 }} | ${"5784-06-15[u-ca=hebrew]"}               | ${"Adar -> Adar I (Hebrew leap month)"}
    ${"7516-01-05[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }} | ${"7515-13-05[u-ca=ethiopic-amete-alem]"}  | ${"1st month day 5 -> back into the 5-day Pagumen"}
  `(
    "returns $expected for calendar-annotated $value - $units ($note)",
    ({ value, units, expected }) => {
      expect(subtractDate(value, units)).toBe(expected);
    },
  );

  it("returns \"\" for a datetime/zoned string instead of silently truncating to its date portion (parseCalendarDateValue regression, E5)", () => {
    expect(subtractDate("2024-03-10T14:30:00", { days: 1 })).toBe("");
  });
});
