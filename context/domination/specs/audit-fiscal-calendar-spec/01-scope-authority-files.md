# Fiscal calendar spec — scope, authority, files and signatures

Part of [the index](../audit-fiscal-calendar-spec.md).

## What changes

Two facts about a 52/53-week calendar are currently GMT rules, and GMT picked one answer for
each:

1. **Where the 53rd week goes.** Today it is always appended to period 12.
2. **Which calendar year labels the fiscal year.** Today it is always the year the fiscal year
   starts in. `getQuarter` uses the same rule for month-based fiscal years.

No international standard settles either question. The two published calendars below, from two
countries, disagree on both, and IFRS 18 ¶27(c) (formerly IAS 1 ¶51(c)) names a third label, the
year the period ends in. So both become **required, named fields** that the caller states. GMT
keeps no default, because any default would match one source and silently mislabel the others.

| Source                                     | 53rd week goes in                         | Year labelled by                                                        |
| ------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------- |
| NRF 4-5-4 calendar (US trade body; peer)   | the last period ("end of the calendar")   | start year (fiscal 2023 = 2023-01-29 to 2024-02-03)                     |
| ONS trading periods (UK statistics office; peer) | the first period ("a five week January") | the calendar year holding most of it (2025 = 2024-12-29 to 2026-01-03) |
| IFRS 18 ¶27(c) (formerly IAS 1 ¶51(c); IASB; international) | —                                         | a reporting period is identified by the date it ends, so `"endYear"`     |

ONS is the evidence that the majority rule is needed. Its label is neither the start year nor
the end year: 2024-12-29 to 2026-01-03 is "2025". Of the three rules, only the majority rule
gives that label.

---

## 0. Authority — what each rule rests on

International body first (IASB: IFRS 18, formerly IAS 1). The two national sources, NRF (US) and
ONS (UK), are labelled peers. Neither is an authority for GMT; each is cited only to show that
callers disagree. Company calendars are not used as sources.

| Rule                                                                                         | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A reporting period of 52 weeks (so also 53) is permitted                                     | **IFRS 18 ¶29 (formerly IAS 1 ¶37)** (IASB): "Normally, an entity consistently prepares financial statements for a one-year period. However, for practical reasons, some entities prefer to report, for example, for a 52-week period. This Standard does not preclude this practice." Text read from the XRB's reproduction, NZ IAS 1 (Diff Rep), issued November 2012. The IASB's IFRS 18 reference material maps ¶37 to IFRS 18 ¶29 with the wording unchanged. |
| A fiscal year is identified by the date its reporting period ends                            | **IFRS 18 ¶27(c) (formerly IAS 1 ¶51(c))**: an entity shall disclose prominently (IAS 1: "display") "the date of the end of the reporting period or the period covered by the set of financial statements or notes". Same sources as above; the wording of item (c) is unchanged. It is the reason the `"endYear"` option exists, and the reason for the tie rule below. It does not require any one year label. |
| IFRS 18 replaces IAS 1                                                                       | IFRS 18, *Presentation and Disclosure in Financial Statements* (IASB, 2024), replaces IAS 1 for reporting periods beginning on or after 2027-01-01. Its table of concordance maps IAS 1 ¶37 to IFRS 18 ¶29 and IAS 1 ¶51(c) to IFRS 18 ¶27(c), both in IFRS 18 itself ([IFRS 18 reference material](https://www.ifrs.org/content/dam/ifrs/project/primary-financial-statements/ifrs-standard/reference-material-for-ifrs18.pdf)). GMT cites "IFRS 18 ¶29 (formerly IAS 1 ¶37)" and "IFRS 18 ¶27(c) (formerly IAS 1 ¶51(c))". |
| No international standard fixes the period pattern, the 53rd-week placement or the year label | IFRS 18 ¶29 (formerly IAS 1 ¶37) does not preclude the 52-week period and says nothing more. IAS 34 (interim reporting) does not define 4-4-5 shapes either. So all three are caller-stated parameters. Pattern and year end already were; this spec adds the other two. |
| 53rd week in the **last** period — peer (US)                                                  | NRF, _4-5-4 Calendar_ FAQ (nrf.com/resources/4-5-4-calendar, datePublished 2026-02-04): "it is sometimes necessary to add a 53rd week to the end of the calendar"; the test for it: "If, after laying out the entire 52-week calendar for any given year, there are four or more days left in January during the 53rd week, then a 53rd week is added." NRF 2023–2025 calendar PDF: "Fiscal Year 2023 is a 53 week year", with week 53 = 2024-01-28 to 2024-02-03. |
| 53rd week in the **first** period — peer (UK)                                                 | ONS, _Retail sales index reporting periods_, `tradingperiods2026.xlsx` (published 21 November 2025), Note 2: "Typically reporting periods follow a four-week four-week five-week reporting cycle. With 365 days in a year this shifts the periods back by one day annually (two on a leap year). To offset this shift a five week January is introduced every five to six years." Sheet "Trading Periods for 2025": weeks 5,4,5,4,4,5,4,4,5,4,4,5, from 2024-12-29 to 2026-01-03. |
| Label = calendar year holding the most of the fiscal year — peer (UK)                        | ONS sheet titles ("Trading Periods for 2025" = 2024-12-29 to 2026-01-03; "Trading Periods for 2020" = 2019-12-29 to 2021-01-02). ONS does not publish the rule in words. It is the only one of the three rules that reproduces these titles (§6.1). |
| Label = end year                                                                             | **IFRS 18 ¶27(c) (formerly IAS 1 ¶51(c))**, above: a reporting period is identified by the date it ends. |
| Majority is measured in **days**                                                             | **GMT rule.** The fiscal year and the calendar year share no unit except the day. Months have unequal lengths, and a week can straddle 1 January. |
| An even split goes to the **end** year                                                       | **GMT rule.** No peer publishes a tie rule. IFRS 18 ¶27(c) (formerly IAS 1 ¶51(c)) identifies a reporting period by its end date, so the year that holds the end date wins. Ties occur only in 364-day years that split 182/182, and only for year ends from 29 June to 4 July (§6.3). No month-based fiscal year can tie (§3.3). |
| Both fields are required; there is no default                                                 | **GMT rule.** NRF and ONS disagree on both choices, and IFRS 18 ¶27(c) (formerly IAS 1 ¶51(c)) supports a third label. A default would match one and mislabel the rest without warning ([no catch-all functions](../../../coding-standards.md#api-contract): every call the types accept returns a correct value). |
| A missing or unrecognised field returns the sentinel                                          | [coding-standards § API Contract](../../../coding-standards.md#api-contract): `null` for an object return, `false` for a boolean validator. |
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

