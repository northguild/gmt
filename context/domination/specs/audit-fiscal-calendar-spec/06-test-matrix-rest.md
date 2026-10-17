# Fiscal calendar spec — test matrix, labels, sentinels and range limits

Part of [the index](../audit-fiscal-calendar-spec.md).

### 6.3 `yearLabel`

| value        | calendar                              | expected `year` | why                                                  |
| ------------ | ------------------------------------- | --------------- | ---------------------------------------------------- |
| `2024-06-15` | NRF, `"endYear"`                      | 2025            | 2024-02-04 to 2025-02-01                             |
| `2024-06-15` | NRF, `"majorityYear"`                 | 2024            | a January-end year puts its majority in the start year |
| `2024-01-28` | NRF, `"endYear"`                      | 2024            |                                                      |
| `2024-01-28` | NRF, `"majorityYear"`                 | 2023            |                                                      |
| `2024-12-29` | ONS, `"startYear"`                    | 2024            |                                                      |
| `2024-12-29` | ONS, `"endYear"`                      | 2026            | the 3-year span: neither end matches ONS             |
| `2023-06-26` | J (`"endYear"`)                       | 2024            | `{ year: 2024, period: 1, week: 1 }`; 2023-06-26 to 2024-06-30 |
| `2024-06-30` | J (`"endYear"`)                       | 2024            | `{ year: 2024, period: 12, week: 53 }`               |
| `2024-06-30` | J, `"majorityYear"`                   | 2023            | 189 days in 2023, 182 in 2024: the end year and the majority differ |
| `2024-06-30` | J, `"startYear"`                      | 2023            |                                                      |

**Tie (GMT rule).** `T = { pattern: "4-4-5", yearEndsOn: "2026-07-01", extraWeek: "lastPeriod", yearLabel: "majorityYear" }`.
The fiscal year 2025-07-03 to 2026-07-01 has 182 days in 2025 and 182 in 2026.

| value        | calendar              | expected                               |
| ------------ | --------------------- | -------------------------------------- |
| `2025-07-03` | `T`                   | `{ year: 2026, period: 1, week: 1 }`   |
| `2026-07-01` | `T`                   | `{ year: 2026, period: 12, week: 52 }` |
| `2026-07-01` | `T`, `"startYear"`    | `{ year: 2025, period: 12, week: 52 }` |

**Labels that repeat (documented limit).** Use calendar `T`:

| value        | expected                               | fiscal year              |
| ------------ | -------------------------------------- | ------------------------ |
| `2025-07-02` | `{ year: 2025, period: 12, week: 52 }` | 2024-07-04 to 2025-07-02 |
| `2026-07-01` | `{ year: 2026, period: 12, week: 52 }` | 2025-07-03 to 2026-07-01 |
| `2026-07-02` | `{ year: 2026, period: 1, week: 1 }`   | 2026-07-02 to 2027-06-30 |

Two consecutive fiscal years are both 2026. Name the test after the JSDoc bullet it pins.
Keep the existing `"2022-12-31"` and `"2027-01-02"` collision tests, with
`yearLabel: "startYear"` added, so the start-year figures in the JSDoc stay pinned.

The windows were found by scanning every year-end date from 2026-01-01 to 2032-12-31 over the
fiscal years 1899 to 2401. Year-end month-days where some pair of consecutive fiscal years
shares a label:

- `"startYear"`: 12-28, 12-29, 12-30, 12-31, 01-01, 01-02
- `"endYear"`: 12-29, 12-30, 12-31, 01-01, 01-02, 01-03
- `"majorityYear"`: 06-29, 06-30, 07-01, 07-02, 07-03

Sending ties to the start year instead gives 06-30 to 07-04, which is also five days. The tie
rule does not change how many year ends are affected, so the IFRS 18 ¶27(c) (formerly IAS 1
¶51(c)) reasoning decides it.
The scan is evidence for this spec, not a test.

### 6.4 `getQuarter`

| value        | options                                              | expected                     |
| ------------ | ---------------------------------------------------- | ---------------------------- |
| `2024-06-15` | none                                                 | `{ year: 2024, quarter: 2 }` |
| `2024-06-15` | `{ fiscalYearStartMonth: 1, yearLabel: <each> }`     | `{ year: 2024, quarter: 2 }` |
| `2024-04-01` | `{ 4, "startYear" }`                                 | `{ year: 2024, quarter: 1 }` |
| `2024-04-01` | `{ 4, "endYear" }`                                   | `{ year: 2025, quarter: 1 }` |
| `2024-03-31` | `{ 4, "startYear" }`                                 | `{ year: 2023, quarter: 4 }` |
| `2024-03-31` | `{ 4, "endYear" }`                                   | `{ year: 2024, quarter: 4 }` |
| `2024-03-31` | `{ 4, "majorityYear" }`                              | `{ year: 2023, quarter: 4 }` |
| `2023-10-15` | `{ 7, "startYear" }`                                 | `{ year: 2023, quarter: 2 }` |
| `2023-10-15` | `{ 7, "endYear" }`                                   | `{ year: 2024, quarter: 2 }` |
| `2023-10-15` | `{ 7, "majorityYear" }`                              | `{ year: 2023, quarter: 2 }` |
| `2024-10-01` | `{ 10, "startYear" }`                                | `{ year: 2024, quarter: 1 }` |
| `2024-10-01` | `{ 10, "endYear" }`                                  | `{ year: 2025, quarter: 1 }` |
| `2024-10-01` | `{ 10, "majorityYear" }`                             | `{ year: 2025, quarter: 1 }` |
| `2024-06-15` | `{ 8, "majorityYear" }`                              | `{ year: 2024, quarter: 4 }` |
| `2024-08-01` | `{ 8, "majorityYear" }`                              | `{ year: 2025, quarter: 1 }` |

