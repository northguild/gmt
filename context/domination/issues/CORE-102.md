# CORE-102 — Core: Year-month and month-day values, and the `Intl` format guard

**Scope:** Give gmt a month-day value, a month and a day with no year, written `--12-25` (Temporal
`PlainMonthDay`), and a year-month value, a year and a month with no day, written `2026-10`
(Temporal `PlainYearMonth`). For each: validate and parse it from the ISO form, from a pattern with
a locale, and from a date or a date-time; format it with a locale; compare two of them. A month-day
gives the date it falls on in a given year; a year-month adds and subtracts months and years, counts
the months between two, and gives its first and last date and its number of days. Every function
lives in `plain/`, returns the sentinel and never throws. Scope is **parity only**: what
Temporal's two types give, and the functions listed here.

## Gap

A birthday, an anniversary, a fixed holiday or a renewal date has a month and a day and no year.
gmt has no type for it today:

- `isValidDate("--12-25")` returns `false`.
- `parseDateWithPattern("12-25", "MM-dd")` returns `""`: the pattern has no year.
- `parseDateWithPattern("25 décembre", "d MMMM", "fr")` returns `""` for the same reason.

The common workaround is to store the month-day in a fixed year and strip it again, which turns
29 February into 1 March, or into an error, in every year that has no such day.

A card expiry, a billing period, a statement month or a reporting month has a year and a month and
no day. gmt has no type for that either, and the existing date functions keep their contracts:
these three calls still return the sentinel, and the new year-month functions read them.

```text
isValidDate("2026-10")                                   → false (unchanged)
parseDateWithPattern("10/2026", "MM/yyyy")               → ""    (unchanged)
parseDateWithPattern("octobre 2026", "MMMM yyyy", "fr")  → ""    (unchanged)
isValidYearMonth("2026-10")                              → true
parseYearMonthWithPattern("10/2026", "MM/yyyy")          → "2026-10"
parseYearMonthWithPattern("octobre 2026", "MMMM yyyy", "fr") → "2026-10"
```

The common workaround is to append a day (`"2026-10" + "-01"`), which invents a day the producer
never sent and lets day arithmetic leak into month arithmetic.

Related defect, fixed here: `parseDateWithPattern("15 марта 2024", "d MMMM yyyy", "ru")` returns
`""` today. The parser matches only stand-alone month names (`март`), while a Russian date writes the
format-context (genitive) name (`марта`). UTS #35 Part 4 § Parsing Dates and Times asks a parser to
try both.

## Scope

1. **Read.** `isValidMonthDay(value)` and `parseMonthDay(value)` accept `--MM-DD` and `MM-DD`, the
   forms the Temporal grammar reads, and `parseMonthDay` writes the canonical `--MM-DD`.
2. **From a date.** `parseMonthDayFromDate(value)` and `parseMonthDayFromDateTime(value)` return the
   month-day of an ISO date or date-time.
3. **From a pattern.** `parseMonthDayWithPattern(value, pattern, locale?)` reads a month-day through
   the existing pattern tokens, with month names in either context.
4. **Format.** `formatMonthDay(value, locale?, options?)` formats a month-day with `Intl`, taking only
   the month and day fields, and `dateStyle` mapped to month and day.
5. **Compare.** `compareMonthDays(a, b)` returns `-1`, `0` or `1`; `areMonthDaysEqual(a, b)` returns a
   boolean.
6. **Date in a year.** `monthDayToDate(monthDay, year)` returns the ISO date. `--02-29` in a common
   year returns 28 February, by the Temporal `toPlainDate` constrain step; the JSDoc cites it.
7. **Month names in both contexts.** An internal reader returns a locale's format-context and
   stand-alone month names. The pattern parser accepts `L`–`LLLL` (stand-alone) beside `M`–`MMMM`,
   and both match either context when the name is unique, so `parseDateWithPattern` and
   `parseDateTimeWithPattern` read `15 марта 2024`.
8. **Polyfill defect D20.** `ParseTemporalMonthDayString` (0.5.1, `lib/ecmascript.ts`, :641, comparison at :648 (throws at :649)) compares
   the calendar id with `iso8601` before lower-casing it, so `--12-25[u-ca=ISO8601]` throws. A
   `temporalCompat` workaround reads it the way the specification does, until a polyfill release
   carries the fix. Bug record **V** in `js-temporal-polyfill-bugs.md`.
