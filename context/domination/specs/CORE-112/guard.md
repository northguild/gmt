# CORE-112 slice 1 — the guard: verdict, proof, cache, hook

Read with [index.md](./index.md). New module `packages/gmt/src/internal/weekYearGuard.ts`. It is the
only place in `src` that knows about `Y`; deleting it (and its hook line) retires the workaround.

## Signature

```ts
/**
 * The formatter itself when its pattern cannot print a week-of-year year (defect D23), else a
 * formatter whose year is the calendar year and whose parts never reach the engine's `Y` field.
 */
export function guardDateTimeFormat(
  formatter: Intl.DateTimeFormat,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat;
```

Called once per construction, from `formatterCache.ts` `construct` only:

```ts
case "DateTimeFormat":
  return guardDateTimeFormat(new Intl.DateTimeFormat(locale, options), options);
```

`construct` runs for cached and uncacheable keys alike, so both paths are guarded.

## Step 0 — does the formatter print a year? (zero cost when not)

Dormant, with no further call, unless one of these holds (ECMA-402 CreateDateTimeFormat, the
`needDefaults` step with required ~any~ and defaults ~date~: `era` is not one of the fields it
checks, so `{ era }` alone gets year, month and day):

- `options.year !== undefined`;
- `options.dateStyle !== undefined`;
- none of `weekday`, `year`, `month`, `day`, `dayPeriod`, `hour`, `minute`, `second`,
  `fractionalSecondDigits`, `dateStyle`, `timeStyle` is present (the defaults add a year).

Time-only, month-day and weekday formatters stop here. Their single patterns never held `Y` in the
validation (0 of 317,760 aborts outside this gate); their *range* patterns can, which is why no
range parts call is made anywhere ([range.md](./range.md)).

## Step 1 — the verdict cache

Key: `${ro.locale}|${ro.calendar}|${ro.numberingSystem}|${ro.hourCycle ?? ""}|` plus the options'
plain entries minus `timeZone`, `locale`-free (reuse `plainOptionEntries` from `formatterCache.ts`).
The zone is left out on purpose: a zone moves the instant, never the pattern. The key uses the
resolved locale, so a default-locale formatter (uncacheable in `formatterCache`) still reuses its
verdict. Bounded at `MAX_ENTRIES_PER_KIND` (clear when full) and cleared with the formatter cache
when `Intl.DateTimeFormat` is replaced (`forgetIfReplaced`). The verdict value holds the
*analysis* (below), so slice 2 never recomputes it.

## Step 2 — crash signal (unfixed V8 only, exact)

```text
crashes = options.dateStyle === undefined
       && ro.year === undefined
       && ro.calendar !== "chinese" && ro.calendar !== "dangi"
```

Why exact: unfixed V8's `BuildPatternItems` has no entry for `Y`, so a pattern with `Y` resolves
without `year`; the fix (`0426b0d1045d`) adds `Y` and `YY` there in the same commit that maps
`UDAT_YEAR_WOY_FIELD`. A step-0 formatter without
`dateStyle` always has a year field in its pattern (the request or the defaults put one there), so
a missing `year` means a letter V8 does not list: `Y`, or `r`/`U` in the two cyclic calendars,
which V8 handles in parts and which never abort. Fixed V8, SpiderMonkey and JavaScriptCore report
`year` for `Y`, so the signal never fires there. Measured: 81/81 component-option aborts, FP 0,
FN 0 over 233,024 cases. It is blind to `dateStyle` (resolvedOptions has no field members then):
24 of the 105 aborts are `dateStyle` and step 3 finds them.

## Step 3 — text verdict (every engine; the data defect)

Calls only `format`, on the formatter or a twin. Prototype:
`<scratchpad>/woy/detector6.mjs` (`verdict`), `detector.mjs` (`digitRuns`).

1. **Twin.** When the options carry a time field (`hour`, `minute`, `second`,
   `fractionalSecondDigits`, `dayPeriod`, `timeZoneName`, `timeStyle`) or `ro.timeZone` is not
   `UTC`, build `new Intl.DateTimeFormat(ro.locale, { calendar, numberingSystem, timeZone: "UTC",
   ...the options' era, year, month, day, weekday, dateStyle })` directly (not through the cache:
   no recursion). Else use the formatter. The twin keeps the date pattern and drops digit runs
   that would move with the time.
2. **Reference.** Per `calendar|numberingSystem`, cached: `new Intl.DateTimeFormat("und",
   { calendar, numberingSystem, year: "numeric", timeZone: "UTC" })`, and the digit set
   `new Intl.NumberFormat("und", { numberingSystem, useGrouping: false }).format(1234567890)`
   plus `\p{Nd}`. Its single digit run at a date is the calendar's year as ICU counts it.
