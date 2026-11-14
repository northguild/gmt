# CORE-112 — Core: Some languages' date patterns crash Node and print the wrong year

**Scope:** GMT never makes the `formatToParts` or `formatRangeToParts` call that stops V8 on a
CLDR pattern with `Y`, and prints the calendar year where such a pattern prints the year a week
belongs to. It also prints the year the specifications give in four more cases the range check
found (D25 to D28). Adds no library function. Lands in #523 with DOX-G9 (#522). Tracked as #524. The
spec is [specs/CORE-112/](../specs/CORE-112/index.md); the defect is
[js-temporal-polyfill-bugs.md § AF](../js-temporal-polyfill-bugs.md#af-some-languages-date-patterns-print-the-week-of-year-year-the-wrong-year-everywhere-and-a-v8-crash-in-formattoparts-engine-and-cldr).

## Gap

Some CLDR 48 date patterns use `Y` (UTS #35 Part 4 § 8: the year of the week-of-year) where `y`,
the calendar year, is meant: ak, de-CH, gd, gl, kok, ksh, my, sc and te. CLDR 49 adds de with its
regional variants, kek, ki and pt. ECMA-402 FormatDateTimePattern prints the calendar year.

1. **Crash (V8, D23).** V8 without commit `0426b0d1045d` aborts in `formatToParts` and
   `formatRangeToParts` on a `Y` field: exit 133, no exception (nodejs/node#67076). Every Node
   from 22.22.2 to 26.13.0 has it. On `main` (`c7caa75d`) these abort Node 26.12.1:
   `formatZonedRange` with `my-u-ca-buddhist` and `timeZoneName: "long"`, through the D16
   carrier's `formatRangeToParts`; and `formatCalendar` with `gl-u-ca-hebrew`,
   `gl-u-ca-buddhist` or `gl-u-ca-roc`, through `joinDateTimeConnector`'s `dateStyle: "full"`
   parts.
2. **Wrong year (CLDR, D24).** Every engine prints the week-year: gd `Dùbh 2025` for
   2024-12-30, te-u-ca-buddhist `జులై 2026` for 2026-07-01 (2569), gl-u-ca-hebrew `dateStyle:
   "full"` 5786 for 1 Tishri 5787. [CLDR-19873](https://unicode-org.atlassian.net/browse/CLDR-19873)
   (not ours) reports gl and kek.
3. **Other wrong years (D25 to D28).** Every engine prints a Japanese era for japanese dates before
   1873-01-01, where Intl era/monthCode gives the Gregorian era; V8 prints a negative year for islamic
   dates before the Hijra; `ja` japanese `year: "2-digit"` prints `令和6年` for `令和06年`; and chinese
   and dangi pad the related year to two digits. [specs/CORE-112/year-printing.md](../specs/CORE-112/year-printing.md)
   gives each one's evidence and rule; the bug doc has them as § AG.
