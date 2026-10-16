# Fiscal calendar: 53rd-week placement and year label — implementation spec

**Origin:** the international-standards audit. The owner has approved the change.
**Host story:** CORE-5 (`getFiscalPeriod`, `getQuarter`, `isValidFiscalPattern`). This spec
reverses two of CORE-5's decisions, so slice 6 adds a `## Corrections` entry to
`context/domination/issues/CORE-5.md` (see §9.3).
**Release:** `minor` changeset with a **Breaking changes** section (1.19.0 → 1.20.0). Users are
internal, so there is no compatibility shim and no deprecation.
**Blocked by:** nothing. Every file touched already exists.

Every number in this spec came from running code: the reference implementation in §3 run under
`@js-temporal/polyfill` 0.5.1, checked against the published calendars in §6.1.

## What changes

Two facts about a 52/53-week calendar are currently GMT rules, and GMT picked one answer for
each:

1. **Where the 53rd week goes.** Today it is always appended to period 12.
2. **Which calendar year labels the fiscal year.** Today it is always the year the fiscal year
   starts in. `getQuarter` uses the same rule for month-based fiscal years.

No international standard settles either question. The two published calendars below, from
two countries, disagree on both, and IAS 1 ¶51(c) names a third label, the year the period ends
in. So both become **required, named fields** that the caller states. GMT keeps no default,
because any default would match one source and silently mislabel the others.

| Source                                     | 53rd week goes in                         | Year labelled by                                                        |
| ------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------- |
| NRF 4-5-4 calendar (US trade body; peer)   | the last period ("end of the calendar")   | start year (fiscal 2023 = 2023-01-29 to 2024-02-03)                     |
| ONS trading periods (UK statistics office; peer) | the first period ("a five week January") | the calendar year holding most of it (2025 = 2024-12-29 to 2026-01-03) |
| IAS 1 ¶51(c) (IASB; international)         | —                                         | a reporting period is identified by the date it ends, so `"endYear"`     |

ONS is the evidence that the majority rule is needed. Its label is neither the start year nor
the end year: 2024-12-29 to 2026-01-03 is "2025". Of the three rules, only the majority rule
gives that label.

---

## 0. Authority — what each rule rests on

International body first (IAS 1). The two national sources, NRF (US) and ONS (UK), are labelled
peers. Neither is an authority for GMT; each is cited only to show that callers disagree.
Company calendars are not used as sources.

