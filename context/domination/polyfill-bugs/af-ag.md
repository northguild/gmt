# Polyfill and engine defects — § AF–AG

Part of [js-temporal-polyfill-bugs.md](../js-temporal-polyfill-bugs.md), which explains the
format and indexes every section.

## AF. Some languages' date patterns print the week-of-year year: the wrong year everywhere, and a V8 crash in `formatToParts` (engine and CLDR)

**Defect.** Some CLDR 48 patterns use `Y` (the week-of-year year) where `y` is meant (ak, de-CH, gd, gl, kok, ksh, my, sc,
te; CLDR 49 adds de, kek, ki, pt). ECMA-402 has no week-year field, so the engine prints a wrong year. Two defects, one
cause, guarded as two groups:

1. **D24, the wrong year (CLDR data, every engine).** `format`, `formatRange` and the parts methods print the week-year:
   wrong only near the year's end in Gregorian, wrong on every day in a calendar whose year does not start on 1 January
   (buddhist, japanese, roc). WebKit types the part `unknown`. Reported as
   [CLDR-19873](https://unicode-org.atlassian.net/browse/CLDR-19873) (gl and kek, not ours); our comment adds the other
   patterns.
2. **D23, the crash (V8).** V8 has no case for `UDAT_YEAR_WOY_FIELD`, so `formatToParts` and `formatRangeToParts` reach
   `UNREACHABLE()` and stop the process (SIGTRAP, exit 133, uncatchable). `format` and `formatRange` do not crash. Fixed by V8
   `0426b0d1045d` (Chromium 158). Every installed Node aborts: 20.20.2, 22.22.2, 22.23.5, 24.19.0, 24.21.0, 24.22.3,
   26.8.2, 26.10.0, 26.12.1, 26.13.0, 26.13.1 (CLDR 48.0). A range pattern with `Y` only on one side triggers it too: kok
   generic `GyMd` (greatest difference `G`) is `d-M-y GGGGG – d-M-Y GGGGG`, so a `kok-u-ca-coptic` range across years 0
   and 1 AM aborts while ranges inside one era do not. No public GMT call reaches it (43 calls tried on 26.13.1). The same V8 drops `year` from `resolvedOptions()` for such a pattern; the fix keeps it, which is the signal
   GMT reads.

Not a polyfill defect: the polyfill's `toLocaleString` and GMT both format through the host's `Intl.DateTimeFormat`.

```js
new Intl.DateTimeFormat("gl-u-ca-hebrew", { dateStyle: "full", timeZone: "UTC" }).formatToParts(0); // aborts Node on D23
new Intl.DateTimeFormat("my-u-ca-buddhist", { timeZoneName: "long", timeZone: "UTC" }).formatRangeToParts(0, 86400000); // aborts
```

**Workaround.** `internal/weekYearGuard.ts` checks each formatter once, when `formatterCache` builds it, using only
`format` and `resolvedOptions`; a flagged formatter prints the calendar year the ECMA-402 way and never calls a parts
method that could abort. Range text gets its own check on a formatter's first range call (`format` and `formatRange` probes
find a year run that is not the calendar year; that run is rewritten, with no range parts call). `D16` repairs the range
string from `formatRange`; `D17` keeps its parts merge, which only SpiderMonkey reaches. `scripts/canary/weekYear.mjs`
sweeps every CLDR locale weekly, so a new `Y` pattern is found before a user meets it.

