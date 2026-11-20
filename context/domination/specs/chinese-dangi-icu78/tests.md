# Phase 1 — D33 tests: sentinel rows, moved rows, the check test

Read with [index.md](index.md), [gate.md](gate.md) and [probes.md](probes.md). Tests assert the
sentinel, never an error message. Every row holds on every host and every Node: that is the point
of the phase. Run on Node 22, 24 and 26 and in WebKit and Chromium before hand-off.

## 1. `packages/gmt/src/test/lunisolarRefused.test.ts` (new)

Holds the public D33 rows and the D33 check test ([canary.md](canary.md) § a). Imports the public
functions from their own files, as other `src/test/` files do.

### Sentinel rows: every format that prints a date field

`it.each` over calendar × locale form × function. Calendars: `chinese`, `dangi`. Locale forms:
`en-u-ca-<cal>`, `zh-u-ca-chinese` / `ko-u-ca-dangi`, and `"en"` with `{ calendar: <cal> }`.
Dates: `2027-02-06` (the date hosts disagree on) and `2024-07-10` (one they agree on: the refusal
is not per date).

| Function | Call | Expected |
| --- | --- | --- |
| `formatDate` | `(d, locale)`, `(d, locale, {dateStyle:"full"})`, `(d, locale, {year:"numeric"})`, `(d, locale, {month:"long"})`, `(d, locale, {day:"numeric"})`, `(d, locale, {era:"short"})` | `""` |
| `formatDateToParts` | `(d, locale)`, `(d, locale, {year:"2-digit"})` | `[]` |
| `formatDateTime`, `formatDateTimeToParts` | `(d + "T10:00", locale)` | `""` / `[]` |
| `formatCalendar` | `(d, locale)` | `""` |
| `formatDateRange` | `("2027-02-05", "2027-02-07", locale)` | `""` |
| `formatDateTimeRange` | `("2027-02-05T10:00", "2027-02-07T10:00", locale)` | `""` |
| `formatRelativeDate`, `formatRelativeDateTime`, `formatSqlDateTime` | each one's date-printing form (`tdd-dev` reads each signature) | `""` |
| `formatZonedDateTime`, `formatZonedToParts`, `formatCalendarZoned` | `"2027-02-06T10:00:00+08:00[Asia/Shanghai]"` | `""` / `[]` |
| `formatZonedRange` | Shanghai 2027-02-05 to 2027-02-07 | `""` |
| `formatUtc`, `formatUnix`, `formatCalendarUtc`, `formatCalendarUnix` | `"2027-02-06T02:00:00Z"`, `1801792800` (seconds) or the unit each takes | `""` |

`tdd-dev` checks each function's sentinel in its JSDoc before writing its row; the `…ToParts`
functions return `[]`.

### Allowed rows: the refusal is narrow

| Call | Expected | Why |
| --- | --- | --- |
| `formatTime("10:00", "zh-u-ca-chinese")` | the same text as `formatTime("10:00", "zh")` | time-only |
| `formatTime("10:00", "en", { calendar: "dangi" })` if `formatTime` takes `calendar` | same as without | time-only |
| `formatDateTime("2027-02-06T10:00", "en-u-ca-chinese", { hour: "numeric", minute: "numeric" })` | same as `"en"` | no date field |
| `formatDate("2027-02-06", "en-u-ca-chinese", { weekday: "long" })` | `"Saturday"` | weekday only |
| `formatDate("2027-02-06", "en-u-ca-gregory")` and `"en"` | unchanged (`"2/6/2027"`) | other calendars untouched |
| `formatDate("2027-02-06", "en-u-ca-chinese-nu-latn", { timeZoneName: "short" })` | `""` | defaults add year, month, day |

Write expected text for the allowed rows by calling the same function on the same host without the
calendar (an oracle in the row, as `yearPrintingDormant.test.ts` does), never a hard-coded CLDR
string: CLDR wording differs by host (Open question 7).

### Already-sentinel rows, kept as a guard

One row each, asserting the sentinel on every host: `convertDateToCalendar("2027-02-06", "chinese")`,
`isValidCalendarDate` with `{calendar:"dangi",…}`, `holidayDates({name:"Spring Festival",
kind:"calendarFixed", calendar:"chinese", monthCode:"M01", day:1}, 2027)` → `[]`,
`isValidHolidayRule` of that rule → `false`. These exist elsewhere; the rows here make this file the
one place that lists every D33 path. Use the existing rows' values; do not invent new sentinels.

### The D33 check test

As specified in canary.md § a. It runs in every pass. On every pass today its title is "a D33
repro fails on this Temporal and this host". Its body asserts the repro count (32) and that
`formatDate("2027-02-06", "en-u-ca-chinese")` is `""`.

## 2. Rows that move (values unchanged)

D28 and the chinese parts of D29 stay correct and dormant (gate.md). Their public rows would now
get `""`, so each moves to the internal function that holds the repair, **in the same file, with
the same `describe` and test titles**: `scripts/lib/native-suite-tags.mjs` matches them by title
(`webkit-macos-zh-chinese-year-name-only` on `^D28: … 'zh-u-ca-chinese-nu-hanidec'`, file
`yearPrinting.test.ts`; `firefox-locale-pattern-data` on `'ja-u-ca-(?:chinese|dangi)'`). After the
move, run `pnpm test:markers` and the native-suite tag tests; a tag that no longer matches is a
defect.

