# CORE-102 — Design notes

Part of [CORE-102](../CORE-102.md).

- **Output is `--MM-DD`; input is either.** Temporal's `toString` writes `12-25`, which reads as a
  year-month or a range to a person. `--12-25` is the form RFC 6350, RFC 3339 Appendix A and the
  Temporal grammar note use, and cannot be mistaken for anything else.
- **Basic forms are refused.** `--1225` and `1225` return the sentinel, as `isValidDate` refuses
  `20241225`.
- **No year is invented.** The 1972 reference year is internal: it never appears in output, and
  comparison orders by month, then day.
- **29 February is valid.** It is a month-day, and `monthDayToDate` clamps it by the same TC39
  constrain rule `addDate` uses (painpoints § Non-existent days).
- **Formatting uses the Gregorian calendar.** An ISO month-day and a Gregorian one name the same
  month and day, and ICU formats `calendar: "iso8601"` without the locale's month-day pattern
  (Node prints `" 25"`, browsers `Dezember 25` for de-DE). With a `calendar` option, the calendar
  Intl resolves must be `gregory` or `iso8601`, otherwise the sentinel. Intl ignores an unsupported
  value and uses the locale's default, so `{ calendar: "foo" }` formats in en-US and gives `""` in
  th-TH.
- **`dateStyle` is mapped by gmt, the same in every engine.** `full` and `long` give
  `{ month: "long", day: "numeric" }`, `medium` gives `{ month: "short", day: "numeric" }`, and
  `short` gives numeric month and day. This is polyfill 0.5.1's mapping. Native V8 and JavaScriptCore
  run ECMA-402 AdjustDateTimeStyleFormat and copy the widths from the locale's own date pattern, so
  their `toLocaleString` differs in six locales: de-DE medium `25.12.`, zh-CN, zh-TW and ja-JP full,
  long and medium `12/25`, ko-KR medium `12. 25.`, ar-SA medium `٢٥/١٢`. Deriving the widths per
  ECMA-402 instead is open for the owner.
- **No `toLocaleString` oracle in the tests.** With `dateStyle` the engines differ by design. With
  explicit fields, polyfill 0.5.1 and Chromium 153 drop a month width that zh and ja print as a
  number (`12/25` for `12月25日`; record X in `js-temporal-polyfill-bugs.md`). The 17-locale exact
  rows are the authority.

- **Year-month output is `YYYY-MM`** (`±YYYYYY-MM` outside 0000–9999), Temporal's own `toString`
  with no calendar. Input is the extended form only: `202610` is refused, as for dates.
- **No day is invented.** The ISO reference day 1 stays internal. There is no `overflow` option:
  day 1 exists in every month, so `constrain` and `reject` never differ.
- **Arithmetic follows AddDurationToYearMonth as amended by tc39 `41faca474a`** (2026-01-15), run on
  `PlainDate` from day 1, so every engine gives the specification's result. A consequence: the
  lowest year-month, `-271821-04`, cannot be moved or have its first day, because its day 1 is
  outside the PlainDate range; its `getDaysInYearMonth` is still `30`. Likewise `+275760-09` has no
  last day.
- **Year-month formatting** keeps `era` (ECMA-402 inherits it for ~year-month~, not for
  ~month-day~), maps `dateStyle` as polyfill 0.5.1 does (`short` `{ year: "2-digit", month:
  "numeric" }`, `medium` short month, `long` and `full` long month), and formats `-271821-04` on
  day 20, the first day whose noon is a time value. A year at or before 0 prints the era year with no
  era (`0000-10` gives `October 1`), as `formatDate` does; pass `era` to show it.

## Authority — what each rule rests on

| Rule | Source |
| --- | --- |
| A month-day is a month and a day with no year | TC39 Temporal § `Temporal.PlainMonthDay` objects |
| `--MM-DD` and `MM-DD` are the ISO forms | Temporal grammar `DateSpecMonthDay`, note: "the year may optionally be replaced by `--` as in RFC 3339 Appendix A"; RFC 3339 Appendix A `datespec-mday`; ISO 8601:2000 §5.2.1.3 d) truncated form, permitted by RFC 6350 §4.3.1 |
| `--02-30` and day 31 in a 30-day month are invalid | Temporal grammar early error IsValidMonthDay |
| Only the ISO calendar, its `u-ca` value compared case-insensitively | Temporal ParseISODateTime, goal TemporalMonthDayString with no DateYear: "If _calendar_ is not ~empty~ and the ASCII-lowercase of _calendar_ is not *"iso8601"*, throw a *RangeError* exception" |
| Comparison is by month, then day | Temporal `PlainMonthDay.prototype.valueOf` note, which points to `PlainDate.compare` on the reference dates |
| `--02-29` in a common year is 28 February | Temporal `PlainMonthDay.prototype.toPlainDate`: CalendarDateFromFields(_calendar_, _mergedFields_, ~constrain~) |
| Format-context and stand-alone month names | UTS #35 Part 4 § Date Field Symbol Table, `M` and `L`; § Parsing Dates and Times |
| Month-day formatting fields | ECMA-402 Temporal GetDateTimeFormat, required and defaults ~month-day~ |
| A year-month is a year and a month; the ISO reference day is 1 | TC39 Temporal `Temporal.PlainYearMonth` constructor: "If _referenceISODay_ is *undefined*, then Set _referenceISODay_ to *1*𝔽" |
| `YYYY-MM` and `±YYYYYY-MM`; `-000000` is not a year | Temporal grammar `DateSpecYearMonth`, `DateYear` and its early error; W3C NOTE-datetime "Year and month: YYYY-MM" |
| `-271821-04` to `+275760-09` | Temporal ISOYearMonthWithinLimits |
| Year-month `u-ca` compared case-insensitively (D20) | Temporal ParseISODateTime, goal TemporalYearMonthString (tc39 `385b479bf8`) |
| Add and subtract years and months from day 1 | Temporal AddDurationToYearMonth (tc39 `41faca474a`) |
| Months between, truncated, zero for equal values | Temporal DifferenceTemporalPlainYearMonth, GetDifferenceSettings |
| First and last date; days in the month | Temporal `PlainYearMonth.prototype.toPlainDate`, `daysInMonth` |
| Year-month formatting fields and `era` | ECMA-402 Temporal GetDateTimeFormat, required and defaults ~year-month~, inherit ~relevant~; HandleDateTimeTemporalYearMonth |
| Gregorian rule, `dateStyle` mapping, the `-271821-04` day, extended form only | **GMT rule** (spec S5, S9, S12) |
| Sentinels | [coding-standards § API Contract](../../../coding-standards.md#api-contract) |