**Upstream.** [nodejs/node#67076](https://github.com/nodejs/node/issues/67076) asks v22.x, v24.x and v26.x to take
`0426b0d1045d`; CLDR-19873 above. **Retires** `D23` when every V8 GMT supports has `0426b0d1045d`, and `D24` when CLDR prints
`y` (which also ends `D23`).

## AG. Other wrong years in formatted text, ranges that drop a field, and islamic calendar names (engine, ICU and CLDR)

Seven defects found by range sweeps: D25 to D28 compare every year a range prints with Temporal's calendar year, D29 compares
the fields of a range with the two single dates, and D30 and D31 came up beside them. None is a polyfill defect: GMT and the
polyfill both format through the host's `Intl.DateTimeFormat`. Each reaches GMT's format functions, in single dates and in
ranges, on Node 22.22.2, 24.21.0, 26.12.1 and 26.13.0 (ICU 78.2 and 78.3, CLDR 48), Chromium 153 and WebKit 26.6, except
where noted. Each is its own canary group. `internal/yearPrinting.ts`, `internal/japaneseNumerals.ts` and
`internal/rangeFields.ts` wrap a formatter only when its defect's probe fails and the formatter can show it. Every
replacement text is the engine's own; GMT owns no era, numbering, pattern or calendar data.

- **D25, japanese before 1873 (ICU, CLDR).** The japanese calendar prints Japanese eras before Meiji 6. ICU-23341 (not
  ours) is fixed for ICU 79.1 (not released); ICU 79 keeps Meiji 1 to 5 where ICU4X prints the Gregorian era. Filed as
  [ICU-23619](https://unicode-org.atlassian.net/browse/ICU-23619). ICU 78 also prints a range across 1873-01-01 in one
  calendar. *Workaround:* a date before 1873-01-01 formats through a `calendar: "gregory"` twin; a range across 1873-01-01
  prints each date in its own era, joined by the locale's fallback joiner (`internal/rangeFallback.ts`, shared with D29).
- **D26, islamic before the Hijra (ICU).** ICU prints a negative year with no era name
  ([ICU-23327](https://unicode-org.atlassian.net/browse/ICU-23327), not ours); WebKit is right (`643 Before Hijra`).
  *Workaround (owner decision):* a pre-Hijra date formats to the house empty value (`""` for text and ranges, `[]` for
  parts), so no wrong year is printed and no era name is owned. `D18` (§ R) keeps the engine's own parts through
  `guardedDateTimeFormat`.
- **D27, `ja` japanese `year: "2-digit"` (ICU).** ICU-20441 gives `ja` with the japanese calendar the `jpanyear` numbering
  whenever the pattern holds 年, and `jpanyear` ignores the minimum digit count and the numbering system
  (`ja-u-ca-japanese-nu-arab` prints `令和6年`). Filed as [ICU-23620](https://unicode-org.atlassian.net/browse/ICU-23620)
  (numbering part as a comment linking ICU-20561). *Workaround (owner decision):* a one-digit era year is padded with the
  zero of the formatter's own numbering system; 元年 stays, as CLDR's `ja` data has it; other numbering systems write the
  era year in their own digits.
- **D28, chinese and dangi related year under `year: "2-digit"` (ICU).** The pattern generator turns `yy` into `rr`, a
  padded related year, where ECMA-402 prints it at full width. Filed as
  [ICU-23621](https://unicode-org.atlassian.net/browse/ICU-23621). *Workaround:* build the formatter with
  `year: "numeric"`, the same pattern at full width.
- **D29, a range drops, repeats or garbles a field (CLDR, ICU).** ECMA-402 PartitionDateTimeRangePattern and UTS #35 Part 4
  (Interval Formats) put every field a date's single `format` prints in the range; a field both dates share may print once.
  A sweep of 794,400 formatters (662 locales × 16 calendars × 75 option sets) flags 13,397 on Node 26.12.1. Causes: chinese
  and dangi drop `relatedYear` across a year; the `B` day period is dropped or printed once for two periods; a range
  prints the short day period where the single prints the long one; Hebrew prints the end month wrong in fur, gsw, ksh and
  mn; malformed CLDR interval patterns repeat, drop or misplace a field (yo, as, rw, brx, dz, sv, sw, th, ta and others; az,
  hy, pcm and it in their `G` patterns); ICU takes the `y` pattern when only the era differs (scn, ca, chr, fi, hr, it, ko);
  and `ja` `{ hour, minute, hourCycle: "h12" }` prints `午後0時40分` where the single prints `午後12:40`. Filed as
  [CLDR-19912](https://unicode-org.atlassian.net/browse/CLDR-19912) (malformed patterns),
  [CLDR-19913](https://unicode-org.atlassian.net/browse/CLDR-19913) (month form, run-together texts, root chinese related
  year), [ICU-23622](https://unicode-org.atlassian.net/browse/ICU-23622) (`B` printed once, `U` skeleton fallbacks),
  [ICU-23623](https://unicode-org.atlassian.net/browse/ICU-23623) (`y` pattern when only the era differs),
  [ICU-23624](https://unicode-org.atlassian.net/browse/ICU-23624) (`ja` ignores `hourCycle`) and
  [ICU-23625](https://unicode-org.atlassian.net/browse/ICU-23625) (long day period printed short). *Workaround:* a range the
  detector (`internal/rangeDetector.ts`) flags prints as `P + format(start) + J + format(end) + S`, where `P{0}J{1}S` is the
  locale's interval fallback read from a helper formatter over a two-day range. Two instants whose field values are equal in
  every Table 6 row the pattern checks print as the single date; printed text is never compared. The detector calls only
  `format` and `formatRange` (D23), and its verdict is kept per pattern.
- **D30, `islamic` and `islamic-rgsa` resolve as written (V8, ICU).** Intl era/monthCode `CreateDateTimeFormat` turns a
  resolved `islamic` into `islamic-tbla`, and since tc39/proposal-intl-era-monthcode#99 `islamic-rgsa` is not an available
  calendar; V8 keeps both and prints ICU's astronomical calendar. WebKit 26.6 is right. Filed as
  [Chromium 585635918](https://issues.chromium.org/issues/585635918). *Workaround:* `formatterCache.ts` builds `islamic` as
  `islamic-tbla`, and `islamic-rgsa` with the keyword taken out, before every other repair.
- **D31, coptic before AM 1 (ICU).** Intl era/monthCode Table 2 gives `coptic` one era, `am`, with signed era years, and
  test262 `intl402/Temporal/PlainDate/from/non-positive-single-era-year.js` keeps era year −1 as −1. CLDR 48 removed the
  `bd` era (CLDR-18465), but ICU 78.3 still models two: ISO −0001-07-10 prints `Epep 18, 286 ` with no era part, where
  the spec gives `Epep 18, -285 AM`. Node 26.12.1, Chromium 153 and WebKit 26.6; Firefox 147+ patches its ICU (Bugzilla
  2002735) and is right. `ethiopic` is not affected. Upstream:
  [ICU-23277](https://unicode-org.atlassian.net/browse/ICU-23277) (not ours, accepted), fix
  [unicode-org/icu#4081](https://github.com/unicode-org/icu/pull/4081) open. No duplicate in the Chromium or WebKit
  trackers (searched 2026-11-17); GMT files nothing. *Workaround:* `internal/copticEra.ts` wraps a coptic formatter that
  can show an era or a year. A date whose coptic year is 0 or less moves forward by whole 28-year cycles (10,227 days,
  1,461 weeks: month, day, weekday and time stay), the engine formats it, and only the year is rewritten, signed with
  the locale's minus in the formatter's numbering system (`Intl.NumberFormat`). The era name and its place are the
  engine's. A range moves as a pair, and the year runs that differ between the two texts are replaced.
- **D32, Islamic epoch day (WebKit 331724, § R).** JavaScriptCore changes the Islamic era at the fixed instant
  0622-07-19T07:52:58Z (a day earlier for `islamic-tbla`), so the first hours of 1 Muharram of year 1 print `0 Before
  Hijra`, and west of UTC the last hours of year 0 print `AH`. Table 2 starts `ah` on the whole day. *Workaround:*
  `internal/islamicEpochEra.ts` moves an epoch-day or day-before instant by whole 210-year cycles (74,417 days, 10,631
  weeks), lets the engine name the era, and writes only the year (1). Delete it when the WebKit probe passes.
- **D34, Coptic epoch day (WebKit 331724, § AG).** JavaScriptCore changes the Coptic era at the fixed instant
  0284-08-29T07:52:58Z (local midnight in America/Los_Angeles), so the first hours of 1 Tout AM 1 print `Anno Martyrum`
  and the D29 field reader sees a different era for the day. Table 2 gives `coptic` one era and § 4.1.12 reads it from
  the date. WebKit/WebKit#81144 (bug 331724, open) already fixes the epoch-day case and tests it, so GMT files nothing.
  *Workaround:* `internal/copticEra.ts` moves an epoch-day instant by whole 28-year cycles (10,227 days), lets the
  engine name the era, and writes only the year (1); `localFieldsOf` reads the same twin. Delete it when the WebKit
  probe passes.

Not defects: indian `-79 Śaka` and persian `-622 AP` at ISO year −1. Table 2 gives each calendar one era with a signed era
year, and native Temporal gives `eraYear` −79 and −622 on all three engines. ECMA-402 FormatDateTimePattern's "value ≤ 0,
set value to 1 − value" fits only a calendar with an inverse era; filed as
[tc39/ecma402#1116](https://github.com/tc39/ecma402/issues/1116).

**Retires** each group when its probes pass in every compat verdict; see "Waiting on a release".
