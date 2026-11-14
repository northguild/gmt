# CORE-112 slice 7 — other wrong years in formatted text

Read with [index.md](./index.md). The slice 3c sweep compared every year in range parts with
Temporal's calendar year and found four more defects, none of them `Y`. Each one reaches GMT's
format functions, in single dates and in ranges, on every engine checked: Node 22.22.2, 24.21.0,
26.12.1 and 26.13.0 (ICU 78.2 and 78.3, CLDR 48), Chromium 153 and WebKit 26.6. SpiderMonkey was
not observed. Research outputs: `<scratchpad>/preepoch/`.

## Not defects

Indian (`-79 Śaka`) and persian (`-622 AP`) at ISO year −1 are right. Intl era/monthCode Table 2
gives each a single era with a signed era year, and native Temporal on all three engines gives
`eraYear` −79 and −622. ECMA-402 FormatDateTimePattern's "If partType is "year" and value ≤ 0, set
value to 1 − value" fits only a calendar with an inverse era; that wording is an ECMA-402 issue,
filed as tc39/ecma402#1116, not a GMT change.

## Rules every part follows

- Dormant: one engine probe per defect decides whether the engine has it. A formatter is wrapped
  only when the probe fails and the formatter can show the defect (its calendar, locale and
  options), so a fixed engine runs none of this code.
- `format` and `formatRange` calls only. No parts method on a pattern that can hold `Y` (D23).
- No GMT data: every replacement text comes from the engine's own formatters.
- Each part is its own canary group with a repro whose expected value comes from the
  specifications, and retires when every engine passes it.
- Apply in `format`, `formatToParts` and `formatRange`, composed with the D24 week-year repair.

## D25 — japanese years before 1873 (ICU-23341, fixed in ICU 79.1, before Meiji; ICU-23619, Meiji 1–5)

