# CORE-112 slice 7 — other wrong years and broken range text

Read with [index.md](./index.md). The slice 3c sweep compared every year in range parts with
Temporal's calendar year and found four more defects, none of them `Y` (D25 to D28). A sweep of
every range pattern then found D29, and checking D26's epoch found D30. Each one reaches GMT's
format functions on every engine checked: Node 22.22.2, 24.21.0, 26.12.1 and 26.13.0 (ICU 78.2
and 78.3, CLDR 48), Chromium 153 and WebKit 26.6. SpiderMonkey was not observed. Research
outputs: `<scratchpad>/preepoch/` and `<scratchpad>/d29/`.

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
- A range with both dates before 1873-01-01 is the Gregorian twin's `formatRange`. A range that
  crosses 1873-01-01 prints each date in its own era, as Table 2 gives them: 1872-12-31 to
  1873-01-01 in `en` is the start from the Gregorian twin (`1872 AD`) and the end from the
  japanese formatter (`6 Meiji`), joined as in D29's fallback. The whole range in Gregorian
  (`1872 – 1873 AD`) is wrong: 1873-01-01 is Meiji 6.
- Upstream: the years before Meiji are fixed in ICU 79.1. Meiji 1–5 is filed as ICU-23619. CLDR's
  Meiji start (1868-10-23, CLDR-11375) is the era's historical start and stays; ICU4X keeps it too
  and prints the Gregorian era for Meiji 1–5 in code (`components/calendar/src/cal/japanese.rs`,
  citing tc39/proposal-intl-era-monthcode#86). Exact text to the owner first.

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

The Hijra is the epoch of the formatter's calendar after D30: `islamic-civil` 0622-07-19,
`islamic-tbla` 0622-07-18 (Intl era/monthCode Table 1), `islamic-umalqura` that of
`islamic-civil` outside 1300 to 1600 AH. `islamic` computes as `islamic-tbla`, and `islamic-rgsa`
never reaches an islamic formatter (D30), so no epoch comes from an engine.

tc39/proposal-intl-eradisplay#10 (open) designs a year style option for `Intl.DateTimeFormat`,
with a style that shows the era when the year needs it and one that prints the signed
(algebraic) year. No engine ships it and the names are not settled. When one ships, the D25 and
D26 probes and repairs must pass that option through and treat a signed year the caller asked
for as correct.

## D27 — `ja-u-ca-japanese` with `year: "2-digit"` (ICU-23620)

`{ year: "2-digit" }` resolves `2-digit` but prints `令和6年` for 2024-07-10. ECMA-402
FormatDateTimePattern, "2-digit" branch: FormatNumeric with `minimumIntegerDigits: 2`, so
`令和06年`. ICU forces the `jpanyear` numbering for `ja` with the japanese calendar whenever the
pattern holds 年, and `jpanyear` ignores the minimum digit count. Numeric-only patterns are right
(`R06/7/10`). `jpanyear` also ignores the formatter's numbering system:
`ja-u-ca-japanese-nu-arab` prints `令和6年` for both `numeric` and `2-digit`, where FormatNumeric
in the resolved numbering system gives `令和٦年` and `令和٠٦年`. Same with `nu-fullwide` and
`nu-hanidec`.

**Owner decision:** keep 元年 for year 1, in both styles. It comes from CLDR's `ja` data and is the
Japanese convention. Pad every other year.

- Probes: `ja-u-ca-japanese`, `{ year: "2-digit" }` at 2024-07-10 prints a two-digit year; and
  `ja-u-ca-japanese-nu-arab`, `{ year: "numeric" }` at 2024-07-10 prints the year in `arab` digits.
- Repair: when the year run is Latin digits and the formatter's numbering system is not `latn`,
  print the era year with the engine's `NumberFormat` in that numbering system
  (`useGrouping: false`). When the formatter resolves `year: "2-digit"`, print it with
  `minimumIntegerDigits: 2`. 元 stays as it is. The result is never mixed digits (`令和٠6年`).

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

## D29 — range text that drops, repeats or garbles a field (CLDR interval data, ICU)

ECMA-402 PartitionDateTimeRangePattern formats a range with the range pattern for the largest
field that differs, and UTS #35 Part 4 § Interval Formats builds that pattern from the two single
patterns, split at the first repeated field. So each date's part of a range holds every field the
formatter's single `format` prints for that date. Where the CLDR interval data or ICU breaks this,
the range drops a field of one date, prints it twice, prints the wrong value or runs two fields
together. GMT then prints the range as the fallback below.

GMT follows PartitionDateTimeRangePattern step by step and changes only the broken step. A range
whose printed fields are all equal is the start's single `format`. A range whose largest differing
field has a sound pattern is the engine's own `formatRange`. Only a range whose largest differing
field has a broken pattern prints the `[[Default]]` fallback, which the spec uses when no range
pattern for that field is available. Owner decision: retiring D29 may change text, because CLDR may
fix a broken pattern by rewriting it, and a fixed engine then prints the rewritten range. This is
the only workaround that may change output on removal.

The sweep: 794,400 formatters (662 locales × 16 calendars × 75 option sets, UTC). Node 26.12.1 flags
13,397; a formatter can have more than one cause. Runs on Node 22.22.2 and 24.21.0 flag the same
ones, and Node 22 also flags 712 iso8601 formatters across an era that Node 24 and 26 print right.
Detail: `<scratchpad>/f28-26.12.1.json` and `<scratchpad>/detail.json`.

| Cause | Formatters |
| --- | --- |
| chinese and dangi: a year difference drops `relatedYear` (and the cyclic year name in ff-Adlm, ko, ko-KP, vi) | 4,125, in 662 locales |
| The day period `B` is dropped from one date, or printed once where the two dates have different periods (am, ar, af-NA, el, hi, ko, yue and more) | 8,304 |
| The range prints the short day period where the single prints the long one (bgc, sd, to and 19 more) | 352 |
| hebrew: the end's month gets the wrong value (fur, gsw, ksh, mn) | 23 |
| Malformed CLDR interval patterns, and ICU's choice of pattern when only the era or the hour cycle differs | 815, in 61 locales |
| Fields run together, though the parts are labelled right | 16 |
| A field on the wrong side of the dash (tr, tr-CY, yo, yo-BJ) | 48 |
| The era text is wrong (de-CH, ff-Adlm, kok) | 63 |

Examples: yo `yMEd`/d is `E, dd/MM/y – E, dd/MM/y, E` in CLDR 48, 49 and `main`; rw `yMMMd`/M is
`d – d MMM y`, new in CLDR 49; zh `{ month: "narrow" }` prints `2024年515日`, ja chinese
`甲辰年48日水` and brx `20/112025`.

The malformed patterns are in yo, yo-BJ, as, rw, brx, dz, en-JP, kgp, yrl, ku, qu, rm, sv, sw, th,
wae, ta and tok in any range, and in az, hy, pcm and it in their `G` patterns across an era. In
scn, ca, chr, fi, hr, it and ko, ICU takes the `y` pattern when only the era differs, so one era is
printed; in ja, the `hm` pattern's `K` ignores `hourCycle: "h12"`. CLDR 49 fixes the yo `yMMMEd`, as
and rw `yMEd` ones; the rest are in CLDR 49 too.

- **Expected value.** A flagged range is `P + format(start) + J + format(end) + S`, where
  `P{0}J{1}S` is the locale's interval fallback (UTS #35 `intervalFormatFallback`, `{0} – {1}` in
  root). ECMA-402 gives the same text: its `rangePatterns.[[Default]]` is the two full patterns
  joined by the fallback. GMT owns no data: P, J and S are read from a helper formatter with the same
  locale, calendar and numbering system and `{ year, month, day, hour, minute }`, over a two-day
  range, which the engine prints as a fallback. Reference: `<scratchpad>/d29/joiner8.mjs`; it
  repaired all 16,950 bad ranges in the sweep on all three Nodes.