9. **Polyfill defect, record W.** The polyfill accepts `--02-30` and `--04-31`, which the
   IsValidMonthDay early error rejects. gmt's month-day regex encodes that check, so no workaround
   is needed; the record holds the repro for filing.
10. **Polyfill defect, record X.** `toLocaleString` rebuilds its Temporal formats from
    `resolvedOptions()`, so in zh-CN, zh-TW and ja-JP a requested month width comes back numeric.
    gmt never calls `toLocaleString`, so no workaround is needed; the record holds the repro.

### Year-month (spec slices S9–S16)

11. **Read.** `isValidYearMonth(value)` and `parseYearMonth(value)` accept `YYYY-MM` and
    `±YYYYYY-MM` from `-271821-04` to `+275760-09`; `parseYearMonth` writes the canonical form. The
    basic form `202610` and a date string are refused. Public regex `plainYearMonth` in `./regex`.
12. **From a date.** `parseYearMonthFromDate(value)` and `parseYearMonthFromDateTime(value)`.
13. **From a pattern.** `parseYearMonthWithPattern(value, pattern, locale?, options?)`: the existing
    tokens with no day, weekday or time token; `yy` takes `options.yearWindow` as
    `parseDateWithPattern` does; month names in either context (item 7).
14. **Format.** `formatYearMonth(value, locale?, options?)`: year, month and era only, `dateStyle`
    mapped to year and month, the Gregorian rule, and the `Intl` format guard (below).
15. **Compare.** `compareYearMonths(a, b)` returns `-1`, `0`, `1` or `null`; `areYearMonthsEqual(a, b)`.
16. **Arithmetic.** `addYearMonth(value, units)` and `subtractYearMonth(value, units)` take `years`
    and `months` only; `diffYearMonth(a, b, unit)` counts whole `years` or `months`.
17. **Dates and days.** `startOfYearMonth`, `endOfYearMonth`, `getDaysInYearMonth`.
18. **D20 widened.** `ParseTemporalYearMonthString` (0.5.1, `lib/ecmascript.ts:619`, comparison at
    :629, throw at :630) has the month-day defect of item 8, so `2026-10[u-ca=ISO8601]` throws on the
    polyfill and parses on native Temporal. The same tc39 commit (`385b479bf8`) fixes both, so D20
    stays one defect with two repros, and record **V** is widened to both parsers. The
    `temporalCompat` module becomes `isoCalendarFrom.ts` and the capability
    `isIsoCalendarCaseCompatNeeded`.
19. **Polyfill defect, record Y.** `PlainYearMonth#add` and `#subtract` in 0.5.1 predate tc39
    `41faca474a`: they accept days and weeks, and a subtraction starts from the last day of the
    month (`+275760-09` minus one month throws; `-271821-05` minus one month gives `-271821-04`).
    gmt runs the specification's steps on `PlainDate`, so no workaround is needed; the record holds
    the repro.

### The `Intl` format guard

What it guards: options that ask a formatter for a field its value does not have. `formatYearMonth`
has no day, weekday or time; `formatMonthDay` has no year, weekday or time. Both return `""` for a
`timeStyle`, for options whose only fields are foreign (`{ day: "numeric" }` on a year-month), for a
calendar other than `gregory` or `iso8601`, for invalid options or an ill-formed locale, and for the
`TypeError` or `RangeError` `Intl.DateTimeFormat` raises. Nothing throws. Engines: every one the
library runs on, Node (polyfill 0.5.1) and the browser suite (Chromium, Firefox and WebKit on native
Temporal, plus the polyfill control); the guard calls `Intl` itself, so it is the same on each. Rows:
S5's rules table for month-day (built) and S12's guard table for year-month, one row per refused
option family and one per accepted style. **A foreign field beside an own field is dropped**, as
`formatDate` drops a time field beside a date field (ECMA-402 ~relevant~ fields):
`{ year: "numeric", month: "long", day: "numeric" }` on `2026-10` gives `October 2026`:
`formatDate` parity, candidate (a) in § Decisions.

### Docs site — `apps/dox/src/content/docs/`

- Guide `guides/core-date-operations/month-day-values.mdx`: what a month-day is, the ISO form, reading
  and writing it, comparing, and 29 February in a common year.