3. **Digit runs** of a text: maximal runs of those digits, walked by code point (Chakma, Adlam
   and other digits lie outside the BMP).
4. **Year runs `J`.** `y0` = the calendar year of 2024-07-01 (Temporal `withCalendar(cal).year`).
   `m0` = month 1 day 15 of `y0`; `b` = `m0 + 7 days`; `c` = month 1 day 15 of the first year in
   `y0+1 … y0+14` whose weekday equals `m0`'s. A run index is in `J` when its text is equal at
   `m0` and `b` and different at `c`. Equal weekdays keep a weekday name with digits ("J4" in luy)
   out of `J`. Different run counts at the three dates → `clean` (shape); `J` empty → `clean`.
5. **Boundaries.** For `y` in `y0+1 … y0+3`: `d1` = the reference's first day of `y` (start at
   Temporal month 1 day 1, step at most 4 days until the reference year changes between `d1 - 1`
   and `d1`); `L = d1 - 1 day`. Check `d1` against `d1 + 14 days` and `L` against `L - 14 days`.
6. **Check.** Every `J` run's text at the boundary date must equal its text at the inside date,
   *unless* the inside text holds the reference year in full or as its last two digits and is
   longer than that (a year glued to another number): then the boundary run must contain the
   boundary date's reference year in the same form. Any failure → `flagged` (with that date).

Cost: about 27 `format` calls, 0.18 ms per new key on Node 26.12.1 (owner question 6 in
[index.md](./index.md)).

### Proof sketch — every `Y` year run fails step 6, no `y` run does

- *No false flag.* A `y` run is the calendar year, constant from `d1` to `d1 + 14` and from
  `L - 14` to `L`, because `d1` is the reference's own year start (same ICU calendar). The glued
  case compares the year inside the run with the reference year at the same date. So a `y`
  pattern never fails.
- *Every `Y` is found.* UTS #35 defines `Y` by weeks: week 1 is the first week (starting on the
  locale's first day `F`) with at least `minDays` days in the year. The week holding the year
  boundary is given wholly to one year, so `Y ≠ y` at `L` or at `d1` unless the year starts on
  `F` (UTS #35 Part 4 §8, `Y` and `w`). That week lies within 6 days of the boundary, so the
  points 14 days inside are outside it and print `y`; the boundary run therefore differs from the
  inside run. Of three consecutive year starts, at most two share a weekday: Gregorian-length
  years move it 1 or 2 days; a Hebrew year of 385 days moves it 0, but leap years are never
  adjacent in the 19-year cycle. So at least one of the three years fails.
- *Buddhist, Japanese, ROC.* ICU prints the Gregorian week-year there all year. Their years start
  on 1 January as the Gregorian year does, so the same straddling week makes the run jump at `L`
  or `d1`; the argument above holds with the Gregorian week-year in place of `Y`.
- *What the proof leaves out*, closed by measurement: a pattern whose digit-run count changes
  between the three dates of step 4 (returns `clean`). 0 cases in 317,760; the data canary fails
  on any (slice 5).

## Step 4 — what the guard returns

| Crash signal | Text verdict | Returns |
| --- | --- | --- |
| off | clean | the native formatter, unchanged (dormant) |
| any | flagged | a guarded formatter ([single-repair.md](./single-repair.md)) |
| on | clean | a guarded formatter whose `format` and `formatRange` are native and whose parts are synthesised (not seen in the population; the guard still never lets parts reach a `Y` field) |

The guarded formatter is a plain object built once per verdict, typed `Intl.DateTimeFormat`:
`format`, `formatToParts`, `formatRange` and `resolvedOptions` as in slice 2;
`formatRangeToParts` throws `TypeError` (no library code calls it, slice 4's source test).
`resolvedOptions()` returns the native object, and for component options without `year` adds
`year: "numeric"` or `"2-digit"` from the run style, since ECMA-402 resolvedOptions reports the
pattern's year field and GMT now prints one in that form.

## Edge cases for tests (values in [tests.md](./tests.md))

- A step-0 miss calls neither `resolvedOptions` nor `format` (spy on a stub constructor).
- `gd { year: "numeric", month: "short" }`, `gl-u-ca-hebrew { dateStyle: "full" }`,
  `te-u-ca-buddhist { year: "numeric", month: "long" }`: flagged on every engine.
- `en`, `de`, `ja-u-ca-japanese` with the same options: dormant (`===` the native formatter).
- `zh-u-ca-chinese { year: "numeric", month: "long" }`: crash signal off despite no `year`.
- `{ era: "short" }` alone in `de-CH`: step 0 passes (defaults), verdict runs and is clean
  (0 of 1,986 era-only Gregorian formatters flagged).
- A default-locale formatter twice: one verdict (spy on the reference constructor).
- Replacing `Intl.DateTimeFormat` clears verdicts.
