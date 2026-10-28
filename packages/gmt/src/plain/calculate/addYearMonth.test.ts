import { addYearMonth } from "./addYearMonth";
import { subtractYearMonth } from "./subtractYearMonth";
import { mockTemporalPlainYearMonthFromThrow } from "../../test/mocks";

// Record Y (context/domination/js-temporal-polyfill-bugs.md): polyfill 0.5.1 `PlainYearMonth#add`
// and `#subtract` predate tc39 41faca474a. Every expected value here is the specification's
// AddDurationToYearMonth (day 1 of the month, CalendarDateAdd), not the polyfill's own result.
describe("addYearMonth", () => {
  it.each`
    value                         | units                      | expected
    ${"2026-10"}                  | ${{ months: 1 }}           | ${"2026-11"}
    ${"2026-12"}                  | ${{ months: 1 }}           | ${"2027-01"}
    ${"2026-10"}                  | ${{ years: 1, months: 3 }} | ${"2028-01"}
    ${"2024-02"}                  | ${{ years: 1 }}            | ${"2025-02"}
    ${"2026-01"}                  | ${{ months: -3 }}          | ${"2025-10"}
    ${"2026-10"}                  | ${{ months: 0 }}           | ${"2026-10"}
    ${"+002026-10[u-ca=ISO8601]"} | ${{ months: 1 }}           | ${"2026-11"}
    ${"+275760-08"}               | ${{ months: 1 }}           | ${"+275760-09"}
  `(
    "returns '$expected' for addYearMonth('$value', $units)",
    ({ value, units, expected }) => {
      expect(addYearMonth(value, units)).toBe(expected);
    },
  );

  it.each`
    value           | units                       | label
    ${"-271821-04"} | ${{ months: 0 }}            | ${"lowest year-month, zero amount (day 1 out of range)"}
    ${"-271821-04"} | ${{ months: 1 }}            | ${"lowest year-month, one month"}
    ${"+275760-09"} | ${{ months: 1 }}            | ${"beyond the upper limit"}
    ${"2026-10"}    | ${{ days: 1 }}              | ${"days (record Y: polyfill add gives 2026-10)"}
    ${"2026-10"}    | ${{ weeks: 1 }}             | ${"weeks (record Y: polyfill add gives 2026-10)"}
    ${"2026-10"}    | ${{ hours: 1 }}             | ${"hours"}
    ${"2026-10"}    | ${{ months: 1, days: 0 }}   | ${"own zero days (readDurationUnits key guard)"}
    ${"2026-10"}    | ${{ month: 1 }}             | ${"misspelt key"}
    ${"2026-10"}    | ${{ months: 1.5 }}          | ${"fraction"}
    ${"2026-10"}    | ${{ months: NaN }}          | ${"NaN"}
    ${"2026-10"}    | ${{ months: "1" }}          | ${"string amount"}
    ${"2026-10"}    | ${{ years: 1, months: -1 }} | ${"mixed signs"}
    ${"2026-10"}    | ${{}}                       | ${"no unit"}
    ${"2026-10"}    | ${null}                     | ${"null units"}
    ${"2026-10"}    | ${1}                        | ${"number units"}
    ${"2026-13"}    | ${{ months: 1 }}            | ${"month 13"}
    ${"2026-10-01"} | ${{ months: 1 }}            | ${"a date"}
    ${""}           | ${{ months: 1 }}            | ${"empty string"}
    ${202610}       | ${{ months: 1 }}            | ${"non-string"}
  `("addYearMonth returns '' for $label", ({ value, units }) => {
    expect(addYearMonth(value, units)).toBe("");
  });

  // An own `days: 0` is refused by readDurationUnits' key guard (its pinned house rule, see
  // readDurationUnits.test.ts); an inherited zero is no amount, as in the specification.
  it("returns '2026-11' when days: 0 is inherited, not an own key", () => {
    const units = Object.create({ days: 0 }) as { months?: number };
    units.months = 1;
    expect(addYearMonth("2026-10", units)).toBe("2026-11");
  });

  it("returns '' when Temporal.PlainYearMonth.from throws", () => {
    mockTemporalPlainYearMonthFromThrow();
    try {
      expect(addYearMonth("2026-10", { months: 1 })).toBe("");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("returns '' for a getter that throws", () => {
    const units = {
      get months(): number {
        throw new Error("hostile");
      },
    };
    expect(addYearMonth("2026-10", units)).toBe("");
  });
});

describe("subtractYearMonth", () => {
  it.each`
    value           | units                      | expected
    ${"2026-10"}    | ${{ months: 10 }}          | ${"2025-12"}
    ${"2026-03"}    | ${{ years: 1, months: 4 }} | ${"2024-11"}
    ${"+275760-09"} | ${{ months: 1 }}           | ${"+275760-08"}
    ${"2026-10"}    | ${{ months: 0 }}           | ${"2026-10"}
    ${"2026-10"}    | ${{ months: -1 }}          | ${"2026-11"}
  `(
    "returns '$expected' for subtractYearMonth('$value', $units)",
    ({ value, units, expected }) => {
      // Record Y: polyfill subtract of +275760-09 throws; it starts from the last day of the month.
      expect(subtractYearMonth(value, units)).toBe(expected);
    },
  );

  it.each`
    value           | units              | label
    ${"-271821-05"} | ${{ months: 1 }}   | ${"day 1 of -271821-04 out of range (record Y: polyfill subtract gives -271821-04)"}
    ${"-271821-04"} | ${{ months: 0 }}   | ${"lowest year-month, zero amount"}
    ${"2026-10"}    | ${{ days: 1 }}     | ${"days"}
    ${"2026-10"}    | ${{ weeks: 1 }}    | ${"weeks"}
    ${"2026-10"}    | ${{ months: 1.5 }} | ${"fraction"}
    ${"2026-10"}    | ${{}}              | ${"no unit"}
    ${"2026-10"}    | ${null}            | ${"null units"}
    ${"2026-13"}    | ${{ months: 1 }}   | ${"month 13"}
    ${"2026-10-01"} | ${{ months: 1 }}   | ${"a date"}
    ${""}           | ${{ months: 1 }}   | ${"empty string"}
  `("subtractYearMonth returns '' for $label", ({ value, units }) => {
    expect(subtractYearMonth(value, units)).toBe("");
  });

  it("returns '' when Temporal.PlainYearMonth.from throws", () => {
    mockTemporalPlainYearMonthFromThrow();
    try {
      expect(subtractYearMonth("2026-10", { months: 1 })).toBe("");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it.each`
    value                         | units
    ${"2026-10"}                  | ${{ months: 1 }}
    ${"2026-12"}                  | ${{ months: 1 }}
    ${"2026-10"}                  | ${{ years: 1, months: 3 }}
    ${"2024-02"}                  | ${{ years: 1 }}
    ${"2026-01"}                  | ${{ months: -3 }}
    ${"2026-10"}                  | ${{ months: 0 }}
    ${"+002026-10[u-ca=ISO8601]"} | ${{ months: 1 }}
  `(
    "subtractYearMonth undoes addYearMonth('$value', $units)",
    ({ value, units }) => {
      const added = addYearMonth(value, units);
      expect(added).not.toBe("");
      expect(subtractYearMonth(added, units)).toBe(
        addYearMonth(value, { months: 0 }),
      );
    },
  );
});