- Scenario `scenarios/a-29-february-birthday-in-a-common-year.mdx`.
- Mistakes: `mistakes/parse-date-time.mdx` (a month name in the wrong context; `--02-30`) and
  `mistakes/format-date-time.mdx` (`toLocaleString` throws for an ISO month-day).
- Indexes: `guides/core-date-operations/index.mdx`, `scenarios/index.mdx`.
- Year-month (S16): no new guide page and no Tool. Pointer lines in `parsing.mdx`,
  `formatting.mdx`, `comparisons.mdx`, `validation.mdx` and `plain-arithmetic.mdx`; one mistake each
  in `mistakes/parse-date-time.mdx` (a year-month through `parseDateWithPattern`) and
  `mistakes/format-date-time.mdx` (`toLocaleString` throws for an ISO year-month). The reference
  pages come from the JSDoc.

## Tool

Left to `dox-architect`.

## Design notes

[Design notes](CORE-102/design-notes.md): the `--MM-DD` and `YYYY-MM` output forms, refused basic forms, no invented year or day, 29 February, the Gregorian formatting rule, `dateStyle` widths per ECMA-402, why the tests have no `toLocaleString` oracle, year-month arithmetic after tc39 `41faca474a`, and the authority each rule rests on.

## What gmt provides (do not re-implement)

- `internal/patternToken.ts`: the pattern compiler and `parseValueWithPattern`
- `plain/locale/getLocaleMonthNames.ts` and `internal/resolveLocale.ts`
- `internal/formatterCache.ts`, `internal/plainFormatOptions.ts` and
  `internal/readDateTimeFormatOptions.ts`
- `internal/inputChecks.ts` (`isDateString`, `plainDateTimeOf`, `plainMonthDayOf`) and
  `internal/isoStringBody.ts`
- `internal/readDurationUnits.ts`, `internal/resolveDurationUnit.ts`, `internal/isObject.ts` (`isOptionsArgument`)
  and `internal/yearWindowStart.ts`
- `internal/temporalCompat/monthDayFrom.ts` (D20 for month-day; renamed and widened here)
- `internal/temporalCompat/`: the workaround registry, probes and README
- `src/test/localeMatrix.ts` (`MustTestLocales`) and `src/test/icuVariants.ts`

## Verification

[Verification](CORE-102/verification.md): the definition-of-done rows for every month-day and year-month function, the unchanged `isValidDate` and `parseDateWithPattern` contracts, D20, the 17-locale pattern rows and a green `pnpm run validate`.

## Decisions

**What the `Intl` format guard does with a foreign field beside an own field:**
**(a) `formatDate` parity** (ECMA-402 ~relevant~). The foreign field is
dropped (`October 2026`); options whose only fields are foreign give `""`. `formatMonthDay` already
did this, so its S5 rows stand. The candidates not chosen were (b) strict, any foreign field gives
`""` (a GMT rule that departs from `formatDate`); (c) the calendar check alone, which every
candidate keeps; and (d) leaving the guard out of CORE-102.


**Year arguments are integers.** `monthDayToDate(monthDay, year)` refuses a fractional or string
year and returns `""`. Temporal truncates (`2024.9` becomes 2024), which would give a real-looking
date for the wrong year; `easterSunday` sets the precedent.

**29 February in a common year is 28 February.** Temporal's constrain rule, with no option to change
it. A "1 March" policy is the caller's, built from `isValidDate` and `addDate`; the Leap-Day
Birthday tool shows it as such.

**No `toLocaleString` oracle.** The `dateStyle` widths are gmt's mapping (polyfill 0.5.1's), the
same in every engine, and the exact-row tests over 17 locales are the authority.

**Dox (D1, Leap-Day Birthday tool).** The decisions of its spec are recorded in
[built.md](../../dox/built.md) under the "Leap-Day Birthday" bullet: the 1 March column is the
caller's policy and never a gmt mode; input is `--MM-DD` or `MM-DD` and output always `--MM-DD`; the
widget draws library results and computes none; the Converter Bench gains a `plainMonthDay` chip,
which is expected and not a regression.

## Bundle size

The root entry grew from 556,200 B (budget) to 560,651 B minified with the 23 new functions and the
two regexes. The root budget in `scripts/bundle-size.budgets.json` is raised to 566,300 B (size + 1%,
the `--update` rule, applied to the root alone). Every other entry is unchanged and passes; the
per-function entries do not contain the new code.