Add one property test: for each start month 1–12, `"majorityYear"` equals `"startYear"` for
months 1–7 and `"endYear"` for months 8–12, on one date per month across a leap year and a
common year. This pins §3.3.

### 6.5 Invalid input → sentinel

`getFiscalPeriod("2024-06-15", c)` → `null` for each of these `c`:

- `{ pattern, yearEndsOn }` with no `extraWeek` and no `yearLabel` (the 1.19 shape)
- `NRF` without `extraWeek`; `NRF` without `yearLabel`
- `extraWeek` of `"lastQuarter"`, `"middle"`, `""`, `12`, `null`
- `yearLabel` of `"fiscalYear"`, `"StartYear"`, `""`, `2024`, `null`
- a calendar whose `yearLabel` getter throws
- an array with `pattern`, `yearEndsOn`, `extraWeek` and `yearLabel` set as properties
- a calendar whose `extraWeek` getter returns `"lastPeriod"` on the first read and `"bogus"` on
  later reads: the result must equal the `NRF` result, which proves each field is read once
- all existing invalid-pattern, invalid-`yearEndsOn` and invalid-value rows, with the two new
  fields added so that only the field under test is wrong

`getQuarter("2024-06-15", o)` → `null` for each of these `o`:

- `{}`
- `{ fiscalYearStartMonth: 4 }`
- `{ yearLabel: "startYear" }`
- `{ fiscalYearStartMonth: 4, yearLabel: "bogus" }`
- `{ fiscalYearStartMonth: 0 | 13 | 4.5 | "4", yearLabel: "startYear" }`
- `null`, `"4"`
- options whose getter throws

### 6.6 Validators

- `isValidFiscalExtraWeek`: true for the two values; false for `"FirstPeriod"`,
  `"lastQuarter"`, `""`, `1`, `null`, `undefined`, `{}`.
- `isValidFiscalYearLabel`: true for the three values; false for `"fiscalYear"`,
  `"start"`, `""`, `2024`, `null`, `undefined`.
- `isValidFiscalCalendar`: true for `NRF`, `ONS`, `J` and `T`, and for `NRF` with an
  extra property. False for the 1.19 shape, for each field wrong in turn, for `null`, `"4-5-4"`,
  `[]`, for an array with the four `NRF` fields set as properties (arrays are refused, as in
  `isValidBusinessCalendar`), and for a calendar whose getter throws.

### 6.7 Temporal's range limits (the cycle shift, §3.3)

Values came from the reference implementation running in the moved cycle. Each date is
Temporal's first or last, and each fiscal year runs past that limit.

| call                                                                         | expected                                      | moved-cycle fiscal year  |
| ---------------------------------------------------------------------------- | --------------------------------------------- | ------------------------ |
| `getFiscalPeriod("-271821-04-19", NRF)`                                      | `{ year: -271821, period: 3, week: 12 }`      | 2179-01-31 to 2180-01-29 |
| `getFiscalPeriod("-271821-04-19", { ...NRF, yearLabel: "endYear" })`         | `{ year: -271820, period: 3, week: 12 }`      | same                     |
| `getFiscalPeriod("-271821-04-19", ONS)`                                      | `{ year: -271821, period: 4, week: 16 }`      | 2179-01-03 to 2180-01-01 |
| `getFiscalPeriod("+275760-09-13", NRF)`                                      | `{ year: 275760, period: 8, week: 32 }`       | 2160-02-03 to 2161-01-31 |
| `getFiscalPeriod("+275760-09-13", ONS)`                                      | `{ year: 275760, period: 9, week: 37 }`       | 2159-12-30 to 2161-01-03 |
| `getFiscalPeriod("+275760-09-13", { ...ONS, yearLabel: "endYear" })`         | `{ year: 275761, period: 9, week: 37 }`       | same                     |
| `getQuarter("-271821-04-19", { fiscalYearStartMonth: 5, yearLabel: "startYear" })` | `{ year: -271822, quarter: 4 }`         | 2178-05-01 to 2179-04-30 |
| `getQuarter("-271821-04-19", { fiscalYearStartMonth: 5, yearLabel: "endYear" })`   | `{ year: -271821, quarter: 4 }`         | same                     |
| `getQuarter("-271821-04-19", { fiscalYearStartMonth: 5, yearLabel: "majorityYear" })` | `{ year: -271822, quarter: 4 }`      | same (245 days in the start year) |

Without the shift, every row above returned `null`: the year-before probe for the lower limit
and the year-after probe for the upper limit throw `RangeError`. Also test `gregorianCycleShift`
directly: 2024 → 0, -271820 → -274000, 275760 → 273600, and that a date moved by the result keeps
its month, day and `dayOfWeek` for one date in each of the 400 years of a cycle.

---

