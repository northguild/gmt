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
    ${"2024-02-29T12:00:00Z"}
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
    value                         | units            | expected                      | note
    ${"2024-03-25[u-ca=hebrew]"}  | ${{ months: 1 }} | ${"2024-02-24[u-ca=hebrew]"}  | ${"Adar -> Adar I (Hebrew leap month)"}
    ${"2023-09-16[u-ca=ethioaa]"} | ${{ months: 1 }} | ${"2023-09-10[u-ca=ethioaa]"} | ${"1st month day 5 -> back into the 5-day Pagumen"}
  `(
    "returns $expected for calendar-annotated $value - $units ($note)",
    ({ value, units, expected }) => {
      expect(subtractDate(value, units)).toBe(expected);
    },
  );

  // CORE-6 D1-A at the minimum: the polyfill throws `Invalid ISO date: -271821-01-01`. Expected
  // values: Chromium 152 (q2-xscan-chromium152.json): edge["islamic-civil"].min[400] reads
  // -280803-M05-07 and subtracts a year to ISO -271821-06-03, which min[45] reads as -280804-M05-07.
  it.each`
    value                                  | units            | expected                               | reason
    ${"-271820-05-23[u-ca=islamic-civil]"} | ${{ years: 1 }}  | ${"-271821-06-03[u-ca=islamic-civil]"} | ${"D1-A: 45 days after the minimum (xscan min[400])"}
    ${"-271820-04-08[u-ca=islamic-civil]"} | ${{ years: 1 }}  | ${"-271821-04-19[u-ca=islamic-civil]"} | ${"D1-A: lands on the minimum (xscan min[355])"}
    ${"-271821-06-26[u-ca=islamic-civil]"} | ${{ months: 1 }} | ${"-271821-05-27[u-ca=islamic-civil]"} | ${"D1-A isolated window (xscan min[68])"}
    ${"-271820-05-09[u-ca=persian]"}       | ${{ months: 1 }} | ${"-271820-04-09[u-ca=persian]"}       | ${"D1-A persian (xscan min[386])"}
    ${"-271820-05-09[u-ca=persian]"}       | ${{ years: 1 }}  | ${"-271821-05-10[u-ca=persian]"}       | ${"D1-A persian (xscan min[386])"}
    ${"-271821-04-28[u-ca=islamic-civil]"} | ${{ months: 1 }} | ${""}                                  | ${"before the minimum is a RangeError, not clamped (xscan min[9] ERR)"}
    ${"-271820-05-23[u-ca=buddhist]"}      | ${{ months: 1 }} | ${"-271820-04-23[u-ca=buddhist]"}      | ${"D2 buddhist (xscan min[400])"}
    ${"-271820-05-23[u-ca=buddhist]"}      | ${{ years: 1 }}  | ${"-271821-05-23[u-ca=buddhist]"}      | ${"D2 buddhist (xscan min[400])"}
    ${"-271821-05-29[u-ca=buddhist]"}      | ${{ years: 1 }}  | ${""}                                  | ${"D2 buddhist before the minimum (xscan min[40] ERR)"}
    ${"-271820-05-23[u-ca=hebrew]"}        | ${{ months: 1 }} | ${"-271820-04-24[u-ca=hebrew]"}        | ${"D3/D4 hebrew (xscan min[400])"}
    ${"-271820-05-23[u-ca=hebrew]"}        | ${{ years: 1 }}  | ${"-271821-05-06[u-ca=hebrew]"}        | ${"D3/D4 hebrew: Adar of leap -268057 (ordinal 12) is ordinal 11 of common -268058 (xscan min[400])"}
    ${"-003759-09-09[u-ca=hebrew]"}        | ${{ years: 2 }}  | ${"-003761-09-01[u-ca=hebrew]"}        | ${"from year 2 into the corrected range (spec NonISODateAdd)"}
    ${"-271820-05-23[u-ca=indian]"}        | ${{ months: 1 }} | ${"-271820-04-22[u-ca=indian]"}        | ${"D5 indian (xscan min[400])"}
    ${"-271820-05-23[u-ca=indian]"}        | ${{ years: 1 }}  | ${"-271821-05-23[u-ca=indian]"}        | ${"D5 indian (xscan min[400])"}
    ${"-271821-05-29[u-ca=indian]"}        | ${{ months: 1 }} | ${"-271821-04-28[u-ca=indian]"}        | ${"D5 indian (xscan min[40])"}
  `(
    "returns $expected for $value - $units ($reason)",
    ({ value, units, expected }) => {
      expect(subtractDate(value, units)).toBe(expected);
    },
  );

  // A date-time is read as its date, as Temporal.PlainDate.from reads it (decided
  // 2026-09-17; before 1.16.0 the sentinel). Expected values from native Chromium 153.
  it("returns 2024-03-09 for the date-time 2024-03-10T14:30:00 minus 1 day", () => {
    expect(subtractDate("2024-03-10T14:30:00", { days: 1 })).toBe("2024-03-09");
  });
});