- **Detector** (`<scratchpad>/d29/core10.mjs` is the reference). It calls only `format` and
  `formatRange` (D23), on a UTC clone of the formatter. It compares each probe range with the two
  single texts: 8 fixed probe pairs (largest difference y, M, d, a, h and m, plus a second y and d
  pair), with moved instants that tell each field apart. Add what the reference lacks:
  - an era-difference probe pair (japanese Heisei to Reiwa; gregory BC to AD). en-JP japanese
    `GyMEd`/G and it `GyMEd`/G are broken there;
  - a field-order check: each date's fields stay on its own side of the joiner. yo `yMMMM`/y
    prints `Oṣù Ẹ̀bibi – 2024 Oṣù Bélú 2025` in CLDR 48, 49 and `main`, with the start's year after
    the dash.
- **Verdict.** Lazy, on a formatter's first range call. Cached by the same key as the D24 verdict
  (resolved locale, calendar, numbering system, hour cycle and the zone-free options), so it runs
  once per pattern, not once per formatter. Cost in the reference: 5.3 ms mean, 16 ms p99, about 200
  calls. Report the full gmt suite time before and after. If it grows noticeably, it is an owner
  decision, not a change to the detector.
- **Gate.** Over the whole sweep on the three Nodes: FN 0 against the parts oracle, run in child
  processes on the probe ranges and on ranges moved from them (start earlier, end later, both).
  Every flag that oracle does not confirm must be one of the run-together text defects, each pinned
  by a test row. The 132 formatters whose parts calls abort V8 are left out of the oracle and kept
  in the detector's run.
- **Dormant.** One canary group, D29, with one repro per cause: en-u-ca-chinese, a year apart;
  a `B` locale and options taken from `agg-26.txt`; fur hebrew, a month apart; yo `yMEd`,
  a day apart. The detector runs only while one repro fails. `scripts/canary/` gets a weekly
  sweep, like `weekYear.mjs`, that reports any locale that breaks or is fixed.
