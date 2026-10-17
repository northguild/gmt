# Fiscal calendar spec — validation order and algorithms

Part of [the index](../audit-fiscal-calendar-spec.md).

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

