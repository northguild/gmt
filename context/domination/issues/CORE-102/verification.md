# CORE-102 — Verification

Part of [CORE-102](../CORE-102.md).

- `isValidMonthDay("--12-25")`, `"12-25"`, `"--02-29"` and `"--12-25[u-ca=ISO8601]"` are `true`;
  `"--02-30"`, `"--04-31"`, `"--1225"`, `"2024-12-25"`, `"--12-25[u-ca=gregory]"` and `12` are `false`
- `parseMonthDay("12-25")` returns `--12-25`
- `parseMonthDayFromDate("2024-02-29")` returns `--02-29`; `parseMonthDayFromDateTime("2024-12-25T10:00:00")` returns `--12-25`
- `parseMonthDayWithPattern("12-25", "MM-dd")`, `("25 décembre", "d MMMM", "fr")` and `("25 декабря", "d MMMM", "ru")` return `--12-25`
- `parseDateWithPattern("15 марта 2024", "d MMMM yyyy", "ru")` returns `2024-03-15`
- `formatMonthDay("--12-25", "en-US", { month: "long", day: "numeric" })` returns `December 25`
- `compareMonthDays("--02-29", "--03-01")` returns `-1`; `areMonthDaysEqual("12-25", "--12-25")` is `true`
- `monthDayToDate("--02-29", 2023)` returns `2023-02-28`; `monthDayToDate("--02-29", 2024)` returns `2024-02-29`
- `isValidDate("2026-10")` is `false`; `parseDateWithPattern("10/2026", "MM/yyyy")` and
  `parseDateWithPattern("octobre 2026", "MMMM yyyy", "fr")` return `""` (unchanged contracts)
- `isValidYearMonth("2026-10")` is `true`; `isValidYearMonth("2026-13")`, `"202610"` and
  `"2026-10-01"` are `false`
- `parseYearMonthWithPattern("10/2026", "MM/yyyy")` and
  `parseYearMonthWithPattern("octobre 2026", "MMMM yyyy", "fr")` return `2026-10`
- `parseYearMonth("2026-10[u-ca=ISO8601]")` returns `2026-10` on the polyfill and on native Temporal
  (D20), and record V in `js-temporal-polyfill-bugs.md` names both parsers
- `parseYearMonthFromDate("2026-10-31")` and `parseYearMonthFromDateTime("2026-10-01T10:00:00")`
  return `2026-10`
- `formatYearMonth("2026-10", "en-US")` returns `10/2026`; `formatYearMonth("2026-10", "fr-FR",
  { year: "numeric", month: "long" })` returns `octobre 2026`; `{ timeStyle: "short" }` and
  `{ day: "numeric" }` return `""`
- `compareYearMonths("2025-12", "2026-01")` returns `-1`; `areYearMonthsEqual("+002026-10", "2026-10")`
  is `true`
- `addYearMonth("2026-12", { months: 1 })` returns `2027-01`; `subtractYearMonth("2026-10",
  { months: 10 })` returns `2025-12`; `addYearMonth("2026-10", { days: 1 })` returns `""`
- `diffYearMonth("2025-11", "2026-10", "months")` returns `11`
- `startOfYearMonth("2024-02")` returns `2024-02-01`; `endOfYearMonth("2024-02")` returns
  `2024-02-29`; `getDaysInYearMonth("2023-02")` returns `28`
- Every function has rows on Node and in the browser suite, with the same expected values on the
  polyfill and native Temporal
- The pattern parser rows cover the 17 locales of `MustTestLocales`
- `pnpm run validate` stays green
