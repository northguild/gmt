import { isValidFiscalCalendar } from "./isValidFiscalCalendar";

/** NRF 4-5-4 (US): the Saturday nearest January 31, week 53 at the end, start-year label. */
const NRF = {
  pattern: "4-5-4",
  yearEndsOn: "2026-01-31",
  extraWeek: "lastPeriod",
  yearLabel: "startYear",
} as const;

/** ONS retail trading periods (UK): a five-week January, majority-year label. */
const ONS = {
  pattern: "4-4-5",
  yearEndsOn: "2022-12-31",
  extraWeek: "firstPeriod",
  yearLabel: "majorityYear",
} as const;

/** Canadian Tire (CA): the 53rd week in the last quarter, majority-year label. */
const CTC = {
  pattern: "4-4-5",
  yearEndsOn: "2022-12-31",
  extraWeek: "lastPeriod",
  yearLabel: "majorityYear",
} as const;

/** Woolworths Group (AU): the last Sunday of June, end-year label. */
const WW = {
  pattern: "4-4-5",
  yearEndsOn: "2021-06-27",
  extraWeek: "lastPeriod",
  yearLabel: "endYear",
} as const;

/** A calendar with a 182/182 tie year (2025-07-03 to 2026-07-01). */
const T = {
  pattern: "4-4-5",
  yearEndsOn: "2026-07-01",
  extraWeek: "lastPeriod",
  yearLabel: "majorityYear",
} as const;

describe("isValidFiscalCalendar", () => {
  it.each`
    calendar                                              | description
    ${NRF}                                                | ${"NRF (US)"}
    ${ONS}                                                | ${"ONS (UK)"}
    ${CTC}                                                | ${"Canadian Tire (CA)"}
    ${WW}                                                 | ${"Woolworths Group (AU)"}
    ${T}                                                  | ${"a calendar with a tie year"}
    ${{ ...NRF, note: "extra" }}                          | ${"NRF with an extra property, which is ignored"}
    ${{ ...NRF, pattern: "5-4-4" }}                       | ${"NRF with the 5-4-4 pattern"}
    ${{ ...NRF, yearLabel: "endYear" }}                   | ${"NRF labelled by end year"}
    ${{ ...NRF, yearEndsOn: "2026-01-31[u-ca=iso8601]" }} | ${"NRF with yearEndsOn in the ISO calendar, annotated"}
  `("returns true for $description", ({ calendar }) => {
    expect(isValidFiscalCalendar(calendar)).toBe(true);
  });

  it("returns true for a function carrying the four fields, an Object like any other", () => {
    expect(isValidFiscalCalendar(Object.assign(() => 0, NRF))).toBe(true);
  });

  it("returns false for the 1.19 shape, which has no extraWeek or yearLabel", () => {
    expect(
      isValidFiscalCalendar({ pattern: "4-5-4", yearEndsOn: "2026-01-31" }),
    ).toBe(false);
  });

  it.each`
    field           | value
    ${"pattern"}    | ${"4-5-5"}
    ${"pattern"}    | ${undefined}
    ${"pattern"}    | ${454}
    ${"yearEndsOn"} | ${"2026-02-30"}
    ${"yearEndsOn"} | ${"2026-01-31T00:00:00"}
    ${"yearEndsOn"} | ${undefined}
    ${"yearEndsOn"} | ${20260131}
    ${"yearEndsOn"} | ${"2026-01-31[u-ca=hebrew]"}
    ${"extraWeek"}  | ${"lastQuarter"}
    ${"extraWeek"}  | ${"middle"}
    ${"extraWeek"}  | ${""}
    ${"extraWeek"}  | ${12}
    ${"extraWeek"}  | ${null}
    ${"extraWeek"}  | ${undefined}
    ${"yearLabel"}  | ${"fiscalYear"}
    ${"yearLabel"}  | ${"StartYear"}
    ${"yearLabel"}  | ${""}
    ${"yearLabel"}  | ${2024}
    ${"yearLabel"}  | ${null}
    ${"yearLabel"}  | ${undefined}
  `(
    "returns false when only $field is wrong, set to $value",
    ({ field, value }) => {
      expect(isValidFiscalCalendar({ ...NRF, [field]: value })).toBe(false);
    },
  );

  it.each`
    candidate
    ${null}
    ${undefined}
    ${"4-5-4"}
    ${454}
    ${true}
  `("returns false for non-object input $candidate", ({ candidate }) => {
    expect(isValidFiscalCalendar(candidate)).toBe(false);
  });

  // Spec §3.5 (`isObject`): an array is an Object, so it is judged by its four fields like any
  // other object, never refused for its type.
  it.each`
    candidate                 | expected | description
    ${[]}                     | ${false} | ${"no fiscal calendar fields"}
    ${[NRF]}                  | ${false} | ${"the calendar as an element, not as its fields"}
    ${Object.assign([], NRF)} | ${true}  | ${"the four fields set on the array itself"}
  `(
    "returns $expected for an array, which is an Object, with $description",
    ({ candidate, expected }) => {
      expect(isValidFiscalCalendar(candidate)).toBe(expected);
    },
  );

  it.each`
    field
    ${"pattern"}
    ${"yearEndsOn"}
    ${"extraWeek"}
    ${"yearLabel"}
  `("returns false when the $field getter throws", ({ field }) => {
    const calendar = { ...NRF };
    Object.defineProperty(calendar, field, {
      get() {
        throw new Error("hostile getter");
      },
    });

    expect(isValidFiscalCalendar(calendar)).toBe(false);
  });
});