| Rule                                                                                         | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A reporting period of 52 weeks (so also 53) is permitted                                     | **IAS 1 ¶37** (IASB): "Normally, an entity consistently prepares financial statements for a one-year period. However, for practical reasons, some entities prefer to report, for example, for a 52-week period. This Standard does not preclude this practice." Text read from the XRB's reproduction, NZ IAS 1 (Diff Rep), issued November 2012. The IFRS Foundation's own text (ifrs.org, IAS 1 HTML) is behind registration: **not reached**. |
| A fiscal year is identified by the date its reporting period ends                            | **IAS 1 ¶51(c)**: an entity shall display "the date of the end of the reporting period or the period covered by the set of financial statements or notes". Same source and reach as above. It is the reason the `"endYear"` option exists, and the reason for the tie rule below. It does not require any one year label. |
| IAS 1 is superseded                                                                          | IFRS 18 replaces IAS 1 for annual periods beginning on or after 1 January 2027 and carries the general-presentation paragraphs into IAS 8. Where the text of ¶37 and ¶51(c) now sits (standard and paragraph number): **not reached**. The finalizer re-checks this before release, and the JSDoc cites "IAS 1 ¶37" and "IAS 1 ¶51(c)" until the new numbers are read from the source. |
| No international standard fixes the period pattern, the 53rd-week placement or the year label | IAS 1 ¶37 permits the 52-week period and says nothing more. IAS 34 (interim reporting) does not define 4-4-5 shapes either. So all three are caller-stated parameters. Pattern and year end already were; this spec adds the other two. |
| 53rd week in the **last** period — peer (US)                                                  | NRF, _4-5-4 Calendar_ FAQ (nrf.com/resources/4-5-4-calendar, datePublished 2026-02-04): "it is sometimes necessary to add a 53rd week to the end of the calendar"; the test for it: "If, after laying out the entire 52-week calendar for any given year, there are four or more days left in January during the 53rd week, then a 53rd week is added." NRF 2023–2025 calendar PDF: "Fiscal Year 2023 is a 53 week year", with week 53 = 2024-01-28 to 2024-02-03. |
| 53rd week in the **first** period — peer (UK)                                                 | ONS, _Retail sales index reporting periods_, `tradingperiods2026.xlsx` (published 21 November 2025), Note 2: "Typically reporting periods follow a four-week four-week five-week reporting cycle. With 365 days in a year this shifts the periods back by one day annually (two on a leap year). To offset this shift a five week January is introduced every five to six years." Sheet "Trading Periods for 2025": weeks 5,4,5,4,4,5,4,4,5,4,4,5, from 2024-12-29 to 2026-01-03. |
| Label = calendar year holding the most of the fiscal year — peer (UK)                        | ONS sheet titles ("Trading Periods for 2025" = 2024-12-29 to 2026-01-03; "Trading Periods for 2020" = 2019-12-29 to 2021-01-02). ONS does not publish the rule in words. It is the only one of the three rules that reproduces these titles (§6.1). |
| Label = end year                                                                             | **IAS 1 ¶51(c)**, above: a reporting period is identified by the date it ends. |
| Majority is measured in **days**                                                             | **GMT rule.** The fiscal year and the calendar year share no unit except the day. Months have unequal lengths, and a week can straddle 1 January. |
| An even split goes to the **end** year                                                       | **GMT rule.** No peer publishes a tie rule. IAS 1 ¶51(c) identifies a reporting period by its end date, so the year that holds the end date wins. Ties occur only in 364-day years that split 182/182, and only for year ends from 29 June to 4 July (§6.3). No month-based fiscal year can tie (§3.3). |
| Both fields are required; there is no default                                                 | **GMT rule.** NRF and ONS disagree on both choices, and IAS 1 ¶51(c) supports a third label. A default would match one and mislabel the rest without warning ([no catch-all functions](../../coding-standards.md#api-contract): every call the types accept returns a correct value). |
| A missing or unrecognised field returns the sentinel                                          | [coding-standards § API Contract](../../coding-standards.md#api-contract): `null` for an object return, `false` for a boolean validator. |
| A label from a calendar year cannot be unique for every year end                              | Arithmetic: a 364/371-day year drifts against a 365/366-day year. Verified for every rule in §6.3: each rule has a window of about five or six year-end month-days where two fiscal years share a label. The window moves with the rule; no rule removes it. |

---

## 1. Files and signatures

### 1.1 Types — `packages/gmt/src/types/fiscal-calendar.ts`

```ts
export type FiscalPattern = "4-5-4" | "4-4-5" | "5-4-4"; // unchanged

/** The period a 53rd week is added to. */
export type FiscalExtraWeek = "firstPeriod" | "lastPeriod";

/** The calendar year that names a fiscal year. */
export type FiscalYearLabel = "startYear" | "endYear" | "majorityYear";

export interface FiscalCalendar {
  pattern: FiscalPattern; // unchanged
  yearEndsOn: string; // unchanged
  extraWeek: FiscalExtraWeek; // new, required
  yearLabel: FiscalYearLabel; // new, required
}
```

Why period wording instead of quarter wording: period 1 sits in quarter 1, and period 12 sits
in quarter 4. So `"firstPeriod"` and `"lastPeriod"` also say which quarter gets 14 weeks, and they
also say which month gets 5 or 6 weeks, which quarter wording does not. No peer puts the week in
a middle period, so there is no third value.

### 1.2 Public functions

| File                                                        | Signature                                                                                                                                                                                                                                  | Change                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `packages/gmt/src/calendar/calculate/getFiscalPeriod.ts`    | `getFiscalPeriod(value: string, calendar: FiscalCalendar): { year: number; period: number; week: number } \| null`                                                                                                                         | `calendar` gains two required fields |
| `packages/gmt/src/calendar/calculate/getQuarter.ts`         | `getQuarter(value: string, options?: { fiscalYearStartMonth: number; yearLabel: FiscalYearLabel }): { year: number; quarter: number } \| null`                                                                                              | when `options` is given, both fields are now required; `fiscalYearStartMonth` loses its default |
| `packages/gmt/src/calendar/validate/isValidFiscalExtraWeek.ts` | `isValidFiscalExtraWeek(value: unknown): value is FiscalExtraWeek`                                                                                                                                                                     | new                                |
| `packages/gmt/src/calendar/validate/isValidFiscalYearLabel.ts` | `isValidFiscalYearLabel(value: unknown): value is FiscalYearLabel`                                                                                                                                                                     | new                                |
| `packages/gmt/src/calendar/validate/isValidFiscalCalendar.ts`  | `isValidFiscalCalendar(calendar: unknown): calendar is FiscalCalendar`                                                                                                                                                                 | new. Follows `isValidBusinessCalendar`, including refusing arrays |

`getQuarter` with no `options` still returns calendar quarters. That call has one possible
answer, so it needs no label. Once `options` is passed, the caller has asked for a fiscal year
and must say how to name it.

The two single-field validators narrow a string read from config, an env var or a form, the
same job `isValidFiscalPattern` does. `isValidFiscalCalendar` replaces the advice to check the
pattern and the date separately. A `null` from `getFiscalPeriod` can mean a bad calendar or an
unusable date, and one call now tells them apart.

`isValidFiscalCalendar` returns `false` for an array, as `isValidBusinessCalendar` does. A
calendar is four named fields, never a tuple, which is the precedent CORE-79 set for
`Position`. An array with those four properties attached is still refused.

### 1.3 Internal — `packages/gmt/src/internal/fiscalCalendar.ts`

```ts
// changed: a fourth parameter
export function fiscalPeriodOfWeek(
  week: number,
  weeks: number,
  pattern: FiscalPattern,
  extraWeek: FiscalExtraWeek,
): number;

// new: shared by getQuarter and getFiscalPeriod (§3.3)
export function gregorianCycleShift(year: number): number;

// new
export function fiscalYearLabel(
  start: Temporal.PlainDate,
  end: Temporal.PlainDate,
  label: FiscalYearLabel,
): number;
```

- `fiscalYearOf` still returns `{ start, weeks }`. The search runs on a date already moved into
  the safe cycle (§3.3), so it no longer needs a null return for a fiscal year that runs past
  Temporal's range. `getFiscalPeriod` derives `end` as `start.add({ days: weeks * 7 - 1 })`, in
  the same cycle.
- `fiscalYearEndIn` is unchanged.
- `fiscalYearLabel` and `gregorianCycleShift` are exported from `internal/index.ts` beside the
  other two. `getQuarter` and
  `getFiscalPeriod` both call it, so the majority rule and the tie rule live in one place.

---

## 2. Validation order and sentinels

### `getFiscalPeriod` → `null`

1. `isValidFiscalCalendar(calendar)` is false → `null`. That covers a non-object calendar, an
   unrecognised `pattern`, a `yearEndsOn` that is not a plain ISO date, and an `extraWeek` or
   `yearLabel` that is missing or not one of the listed values.
2. `zonelessCalendarDate(value)` is null → `null` (unchanged: moments and junk are refused).
3. Anything thrown (a hostile getter) → outer `catch` → `null`.

Every date `zonelessCalendarDate` accepts gets a value, including dates whose fiscal year starts
before Temporal's first date (-271821-04-19) or ends after its last (+275760-09-13). The work runs
inside the Gregorian cycle shift (§3.3), the same way `getQuarter` does. `getFiscalPeriod` no
longer returns `null` for a fiscal year that runs past Temporal's range. The label is a number,
so it may name a year outside that range: `"endYear"` at `+275760-09-13` under the ONS calendar
is 275761.

### `getQuarter` → `null`

1. `options === undefined` → calendar quarters, as today.
2. `options` is not an object (`isOptionsArgument`) → `null`.
3. `fiscalYearStartMonth` is not an integer from 1 to 12 → `null`. **There is no default any
   more**: `{}` and `{ yearLabel: "startYear" }` return `null`.
4. `isValidFiscalYearLabel(options.yearLabel)` is false → `null`.
5. `zonelessCalendarDate(value)` is null → `null`.
6. Anything thrown → `null`.

Like `getFiscalPeriod`, every accepted date gets a value through the cycle shift (§3.3), even
when its fiscal year starts in the year before Temporal's first date.

### Validators → `false`

- Each is total: any input, no throw. Non-string → `false`.
- `isValidFiscalCalendar` reads each field once inside `try`. A getter that throws → `false`.
- `isValidFiscalCalendar` accepts extra properties and refuses arrays, as `isValidBusinessCalendar`
  does.

---

## 3. Algorithms

### 3.1 `fiscalPeriodOfWeek(week, weeks, pattern, extraWeek)`

```text
shape  = WEEKS_PER_PERIOD[pattern]
target = extraWeek === "firstPeriod" ? 1 : PERIODS_PER_YEAR      // 1 or 12
consumed = 0
for period in 1..12:
  consumed += shape[(period - 1) % 3] + (weeks === 53 && period === target ? 1 : 0)
  if week <= consumed: return period
return PERIODS_PER_YEAR
```

- In a 52-week year the result does not depend on `extraWeek`.
- 53-week year shapes this produces, by first and last quarter:
  - `"4-5-4"`: firstPeriod 5-5-4 … 4-5-4; lastPeriod 4-5-4 … 4-5-5
  - `"4-4-5"`: firstPeriod 5-4-5 … 4-4-5 (ONS); lastPeriod 4-4-5 … 4-4-6
  - `"5-4-4"`: firstPeriod 6-4-4 … 5-4-4; lastPeriod 5-4-4 … 5-4-5

### 3.2 `fiscalYearLabel(start, end, label)`

```text
startYear    → start.year
endYear      → end.year
majorityYear →
  best = null, bestDays = -1
  for y in start.year..end.year:                       // at most 3 years (371 days)
    from = y === start.year ? start : PlainDate(y, 1, 1)
    to   = y === end.year   ? end   : PlainDate(y, 12, 31)
    days = from.until(to, { largestUnit: "day" }).days + 1
    if days >= bestDays: best = y, bestDays = days     // ">=": a tie goes to the later (end) year
  return best
```

Build `PlainDate(y, 1, 1)` and `PlainDate(y, 12, 31)` with `Temporal.PlainDate.from({ year, month,
day })`. Both dates exist in every ISO year, so no overflow is involved.

When a fiscal year spans three calendar years (for example 2024-12-29 to 2026-01-03), the middle
year has at least 365 days and wins. That is why the loop covers every year in the span instead
of comparing only the two end years. An earlier draft compared only the end years and labelled
ONS 2025 as "2026".

### 3.3 `getQuarter` with `options`, and the Gregorian cycle shift

```text
startYear = date.month < m ? date.year - 1 : date.year
shift     = gregorianCycleShift(startYear)
start     = PlainDate(startYear - shift, m, 1)
end       = start.add({ years: 1 }).subtract({ days: 1 })
year      = fiscalYearLabel(start, end, options.yearLabel) + shift
quarter   = floor(((date.month - m + 12) % 12) / 3) + 1        // unchanged
```

**`gregorianCycleShift(year)`** returns the multiple of 400 years that moves `year` into 2000 to
2399: `year − 2000 − (((year % 400) + 400) % 400)`. Each 400-year Gregorian cycle has 146,097
days, which is a whole number of weeks, and its leap years fall in the same places. So moving a
date by a multiple of 400 years keeps its month, day and weekday. The weekday is what the
"nearest weekday" year-end rule depends on. Labels and week numbers computed in the moved cycle
are the same as in the real one, apart from the year offset, which is added back to the label
only. Examples: `gregorianCycleShift(2024)` is 0, `gregorianCycleShift(-271820)` is -274000,
`gregorianCycleShift(275760)` is 273600.

**Why it is needed.** Both functions probe a calendar year next to the date's own. `getQuarter`
builds the first day of the fiscal year, which can be in the year before the date.
`fiscalYearOf` builds year ends from one year before to two years after. Near Temporal's lower
limit the probe itself throws: `Temporal.PlainDate.from({ year: -271822, month: 5, day: 1 })` and
`fiscalYearEndIn(nrfAnchor, -271822)` both throw `RangeError`. So a valid date such as
`-271821-04-19` returned `null`, though its quarter and fiscal period are well defined. The same
can happen at the upper limit, where `fiscalYearOf` probes two years ahead. Running the whole
computation in 2000 to 2399 means no probe ever leaves the range.

`getFiscalPeriod` uses the same shift (§3.4), so the two functions agree near the limits.

- `start.add({ years: 1 })` from day 1 of a month never clamps, and in the moved cycle it never
  leaves the range.
- `m = 1`: start and end fall in the same year, so all three labels agree.
- Majority for month-based years: start months 1 to 7 give the start year (July to December is
  184 days, more than 181 or 182). Start months 8 to 12 give the end year. No start month can
  tie: the start-year part is a whole number of months, and no such sum is half of 365 or 366.

### 3.4 `getFiscalPeriod`

```text
if !isValidFiscalCalendar(calendar): return null
date  = zonelessCalendarDate(value); if !date: return null
shift = gregorianCycleShift(date.year)
local = date.with({ year: date.year - shift })            // same month, day and weekday
fy    = fiscalYearOf(local, PlainDate.from(calendar.yearEndsOn))
end   = fy.start.add({ days: fy.weeks * 7 - 1 })
week  = floor(fy.start.until(local, { largestUnit: "day" }).days / 7) + 1
return {
  year:   fiscalYearLabel(fy.start, end, calendar.yearLabel) + shift,
  period: fiscalPeriodOfWeek(week, fy.weeks, calendar.pattern, calendar.extraWeek),
  week,
}
```

`fy.start` and `end` are dates in the moved cycle. They are never moved back, because only the
label leaves the function. That is why a fiscal year that runs past Temporal's range still gets
a value.

Read each field of `calendar` once into a local, then validate and use the locals. Do not read
from `calendar` again after validation. A getter could return a different value the second
time.

### 3.5 Validators

- `isValidFiscalExtraWeek`: `typeof value === "string" && (value === "firstPeriod" || value === "lastPeriod")`.
- `isValidFiscalYearLabel`: the same, over the three label values.
- `isValidFiscalCalendar`: `isObject(calendar) && !Array.isArray(calendar)`, as in
  `isValidBusinessCalendar`, then read the four fields once and require
  `isValidFiscalPattern`, `isValidDate`, `isValidFiscalExtraWeek` and `isValidFiscalYearLabel`.
  Wrap it in `try`/`catch` → `false`.

---

## 4. JSDoc drafts

Use these blocks as the text. Plain-English rules apply. Every `@example` result below came
from running the reference code.

### 4.1 `types/fiscal-calendar.ts`

```ts
/**
 * The period a 53rd week is added to, in a fiscal year that has one.
 *
 * - `"firstPeriod"` — the first period gets the extra week, so quarter 1 has 14 weeks. One
 *   published example is the ONS retail trading periods (UK): "a five week January is
 *   introduced every five to six years".
 * - `"lastPeriod"` — the last period gets it, so quarter 4 has 14 weeks. One published example
 *   is the NRF 4-5-4 calendar (US), which adds the week "to the end of the calendar".
 *
 * Narrow a candidate with `isValidFiscalExtraWeek`.
 */
export type FiscalExtraWeek = "firstPeriod" | "lastPeriod";

/**
 * The calendar year that names a fiscal year.
 *
 * - `"startYear"` — the year its first day falls in. NRF (US): fiscal 2023 runs 2023-01-29 to
 *   2024-02-03.
 * - `"endYear"` — the year its last day falls in. IAS 1 ¶51(c) identifies a reporting period by
 *   the date it ends: a fiscal year from 2023-06-26 to 2024-06-30 is 2024.
 * - `"majorityYear"` — the calendar year holding the most of its days. ONS (UK): 2025 runs
 *   2024-12-29 to 2026-01-03. When two years hold exactly half each, the label is the end year,
 *   the year holding the date the period ends on.
 *
 * Narrow a candidate with `isValidFiscalYearLabel`.
 */
export type FiscalYearLabel = "startYear" | "endYear" | "majorityYear";

/** Caller-supplied 52/53-week fiscal calendar. GMT bundles none, and has no defaults. */
export interface FiscalCalendar {
  /** The weeks per period within each quarter. */
  pattern: FiscalPattern;
  /**
   * The year-end rule, stated as one ISO date: fiscal years end on this date's **weekday**,
   * on the occurrence nearest this date's **month and day**. NRF (US) adds a 53rd week when
   * "there are four or more days left in January", which is the Saturday nearest
   * January 31: `"2026-01-31"`.
   */
  yearEndsOn: string;
  /** The period a 53rd week is added to. */
  extraWeek: FiscalExtraWeek;
  /** The calendar year that names a fiscal year. */
  yearLabel: FiscalYearLabel;
}
```

### 4.2 `getFiscalPeriod` — bullets that change, and examples

Replace the two `GMT rule:` bullets and the "not a unique key" bullet with these:

```text
 * - Fiscal years of 52 or 53 weeks are permitted by IAS 1 ¶37. No international standard
 *   says where the 53rd week goes or which calendar year names the fiscal year, and published
 *   calendars disagree on both. So `calendar.extraWeek` and `calendar.yearLabel` are required,
 *   and there is no default.
 * - `calendar.extraWeek` is the period a 53rd week is added to: `"firstPeriod"` (ONS, UK: "a
 *   five week January") or `"lastPeriod"` (NRF, US: "to the end of the calendar").
 * - `calendar.yearLabel` names the fiscal year: `"startYear"` (NRF, US), `"endYear"` (the
 *   year holding the end date, by which IAS 1 ¶51(c) identifies a reporting period) or
 *   `"majorityYear"`, the calendar year holding the most days (ONS, UK). GMT rule: a 182/182 split goes to the end year, because IAS 1
 *   ¶51(c) identifies a reporting period by the date it ends.
 * - **`year` is not a unique key for every year end.** A 364- or 371-day year drifts against
 *   the calendar, so every label rule has year ends where two fiscal years share a label and a
 *   calendar year names none. `"startYear"` and `"endYear"` do this for year ends near
 *   1 January. Under `yearEndsOn: "2022-12-31"` with `"startYear"`, two fiscal years both start
 *   in 2023, and 2020, 2025 and 2031 name none. `"majorityYear"` does it for year ends near
 *   1 July. Under `yearEndsOn: "2026-07-01"`, 2025-07-03 to 2026-07-01 and 2026-07-02 to
 *   2027-06-30 are both 2026. If your rule falls in such a window, key on the fiscal year's
 *   start date, not on `year`.
 * - Returns null on invalid input, including a calendar with a missing or unrecognised field.
 *   That shares the sentinel with a date that cannot be placed, so check the calendar with
 *   `isValidFiscalCalendar` first to tell the two apart.
```

Keep the `yearEndsOn`-by-example bullet, but replace its quote. NRF's page no longer says
"Saturday nearest January 31". Quote "four or more days left in January" instead (§0).

Examples (replace all of them):

```text
 * @example getFiscalPeriod("2024-06-15", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // { year: 2024, period: 5, week: 19 }
 * @example getFiscalPeriod("2024-02-04", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // { year: 2024, period: 1, week: 1 } (NRF fiscal 2024 opens)
 * @example getFiscalPeriod("2024-01-28", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // { year: 2023, period: 12, week: 53 } (the 53rd week of NRF fiscal 2023)
 * @example getFiscalPeriod("2024-01-28", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "endYear" }) // { year: 2024, period: 12, week: 53 } (the same week, named by the year it ends in)
 * @example getFiscalPeriod("2024-03-31", { pattern: "4-4-5", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // { year: 2024, period: 3, week: 9 }
 * @example getFiscalPeriod("2025-02-01", { pattern: "4-4-5", yearEndsOn: "2022-12-31", extraWeek: "firstPeriod", yearLabel: "majorityYear" }) // { year: 2025, period: 1, week: 5 } (ONS 2025: a five-week January)
 * @example getFiscalPeriod("2024-12-29", { pattern: "4-4-5", yearEndsOn: "2022-12-31", extraWeek: "firstPeriod", yearLabel: "majorityYear" }) // { year: 2025, period: 1, week: 1 } (ONS 2025 opens in December 2024)
 * @example getFiscalPeriod("2024-06-15", { pattern: "4-5-5", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // null (not one of the three patterns)
 * @example getFiscalPeriod("2024-06-15", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod" }) // null (no yearLabel)
 * @example getFiscalPeriod("2024-06-15T12:00:00Z", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // null (a moment, not a calendar date)
```

`@param calendar`: `{ pattern, yearEndsOn, extraWeek, yearLabel }`, all required.

Return-field JSDoc:

- `year`: "The calendar year that names the fiscal year, chosen by `calendar.yearLabel`."
- `period`: "… and a 53rd week belongs to period 1 or period 12, as `calendar.extraWeek` says."

### 4.3 `getQuarter`

Replace the `GMT rule:` bullet with this:

```text
 * - With `options`, these are fiscal quarters. The fiscal year starts on day 1 of
 *   `fiscalYearStartMonth`, and `yearLabel` names it: `"startYear"`, `"endYear"`, or
 *   `"majorityYear"` (the calendar year holding the most of its days). Both are required, and
 *   there is no default. Start months 1 to 7 put most days in the start year, and 8 to 12 put
 *   most in the end year.
 * - Returns null on invalid input, including `options` without both fields, a
 *   `fiscalYearStartMonth` that is not an integer from 1 to 12, or an unrecognised `yearLabel`.
```

Examples (replace all of them):

```text
 * @example getQuarter("2024-06-15") // { year: 2024, quarter: 2 }
 * @example getQuarter("2024-10-01") // { year: 2024, quarter: 4 }
 * @example getQuarter("2024-04-01", { fiscalYearStartMonth: 4, yearLabel: "startYear" }) // { year: 2024, quarter: 1 }
 * @example getQuarter("2024-03-31", { fiscalYearStartMonth: 4, yearLabel: "startYear" }) // { year: 2023, quarter: 4 } (the previous fiscal year)
 * @example getQuarter("2024-03-31", { fiscalYearStartMonth: 4, yearLabel: "endYear" }) // { year: 2024, quarter: 4 }
 * @example getQuarter("2023-10-15", { fiscalYearStartMonth: 7, yearLabel: "endYear" }) // { year: 2024, quarter: 2 }
 * @example getQuarter("2023-10-15", { fiscalYearStartMonth: 7, yearLabel: "majorityYear" }) // { year: 2023, quarter: 2 } (July to December is 184 of its days)
 * @example getQuarter("2024-10-01", { fiscalYearStartMonth: 10, yearLabel: "majorityYear" }) // { year: 2025, quarter: 1 }
 * @example getQuarter("2024-06-15", { fiscalYearStartMonth: 4 }) // null (no yearLabel)
 * @example getQuarter("2024-06-15", { fiscalYearStartMonth: 13, yearLabel: "startYear" }) // null
 * @example getQuarter("2024-06-15T12:00:00Z") // null (a moment, not a calendar date)
 * @example getQuarter("invalid") // null
```

Option JSDoc: `fiscalYearStartMonth` loses `@defaultValue`. `yearLabel`: "The calendar year
that names a fiscal year. See `FiscalYearLabel`." The `year` return field: "The year that names
the quarter's year: the calendar year with no `options`, otherwise the one `yearLabel` picks."

### 4.4 Validators

`isValidFiscalExtraWeek`:

```text
 * @example isValidFiscalExtraWeek("firstPeriod") // true
 * @example isValidFiscalExtraWeek("lastPeriod") // true
 * @example isValidFiscalExtraWeek("lastQuarter") // false
 * @example isValidFiscalExtraWeek(12) // false
```

`isValidFiscalYearLabel`:

```text
 * @example isValidFiscalYearLabel("startYear") // true
 * @example isValidFiscalYearLabel("endYear") // true
 * @example isValidFiscalYearLabel("majorityYear") // true
 * @example isValidFiscalYearLabel("fiscalYear") // false
 * @example isValidFiscalYearLabel(null) // false
```

`isValidFiscalCalendar`:

```text
 * @example isValidFiscalCalendar({ pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }) // true
 * @example isValidFiscalCalendar({ pattern: "4-5-4", yearEndsOn: "2026-01-31" }) // false (the 1.19 shape: no extraWeek or yearLabel)
 * @example isValidFiscalCalendar({ pattern: "4-5-4", yearEndsOn: "2026-02-30", extraWeek: "lastPeriod", yearLabel: "startYear" }) // false
 * @example isValidFiscalCalendar("4-5-4") // false
```

`isValidFiscalPattern`: change the `"4-5-5"` example's note to "(a 53-week year's last quarter
under `"lastPeriod"`, not a pattern)". Also change the bullet that names `getFiscalPeriod`'s
sentinel so it points at `isValidFiscalCalendar`.

### 4.5 `internal/fiscalCalendar.ts`

- `fiscalPeriodOfWeek`: drop "GMT rule: … appended to the final period". Say that the 53rd week
  goes to period 1 or 12, as `extraWeek` says.
- `fiscalYearLabel`: document the three rules, the day count, and the tie to the later year,
  in the words of §3.2.

---

## 5. Wiring

- `types/index.ts` already re-exports `./fiscal-calendar`, which now also exports
  `FiscalExtraWeek` and `FiscalYearLabel`.
- `calendar/validate/index.ts`: add the three new validators, in alphabetical order.
- `internal/index.ts`: `export { fiscalPeriodOfWeek, fiscalYearLabel, fiscalYearOf } from "./fiscalCalendar";`
- No new namespace and no new subpath. The `calendar/validate` subpath picks up the validators
  through its barrel.
- `node scripts/api-surface.mjs check` must pass. It runs every `@example` in §4.

---

## 6. Test matrix

Every expected value below came from running the reference implementation. Rows under §6.1 cite
the published value they reproduce in the row name.

Shorthand used in the tables:

```ts
const NRF = { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" } as const;
const ONS = { pattern: "4-4-5", yearEndsOn: "2022-12-31", extraWeek: "firstPeriod", yearLabel: "majorityYear" } as const;
const J   = { pattern: "4-4-5", yearEndsOn: "2021-06-27", extraWeek: "lastPeriod", yearLabel: "endYear" } as const; // a late-June year end, no published source
```

### 6.1 Published years (NRF and ONS)

**NRF (US), fiscal 2023 (53 weeks) and 2017.** Sources: NRF FAQ ("January 29 – February 4,
2017" is week 1 of 2017, not restated) and the NRF 2023–2025 PDF (week 53 = 2024-01-28 to
2024-02-03). **Verified.**

| value        | expected                                | published fact                      |
| ------------ | --------------------------------------- | ----------------------------------- |
| `2017-01-29` | `{ year: 2017, period: 1, week: 1 }`    | 2017 week 1 opens January 29        |
| `2023-01-29` | `{ year: 2023, period: 1, week: 1 }`    | fiscal 2023 opens                   |
| `2024-01-27` | `{ year: 2023, period: 12, week: 52 }`  |                                     |
| `2024-01-28` | `{ year: 2023, period: 12, week: 53 }`  | week 53 opens, in January (period 12) |
| `2024-02-03` | `{ year: 2023, period: 12, week: 53 }`  | week 53 closes                      |
| `2024-02-04` | `{ year: 2024, period: 1, week: 1 }`    | fiscal 2024 opens                   |

**ONS (UK), 2025 (53 weeks).** Source: `tradingperiods2026.xlsx`, sheet "Trading Periods for
2025": January 2024-12-29 to 2025-02-01 (5 weeks), February 2025-02-02 to 2025-03-01, March
2025-03-02 to 2025-04-05, December ends 2026-01-03; sheet 2026 opens 2026-01-04. **Verified.**

| value        | expected                               | published fact                          |
| ------------ | -------------------------------------- | --------------------------------------- |
| `2024-12-29` | `{ year: 2025, period: 1, week: 1 }`   | 2025 opens in 2024; labelled 2025       |
| `2025-02-01` | `{ year: 2025, period: 1, week: 5 }`   | the five-week January ends              |
| `2025-02-02` | `{ year: 2025, period: 2, week: 6 }`   | February opens                          |
| `2025-03-01` | `{ year: 2025, period: 2, week: 9 }`   | February ends (4 weeks)                 |
| `2025-03-02` | `{ year: 2025, period: 3, week: 10 }`  | March opens                             |
| `2025-04-05` | `{ year: 2025, period: 3, week: 14 }`  | March ends (5 weeks); Q1 = 14 weeks     |
| `2026-01-03` | `{ year: 2025, period: 12, week: 53 }` | 2025 ends in 2026; still labelled 2025  |
| `2026-01-04` | `{ year: 2026, period: 1, week: 1 }`   | 2026 opens                              |

The same `ONS` calendar reproduces the start, end and weeks per period of every ONS sheet from
2004 to 2026, and 35 of the 41 sheets from 1986 to 2026. The other six (1991, 1992, 1996, 1997,
2002, 2003) are years where 31 December fell on a Tuesday. In those years ONS ended the year on
the Saturday four days later, not the Saturday three days earlier. That is a different
year-end rule, used before 2004. A caller covering those years states it as a second
`FiscalCalendar`. Tests cover 2025 only. The full scan is evidence for this spec, not a test.

**ONS (UK), 2020 (53 weeks).** Source: the same workbook, sheet "Trading Periods for 2020":
January 2019-12-29 to 2020-02-01 (5 weeks); sheet 2019 ends 2019-12-28; sheet 2021 opens
2021-01-03. **Verified.** A second ONS year, so the majority label is pinned for a year that
starts in December and ends in January.

| value        | expected                               | published fact                          |
| ------------ | -------------------------------------- | --------------------------------------- |
| `2019-12-28` | `{ year: 2019, period: 12, week: 52 }` | 2019 ends                               |
| `2019-12-29` | `{ year: 2020, period: 1, week: 1 }`   | 2020 opens in 2019; labelled 2020       |
| `2020-02-01` | `{ year: 2020, period: 1, week: 5 }`   | the five-week January ends              |
| `2020-02-02` | `{ year: 2020, period: 2, week: 6 }`   | February opens                          |
| `2021-01-02` | `{ year: 2020, period: 12, week: 53 }` | 2020 ends in 2021; still labelled 2020  |
| `2021-01-03` | `{ year: 2021, period: 1, week: 1 }`   | 2021 opens                              |

### 6.2 `extraWeek` placement (53-week year: NRF fiscal 2023, `4-5-4`)

| value        | `extraWeek`     | expected                               | note                                |
| ------------ | --------------- | -------------------------------------- | ----------------------------------- |
| `2023-02-25` | `"firstPeriod"` | `{ year: 2023, period: 1, week: 4 }`   |                                     |
| `2023-02-26` | `"firstPeriod"` | `{ year: 2023, period: 1, week: 5 }`   | period 1 is 5 weeks                 |
| `2023-03-04` | `"firstPeriod"` | `{ year: 2023, period: 1, week: 5 }`   |                                     |
| `2023-03-05` | `"firstPeriod"` | `{ year: 2023, period: 2, week: 6 }`   |                                     |
| `2023-02-26` | `"lastPeriod"`  | `{ year: 2023, period: 2, week: 5 }`   | same week, period 2                 |
| `2024-01-28` | `"firstPeriod"` | `{ year: 2023, period: 12, week: 53 }` | week 53 is in period 12 either way  |
| `2025-02-01` | ONS, `"lastPeriod"` | `{ year: 2025, period: 2, week: 5 }` | ONS week 5 moves to February        |
| `2026-01-03` | ONS, `"lastPeriod"` | `{ year: 2025, period: 12, week: 53 }` |                                   |
| `2024-06-15` | NRF (52 weeks), each value | `{ year: 2024, period: 5, week: 19 }` | no effect in a 52-week year |

`internal/fiscalCalendar.test.ts`: extend the existing whole-year walk to run each pattern under
both values. Assert that the 53-week walk gives the shapes listed in §3.1, and that the 52-week
walk is identical under both values.

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
rule does not change how many year ends are affected, so the IAS 1 ¶51(c) reasoning decides it.
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

## 7. TDD slices

Each slice is red → green → refactor, and the suite stays green between slices.

1. **Types and validators.** Add `FiscalExtraWeek` and `FiscalYearLabel`, then
   `isValidFiscalExtraWeek`, `isValidFiscalYearLabel` and `isValidFiscalCalendar` (§6.6). Do
   not change `FiscalCalendar` yet. Write `isValidFiscalCalendar` against an inline type until
   slice 3, so this slice compiles alone.
2. **Internal.** `fiscalYearLabel` (§3.2), tested directly: the start, end and majority
   values for ONS 2025, ONS 2020, NRF 2023, the `J` year (2023-06-26 to 2024-06-30) and the
   tie year. Then `gregorianCycleShift` (§6.7). Then `fiscalPeriodOfWeek` gains `extraWeek` (§3.1, §6.2 internal walk). Update its current call site to pass
   `"lastPeriod"`, which keeps behaviour unchanged.
3. **`getFiscalPeriod`.** Make both fields required on `FiscalCalendar`. Validate with
   `isValidFiscalCalendar`, then wire the label and the placement. Add
   `extraWeek: "lastPeriod", yearLabel: "startYear"` to every existing test row; their
   expectations do not change. Then add §6.1, §6.2, §6.3 and the `getFiscalPeriod` rows of
   §6.5. Replace the JSDoc (§4.2).
4. **`getQuarter`.** Make both option fields required and route through `fiscalYearLabel`. Add
   `yearLabel: "startYear"` to every existing test that passes options; their expectations do
   not change, except the "default stated" and `{}` rows, which now expect `null`. Then add
   §6.4 and the `getQuarter` rows of §6.5. Replace the JSDoc (§4.3).
5. **Surface.** Barrels (§5), the `isValidFiscalPattern` JSDoc edits (§4.4), the
   `internal/fiscalCalendar.ts` JSDoc (§4.5). Run `node scripts/api-surface.mjs check`,
   `pnpm --filter @northguild/gmt test`, the type check and lint.
6. **Docs and release (finalizer, plus dox-architect for §9.1).** Everything in §8 and §9.

Slices 1–5 belong to tdd-dev, and tester audits them after slice 5. Slice 6 belongs to the
finalizer, except the Dox page, which goes to dox-architect.

---

## 8. Breaking change inventory

### 8.1 What breaks

| Call that compiled in 1.19                                            | 1.20 result               | Migration                                                                  |
| --------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------- |
| `getFiscalPeriod(v, { pattern, yearEndsOn })`                          | type error; `null` at run time | add `extraWeek: "lastPeriod", yearLabel: "startYear"` for identical results |
| `getQuarter(v, { fiscalYearStartMonth: m })`                           | type error; `null`        | add `yearLabel: "startYear"` for identical results                         |
| `getQuarter(v, {})`                                                    | type error; `null`        | drop the options for calendar quarters                                     |
| `fiscalPeriodOfWeek(week, weeks, pattern)` (internal)                  | type error                | pass `"lastPeriod"`                                                        |

The migration column reproduces 1.19 exactly. A caller who used 1.19's advice ("add one" to get
an end-year label) should switch to `yearLabel: "endYear"` and remove the `+ 1`.

### 8.2 Call sites, examples and skills that must change

Source and tests (slices 2–5):

- `packages/gmt/src/types/fiscal-calendar.ts`: the interface, two new types, NRF wording.
- `packages/gmt/src/internal/fiscalCalendar.ts`: `fiscalPeriodOfWeek` signature and JSDoc;
  new `fiscalYearLabel`.
- `packages/gmt/src/internal/index.ts`: export line.
- `packages/gmt/src/internal/fiscalCalendar.test.ts`: `fiscalPeriodOfWeek` calls at lines 170,
  186, 190, 203 and 218.
- `packages/gmt/src/calendar/calculate/getFiscalPeriod.ts`: body, return-field JSDoc, all 7
  `@example` lines.
- `packages/gmt/src/calendar/calculate/getFiscalPeriod.test.ts`: the `nrf` fixture and the
  inline calendars at lines 76, 90, 105, 118, 131, 145, 165, 190, 217, 239 and 255.
- `packages/gmt/src/calendar/calculate/getQuarter.ts`: options type, body, JSDoc, all 8
  `@example` lines (the `{ fiscalYearStartMonth: 1 }` "the default, stated" example is removed).
- `packages/gmt/src/calendar/calculate/getQuarter.test.ts`: calls at lines 26, 47, 68, 81, 91
  and 112.
- `packages/gmt/src/calendar/validate/isValidFiscalPattern.ts`: one bullet and one example note.
- `packages/gmt/src/calendar/validate/index.ts`: three exports.
- No change: `calendar/validate/isValidZoneBucketUnit.ts` line 14,
  `types/zone-bucket-unit.ts` lines 6–7 and `calendar/calculate/floorToZone.test.ts` line 266.
  They name the functions in prose only.

Skills (finalizer, via `/tanstack-intent`):

- `packages/gmt/skills/gmt-basics/SKILL.md` lines 165–169: replace "GMT rule: `year` is the
  calendar year a fiscal year starts in; add one if you label by the year it ends in" with the
  two required fields and their values. Fix the NRF quote. Add `isValidFiscalCalendar` where
  line 81 lists the identifier functions, if validators are listed there.
- `packages/gmt/skills/_artifacts/domain_map.yaml` lines 100–101 and 119: add the three
  validators beside `getFiscalPeriod`. Line 36 does not change.
- `packages/gmt/skills/contributor/new-method-implementation/SKILL.md`: no change. It names
  `getQuarterForDate` and others as naming examples only.

### 8.3 Changeset (finalizer)

`minor`. Lead sentence: `getFiscalPeriod` and `getQuarter` now take the 53rd-week placement and
the year label from the caller. Breaking changes: the table in §8.1, with one before and after
pair each:

```ts
// 1.19
getFiscalPeriod("2024-01-28", { pattern: "4-5-4", yearEndsOn: "2026-01-31" }); // { year: 2023, period: 12, week: 53 }
// 1.20, the same result
getFiscalPeriod("2024-01-28", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }); // { year: 2023, period: 12, week: 53 }

// 1.19
getQuarter("2024-03-31", { fiscalYearStartMonth: 4 }); // { year: 2023, quarter: 4 }
// 1.20, the same result
getQuarter("2024-03-31", { fiscalYearStartMonth: 4, yearLabel: "startYear" }); // { year: 2023, quarter: 4 }
```

Also exported: `FiscalExtraWeek`, `FiscalYearLabel`, `isValidFiscalExtraWeek`,
`isValidFiscalYearLabel`, `isValidFiscalCalendar`. The changeset must not cite a statute or a
government fiscal year (GMT tracks no law).

---

## 9. Doc impact

### 9.1 For dox-architect (apps/dox)

| Page / tool                                                                                  | What changes                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/dox/src/content/docs/guides/zoned-date-operations/calendar-boundaries.mdx` lines 20–42 | The `getQuarter` call (line 28) needs `yearLabel`. The `nrf` const (line 31) needs both fields. The comment "stated as its published rule: 'the Saturday nearest to January 31'" is not NRF's wording: quote "four or more days left in January". Lines 37–38 ("lands in the final period") become "lands in the period `extraWeek` names". Add a short paragraph and one `ONS`-style example showing that published calendars disagree on both choices, which is why the fields are required. Name the peers by country. No law, no statute. |
| same page, lines 107–114                                                                      | Add `isValidFiscalCalendar` beside `isValidFiscalPattern`. Change the `"4-5-5"` comment to "a 53-week year's last quarter under `lastPeriod`".                                                                                                                                                 |
| `apps/dox/src/content/docs/reference/calendar/calculate/getFiscalPeriod.mdx`                 | Generated from JSDoc. Regenerate it.                                                                                                                                                                                                                                                             |
| `apps/dox/src/content/docs/reference/calendar/calculate/getQuarter.mdx`                      | Generated. Regenerate it.                                                                                                                                                                                                                                                                        |
| `apps/dox/src/content/docs/reference/calendar/validate/isValidFiscalPattern.mdx`             | Generated. Regenerate it.                                                                                                                                                                                                                                                                        |
| new: `reference/calendar/validate/isValidFiscalExtraWeek.mdx`, `isValidFiscalYearLabel.mdx`, `isValidFiscalCalendar.mdx` | Generated by the reference build.                                                                                                                                                                                                                           |
| `reference/types/…/FiscalPattern.mdx` and new `FiscalExtraWeek` / `FiscalYearLabel` type pages | Generated.                                                                                                                                                                                                                                                                                        |
| `apps/dox/src/generated/reference/gmt-corpus.json`, `route-manifest.ts`                      | Regenerated by the reference build. The playground is seeded from the corpus examples, so it picks up the new examples.                                                                                                                                                                         |
| Dox tools and chat starters                                                                   | None exist for fiscal periods, and this spec proposes none. The Dox chat grounding reads the corpus, so it updates with the regeneration.                                                                                                                                                       |

Remember that `pnpm dox:dev` reads `packages/gmt/dist`. Build once, at the end, and warn the
owner first.

### 9.2 Context files (finalizer)

- `context/domination/issues/CORE-5.md` lines 18–20 (signatures) and the decisions at lines 106–131: add a
  `## Corrections` entry. It says that the 53rd-week placement and the year label are now
  required caller parameters, cites IAS 1 ¶37 and ¶51(c) and the two peers (NRF, ONS), and records the GMT rules for
  the day-count majority and the tie. Leave the original decision text standing; the
  Corrections entry supersedes it. Line 64 ("places the 53rd week correctly for a known NRF
  53-week year") stays true under `"lastPeriod"`.
- `context/coding-standards.md` lines 15 and 261: no change.
- `context/domination/issues/INT-58.md` line 46 and `context/dox/specs/int-58-billing-deadlines.md`
  lines 676 and 745: they describe a tax-regulation citation in the fiscal JSDoc. The current
  `getFiscalPeriod.ts` and `internal/fiscalCalendar.ts` contain none, so the notes are stale.
  The finalizer confirms that and removes them. This spec does not add any.
- The tracker: the owner decides whether this change gets its own story id. If it does, add a
  row with `Blocked by` empty. Otherwise it ships under CORE-5's Corrections.

---

## 10. Findings to report

1. **ONS changed its year-end rule.** The `ONS` calendar reproduces every sheet from 2004 to
   2026, but not 1991, 1992, 1996, 1997, 2002 or 2003. GMT models one rule per calendar, which
   is correct. A caller spanning the change uses two calendars.
2. **NRF no longer publishes "Saturday nearest January 31".** Its page states the 53rd-week
   test as "four or more days left in January". That test is equivalent, and CORE-5 verified it
   against every NRF year from 2017 to 2028. The JSDoc, the skill and the Dox guide quote the
   current wording.
3. **IAS 1 is replaced by IFRS 18 for periods from 2027-01-01.** Where the text of ¶37 and
   ¶51(c) now sits was not reached, and neither was the IFRS Foundation's own IAS 1 text. The
   citations rest on the XRB reproduction. The finalizer re-checks them before release.