The internal entry points, both already exported:

- **D28** lives in `guardedDateTimeFormat` (`internal/formatterCache.ts:64`), which `construct`
  calls and which does not refuse. Single rows: `guardedDateTimeFormat(locale, {...options,
  timeZone: "UTC"})`, then `.format(ms)` and `.formatToParts(ms)` at UTC midnight of the ISO date
  (`Temporal.PlainDate.from(iso).toZonedDateTime("UTC").epochMilliseconds`).
- **D29** range rows: `formatRangeRepaired(guardedDateTimeFormat(locale, {...options, timeZone:
  "UTC"}), options, startMs, endMs)` (`internal/rangeFields.ts:220`).

| File | Rows | Becomes |
| --- | --- | --- |
| `internal/yearPrinting.test.ts` 763–934 (`describe "D28: chinese and dangi related year at full width under year 2-digit"`) | every row; the `formatDate`/`formatDateToParts`/`formatZonedDateTime`/`formatDateTime` cross-checks in one row become `format`/`formatToParts` of the one guarded formatter (the cross-function equality is now the public sentinel rows' job); the three range functions become `formatRangeRepaired` | same titles and expected values; drop imports the file no longer uses |
| `internal/yearPrinting.test.ts` 843–849 (`leaves a gregory year 2-digit and a chinese year numeric untouched`) | the gregory half stays public; the chinese half moves to `guardedDateTimeFormat` | same title |
| `internal/rangeFields.test.ts` 22 (`chinese drops the related year`) | `formatRangeRepaired` | same expected text |
| `internal/rangeFields.test.ts` 81–91 (three functions, chinese months apart) | one row, `formatRangeRepaired`; title keeps `$label` with the label `formatRangeRepaired` | `"Sixth Month 2024(jia-chen) - Seventh Month 2024(jia-chen)"` |
| `internal/rangeFields.test.ts` 93–100 (chinese inside one month) | `formatRangeRepaired` | `"Sixth Month 2024(jia-chen)"` |
| `internal/rangeFields.test.ts` 235–237 (`ja-u-ca-chinese`, `ja-u-ca-dangi`) | split from the `it.each` into a sibling `it.each` with the same title template, calling `formatRangeRepaired` | same expected text |
| `internal/yearPrintingDormant.test.ts` 42–43, 107–108, 199–203 | the D28 dormancy rows: the probe-passes branch now meets the refusal. Rows 42–43 and 107–108 assert through `guardedDateTimeFormat` against the engine's formatter; 199–203 (`widenRelatedYear` truth table) are internal already, keep | same titles |
| `plain/format/formatDate.test.ts:390` | `en-US-u-ca-chinese`, `{year, month: "long"}` | expected `""`, reason `"chinese is refused on every host (D33)"` |
| `internal/weekYearSingle.test.ts:109` | `zh-u-ca-chinese` row | delete: both sides are now empty, so it tests nothing |

Rows that need no change (verified): `weekYearGuard.test.ts` (calls `guardDateTimeFormat` on raw
formatters), `weekYearRange.test.ts:266` (raw `Intl`), `rangeDetector.test.ts` (internal),
`totalDuration.test.ts`, `resolveDurationRelativeTo.test.ts`, `calendarSystemIds.test.ts`,
`calendarDateString.test.ts`, `calendarValueOf*.test.ts`, `calendarZonedString.test.ts`,
`convertDateToCalendar.test.ts`, `convertZonedToCalendar.test.ts`, `isValidCalendarDate.test.ts`,
`isValidCalendarZonedDateTime.test.ts`, `isValidHolidayRule.test.ts`, `holidayDates.test.ts`
(already sentinels), `yearPrintingProbes.test.ts` (probe only).

## 3. `lunisolarRefusal.test.ts` (unit, beside the new module)

| Formatter | Result |
| --- | --- |
| `new Intl.DateTimeFormat("en-u-ca-chinese")` (defaults: year, month, day) | throws `RangeError` |
| `("en", {calendar: "dangi", dateStyle: "short"})` | throws |
| `("zh-u-ca-chinese", {era: "short"})`, `({year})`, `({month})`, `({day})` | throws each |
| `("zh-u-ca-chinese", {hour: "numeric"})`, `({weekday: "long"})`, `({timeStyle: "short"})` | returns the same object |
| `("en-u-ca-gregory")`, `("en-u-ca-hebrew")`, `("en-u-ca-coptic", {era: "short"})` | returns the same object |
| a formatter whose `resolvedOptions` throws (stub) | returns the same object (no new failure path) |

Assert `toThrow(RangeError)`, never the message.

## 4. `formatterCache.test.ts`

One row: `cachedFormatter("DateTimeFormat", "en-u-ca-chinese", {})` throws `RangeError`, and a
second call throws again (a refusal is never cached). `checkFormatterArguments` with the same
arguments throws too (it is the path the format functions use to pick their sentinel).