`en-u-ca-japanese` at ISO −0001-07-10 prints `Jul 12, -645 Taika (645–650)`; `ja` prints
`大化-645年`. Intl era/monthCode Table 2, as amended by
[tc39/proposal-intl-era-monthcode#86](https://github.com/tc39/proposal-intl-era-monthcode/issues/86)
(TG2, 2026-01-08; test262 tc39/test262#4877, merged): "For dates up to and including 1872-12-31,
the calendar "japanese" uses Gregorian eras. For dates of 1873-01-01 and later, the calendar
"japanese" uses the solar Japanese eras." So ISO −0001-07-10 is `2 BC`, and 1872-12-31 is
`1872 AD`, where ICU 78 prints `Meiji 5`. CLDR 49 drops the pre-Meiji eras (CLDR-11400) and ICU 79
then prints the Gregorian era before Meiji, but CLDR 49 still starts Meiji on 1868-10-23, so ICU 79
keeps Meiji 1–5 for 1868-10-23 to 1872-12-31.

- Probe: `en-u-ca-japanese`, `{ era: "short", year: "numeric" }` prints the same text as
  `en-u-ca-gregory` at both ISO −0001-07-10 and 1872-12-31.
- Repair: for a date before 1873-01-01, format with the same locale, options and
  `calendar: "gregory"`. The text is the engine's own.
- Upstream: the years before Meiji are fixed in ICU 79.1. Meiji 1–5 is filed as ICU-23619. CLDR's
  Meiji start (1868-10-23, CLDR-11375) is the era's historical start and stays; ICU4X keeps it too
  and prints the Gregorian era for Meiji 1–5 in code (`components/calendar/src/cal/japanese.rs`,
  citing tc39 era/monthCode #86). Exact text to the owner first.

## D26 — islamic dates before the Hijra (ICU-23327, open)

V8 prints `Dhuʻl-Q. 9, -642 AH` for ISO −0001-07-10 in `en-u-ca-islamic-civil`. Intl era/monthCode
Table 2 and § 4.1.12 give the `bh` era, and native Temporal gives `643 bh`. test262
`intl402/DateTimeFormat/prototype/formatToParts/era.js` requires ISO 600 and 2025 to print
different era names. WebKit is right (`643 Before Hijra`, WebKit 321713). V8's ICU has no BH era
name, so no repair is possible without GMT data.

**Owner decision:** on an engine that prints a negative AH year, a pre-Hijra date in any `islamic*`
calendar formats to the house empty value (`""`; the parts and range functions return their own
empty values). No wrong year is printed and no data is owned. The probe:
`en-u-ca-islamic-civil`, `{ era: "short", year: "numeric" }` at ISO 0600-07-10 prints an era that
differs from the one at ISO 2025-07-10. A range with either endpoint before the Hijra is empty too.

## D27 — `ja-u-ca-japanese` with `year: "2-digit"` (ICU-23620)

`{ year: "2-digit" }` resolves `2-digit` but prints `令和6年` for 2024-07-10. ECMA-402
FormatDateTimePattern, "2-digit" branch: FormatNumeric with `minimumIntegerDigits: 2`, so
`令和06年`. ICU forces the `jpanyear` numbering for `ja` with the japanese calendar whenever the
pattern holds 年, and `jpanyear` ignores the minimum digit count. Numeric-only patterns are right
(`R06/7/10`).

**Owner decision:** keep 元年 for year 1, in both styles. It comes from CLDR's `ja` data and is the
Japanese convention. Pad every other year.

- Probe: `ja-u-ca-japanese`, `{ year: "2-digit" }` at 2024-07-10 prints a two-digit year.
- Repair: only for a formatter that resolves `year: "2-digit"`, when the year run printed is one
  digit. Pad it with the zero of the formatter's own numbering system, taken from the engine's
  `NumberFormat`.

## D28 — chinese and dangi `relatedYear` under `year: "2-digit"` (ICU-23621)

ECMA-402 FormatDateTimePattern: `relatedYear` is FormatNumeric of the related year at full width,
with no 2-digit form. Engines print ICU's `rr`, which pads to two digits: `05(yi-chou)` for ISO
0005, and `06/-01` for ISO −0001 with `month: "2-digit"`. Four-digit years are unaffected. The
number is right; only the padding is wrong.

- Probe: `en-u-ca-chinese`, `{ year: "2-digit" }` at ISO 0005-07-10 prints the related year `5`.
- Repair: chinese and dangi, `year: "2-digit"` only. Replace the related-year run with the engine's
  `NumberFormat` of the signed related year (`useGrouping: false`, the formatter's numbering
  system, the locale's minus).
- `internal/weekYearRange.ts` treats a two-digit chinese or dangi run as ICU's `rr` width. It must
  follow the repaired width.

## D29 — yo interval patterns (CLDR 48 yo, ICU span labels)

CLDR 48 yo gregorian `yMMMEd`, greatestDifference `y`, is `y MMM d y, E – MMM d, E y`. UTS #35
Part 4 § intervalFormats splits a pattern at the first repeated field, so the start's half is
`y MMM d `. `formatDateRange("2024-07-10", "2025-07-10", "yo", { year, month: "short", day,
weekday })` prints `2024 Oṣù Agẹmọ 10 2025, Ọjọ́bọ – Oṣù Agẹmọ 10, Ọjọ́bọ 2025`: the start's weekday
(Ọjọ́rú) is lost. CLDR 49 fixes `yMMMEd`. `yMEd`, greatestDifference `d`, stays wrong in CLDR 49:
`E, dd/MM/y – E, dd/MM/y, E`. ICU's `addOverlapSpans` also labels the end's year and weekday
`startRange` (ECMA-402 PartitionDateTimeRangePattern: [[Source]] names the date formatted).
`yo-BJ` is the same. Chromium 153 falls back to English for `yo`.

- First, a sweep: every locale × option set × greatestDifference for interval patterns that drop or
  repeat a field. It uses `formatRangeToParts` in child processes, as an oracle only. Gate: the
  detector uses `format` and `formatRange` only, with FN 0 and FP 0 against that oracle.
- Repair: rebuild a flagged range from the engine's own single `format` of each endpoint, joined by
  the separator the same locale's `{ year: "numeric" }` range prints.
- `repairRangeParts` (D16, D17) trusts `source`. yo ranges with a time or zone field use the
  `{0} – {1}` form and are labelled right, so it is not misled. Keep a test that pins this.

## Upstream (exact text to the owner before filing)

- Filed: ICU-23620, `jpanyear` loses `yy` padding (D27).
- Filed: ICU-23621, the pattern generator turns a `yy` skeleton into `rr` where the pattern has a
  related year (`dtptngen.cpp` `adjustFieldTypes` keeps the requested length), which V8 and
  JavaScriptCore both inherit (D28).
- A CLDR ticket: yo `yMEd`, greatestDifference `d` (D29). Optionally an ICU ticket for the
  `addOverlapSpans` span guess.
- Filed: tc39/ecma402#1116, limit the "value ≤ 0" step to calendars with an inverse era.
- Filed: ICU-23619, the `japanese` calendar prints Meiji 1–5 for 1868-10-23 to 1872-12-31, where tc39
  era/monthCode #86 and ICU4X give the Gregorian era (D25).
- D25's years before Meiji and D26 are already filed (ICU-23341 fixed, ICU-23327 open).