- Applies to `formatRange` and every GMT range function that prints through it, composed with
  D24's range year repair and D25 to D28. `repairRangeParts` (D16, D17) trusts `source`: a repaired
  range is a string, so nothing passes it parts. Keep a test that pins this.

## D30 — `islamic` and `islamic-rgsa` resolve to calendars no engine should use

Intl era/monthCode CreateDateTimeFormat: "If resolvedCalendar is "islamic", then set
resolvedCalendar to "islamic-tbla"" (`spec.emu` at `e2a62d5c90`). Since
tc39/proposal-intl-era-monthcode#99, `islamic-rgsa` is not in AvailableCalendars, so a
DateTimeFormat ignores it and takes the locale's default calendar. test262
`intl402/DateTimeFormat/constructor-options-calendar-islamic-fallback.js` requires a calendar from
AvailableCalendars for both. V8 (Node 22.22.2 to 26.12.1, ICU 78.3) resolves `islamic` and
`islamic-rgsa` as they are and prints ICU's astronomical calendar: `en-u-ca-islamic` 2024-07-10 is
`Muh. 5, 1446 AH`, a date no available calendar gives (`islamic-tbla` and `islamic-umalqura`
print `Muh. 4`, `islamic-civil` `Muh. 3`).

- Probe: `new Intl.DateTimeFormat("en-u-ca-islamic").resolvedOptions().calendar` is
  `islamic-tbla`, and the same for `islamic-rgsa` is not `islamic-rgsa`.
- Repair in `formatterCache`'s `construct`, before every other repair: when the engine resolves
  `islamic`, rebuild with `calendar: "islamic-tbla"`; when it resolves `islamic-rgsa`, rebuild
  with the `ca` keyword removed from the locale and no `calendar` option, so the locale's default
  applies. The calendar a GMT function reads back (`formatYearMonth`, `formatMonthDay`) is then the
  one the spec gives.
- Upstream: search the V8 and ICU trackers first. Exact text to the owner before filing.

## Upstream (exact text to the owner before filing)

- Filed: ICU-23620, `jpanyear` loses `yy` padding (D27).
- Filed: ICU-23621, the pattern generator turns a `yy` skeleton into `rr` where the pattern has a
  related year (`dtptngen.cpp` `adjustFieldTypes` keeps the requested length), which V8 and
  JavaScriptCore both inherit (D28).
- Filed as [CLDR-19912](https://unicode-org.atlassian.net/browse/CLDR-19912) on 2026-11-14: the
  malformed interval patterns of D29, with the locale list and the yo `yMEd`/d example, the rw
  `yMMMd`/M regression in CLDR 49 and ta `hmv`. The open tickets that touch
  this class are CLDR-19228, CLDR-19845, CLDR-19846, CLDR-19718, CLDR-18930, CLDR-19027,
  CLDR-17800 and CLDR-18892; CLDR-19217 (de, done) is the precedent. None names these locales.
- Filed as [CLDR-19913](https://unicode-org.atlassian.net/browse/CLDR-19913) on 2026-11-14: the
  data causes of D29 (the month form in fur, gsw, ksh and mn, the brx and zh `iso8601` run-together
  texts, the root chinese related year). Filed as [ICU-23622](https://unicode-org.atlassian.net/browse/ICU-23622)
  the same day: the code causes (the `B` day period printed once for two periods, and the chinese and
  dangi `U` skeletons that fall back to patterns that lose fields).
- Filed on 2026-11-15: the az, hy and pcm `G` patterns as a comment on CLDR-19912;
  [ICU-23623](https://unicode-org.atlassian.net/browse/ICU-23623), the `y` pattern taken when only the era differs;
  [ICU-23624](https://unicode-org.atlassian.net/browse/ICU-23624), the `ja` range that ignores `hourCycle`;
  [ICU-23625](https://unicode-org.atlassian.net/browse/ICU-23625), the long day period printed short in a range.
- D27: a comment on ICU-23620 that `jpanyear` also ignores the numbering system (`nu-arab` prints
  Latin digits), linking ICU-20561.
- Filed: Chromium 585635918, V8 keeps `islamic` and `islamic-rgsa` as given instead of
  `islamic-tbla` and the locale's default calendar (D30).
- Filed: tc39/ecma402#1116, limit the "value ≤ 0" step to calendars with an inverse era.
- Filed: ICU-23619, the `japanese` calendar prints Meiji 1–5 for 1868-10-23 to 1872-12-31, where
  tc39/proposal-intl-era-monthcode#86 and ICU4X give the Gregorian era (D25).
- D25's years before Meiji and D26 are already filed (ICU-23341 fixed, ICU-23327 open).
- Every item not yet filed: search for a duplicate first, then the exact text to the owner.
