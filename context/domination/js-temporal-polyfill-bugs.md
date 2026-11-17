# `@js-temporal/polyfill` — upstream defects GMT works around

One section per defect GMT needs fixed upstream (in `js-temporal/temporal-polyfill`, `tc39/proposal-temporal`, or an
engine or ICU/CLDR where noted). Each section keeps the defect, a minimal repro, GMT's workaround, the upstream
links, and what retires the workaround. Code comments link to these section letters (`§ C`), so the letters and
headings stay as they are. Workaround detail (the D-id table, range guards and probes) lives in
[`packages/gmt/src/internal/temporalCompat/README.md`](../../packages/gmt/src/internal/temporalCompat/README.md).

The owner files every item, or tells an agent in plain words to post a named one. Filings route in order: ports go
to js-temporal in the order tc39 made them, new fixes go to `tc39/proposal-temporal` first, and the maintainers make
one release after the rebase catches up (js #373). `js` is js-temporal/temporal-polyfill, `tc39` is
tc39/proposal-temporal, `fc` is fullcalendar/temporal-polyfill.

Native-suite divergence rows (`apps/dox/scripts/canary/native-suite.test.ts`) point at these headings by their
GitHub slug (the test reads every file under `polyfill-bugs/`), and `scripts/lib/native-suite-tags.mjs` hard-codes the slugs of L, M, P, S, T, AD and AE. Renaming a
heading breaks them.

## Where each section lives

The sections live in [polyfill-bugs/](polyfill-bugs/), a few per file so each stays small. A code
comment that cites `js-temporal-polyfill-bugs.md § C` finds the section here.

- [Waiting on a release](polyfill-bugs/status.md#waiting-on-a-release)
- [Filed](polyfill-bugs/status.md#filed)
- [A. Wall clock → exact time at the range limits: release request](polyfill-bugs/a-g.md#a-wall-clock--exact-time-at-the-range-limits-release-request)
- [B. `GetNamedTimeZoneNextTransition` returns `null` within one search window of the max Instant](polyfill-bugs/a-g.md#b-getnamedtimezonenexttransition-returns-null-within-one-search-window-of-the-max-instant)
- [C. Non-ISO calendars: port-and-release request](polyfill-bugs/a-g.md#c-non-iso-calendars-port-and-release-request)
- [D. `"UTC"` fast path in `GetPossibleEpochNanoseconds` skips `IsValidEpochNanoseconds`](polyfill-bugs/a-g.md#d-utc-fast-path-in-getpossibleepochnanoseconds-skips-isvalidepochnanoseconds)
- [E. Transition search starts in 1847, after the first TZDB transition (1844-12-31)](polyfill-bugs/a-g.md#e-transition-search-starts-in-1847-after-the-first-tzdb-transition-1844-12-31)
- [F. `calendarToIsoDate` overshoot assertion from tc39 #3292 is reachable (tc39 only)](polyfill-bugs/a-g.md#f-calendartoisodate-overshoot-assertion-from-tc39-3292-is-reachable-tc39-only)
- [G. CLDR calendar-alias asymmetry: `ethiopic-amete-alem` is accepted, `gregorian` is not (ICU note, not a polyfill defect)](polyfill-bugs/a-g.md#g-cldr-calendar-alias-asymmetry-ethiopic-amete-alem-is-accepted-gregorian-is-not-icu-note-not-a-polyfill-defect)
- [H. The calendar nudge window is never retried (`total`, `round`, `until`)](polyfill-bugs/h-q.md#h-the-calendar-nudge-window-is-never-retried-total-round-until)
- [I. A zoned string's offset written with seconds is matched by minutes](polyfill-bugs/h-q.md#i-a-zoned-strings-offset-written-with-seconds-is-matched-by-minutes)
- [J. `ZonedDateTime.prototype.toString` writes a string `ZonedDateTime.from` refuses (tc39 only, spec)](polyfill-bugs/h-q.md#j-zoneddatetimeprototypetostring-writes-a-string-zoneddatetimefrom-refuses-tc39-only-spec)
- [K. The transition search skips, or never returns from, two offset changes inside one step](polyfill-bugs/h-q.md#k-the-transition-search-skips-or-never-returns-from-two-offset-changes-inside-one-step)
- [L. A one-character annotation key is refused](polyfill-bugs/h-q.md#l-a-one-character-annotation-key-is-refused)
- [M. `[u-ca=islamic]` is accepted instead of refused](polyfill-bugs/h-q.md#m-u-caislamic-is-accepted-instead-of-refused)
- [N. `ZonedDateTime.prototype.round` to `day` when a date starts twice](polyfill-bugs/h-q.md#n-zoneddatetimeprototyperound-to-day-when-a-date-starts-twice)
- [O. A `Z` string is read by wall clock under `offset: "ignore"`](polyfill-bugs/h-q.md#o-a-z-string-is-read-by-wall-clock-under-offset-ignore)
- [P. SpiderMonkey accepts a zoned string whose local date is −271821-04-19 (Firefox only, engine)](polyfill-bugs/h-q.md#p-spidermonkey-accepts-a-zoned-string-whose-local-date-is-271821-04-19-firefox-only-engine)
- [Q. Firefox `formatRange` prints AM/PM for a day period when a zone name is set (Firefox only, engine)](polyfill-bugs/h-q.md#q-firefox-formatrange-prints-ampm-for-a-day-period-when-a-zone-name-is-set-firefox-only-engine)
- [R. Islamic calendars read dates before the Hijra as positive years in WebKit (polyfill and engine)](polyfill-bugs/r-ab.md#r-islamic-calendars-read-dates-before-the-hijra-as-positive-years-in-webkit-polyfill-and-engine)
- [S. WebKit adds a year to the 30th of Dhu al-Hijjah before the Hijra as 13 months (WebKit only, engine)](polyfill-bugs/r-ab.md#s-webkit-adds-a-year-to-the-30th-of-dhu-al-hijjah-before-the-hijra-as-13-months-webkit-only-engine)
- [T. WebKit throws adding a year to the last day of Chaitra in far-past Indian years (WebKit only, engine)](polyfill-bugs/r-ab.md#t-webkit-throws-adding-a-year-to-the-last-day-of-chaitra-in-far-past-indian-years-webkit-only-engine)
- [U. `ZonedDateTime#equals` answers false for two identifiers of one zone where `resolvedOptions` keeps the identifier (polyfill; shows in JavaScriptCore)](polyfill-bugs/r-ab.md#u-zoneddatetimeequals-answers-false-for-two-identifiers-of-one-zone-where-resolvedoptions-keeps-the-identifier-polyfill-shows-in-javascriptcore)
- [V. `PlainYearMonth.from` and `PlainMonthDay.from` reject an upper-case `iso8601` calendar annotation (polyfill; fixed on tc39 `main`)](polyfill-bugs/r-ab.md#v-plainyearmonthfrom-and-plainmonthdayfrom-reject-an-upper-case-iso8601-calendar-annotation-polyfill-fixed-on-tc39-main)
- [W. `PlainMonthDay.from` accepts a day no year has (polyfill and tc39 reference polyfill)](polyfill-bugs/r-ab.md#w-plainmonthdayfrom-accepts-a-day-no-year-has-polyfill-and-tc39-reference-polyfill)
- [X. `toLocaleString` rebuilds the options from `resolvedOptions()`, so a month width the locale prints numerically is lost (polyfill and tc39 reference polyfill; Chromium shows it too)](polyfill-bugs/r-ab.md#x-tolocalestring-rebuilds-the-options-from-resolvedoptions-so-a-month-width-the-locale-prints-numerically-is-lost-polyfill-and-tc39-reference-polyfill-chromium-shows-it-too)
- [Y. `PlainYearMonth#add` and `#subtract` predate tc39 `41faca474a` (polyfill)](polyfill-bugs/r-ab.md#y-plainyearmonthadd-and-subtract-predate-tc39-41faca474a-polyfill)
- [Z. `PlainYearMonth#toLocaleString` with only `era` prints a day (polyfill; Chromium prints no date)](polyfill-bugs/r-ab.md#z-plainyearmonthtolocalestring-with-only-era-prints-a-day-polyfill-chromium-prints-no-date)
- [AA. `PlainYearMonth#toLocaleString` and `PlainMonthDay#toLocaleString` accept a `timeStyle` (polyfill)](polyfill-bugs/r-ab.md#aa-plainyearmonthtolocalestring-and-plainmonthdaytolocalestring-accept-a-timestyle-polyfill)
- [AB. `Temporal.Now` reads a millisecond early after a clock reading before 1970 (polyfill and tc39 reference polyfill)](polyfill-bugs/r-ab.md#ab-temporalnow-reads-a-millisecond-early-after-a-clock-reading-before-1970-polyfill-and-tc39-reference-polyfill)
- [AC. A length in days or larger is measured from the wrong pass of a repeated hour (polyfill)](polyfill-bugs/ac-ae.md#ac-a-length-in-days-or-larger-is-measured-from-the-wrong-pass-of-a-repeated-hour-polyfill)
- [AD. Node 26 adds one `smallestUnit` when it rounds a whole number of years, months or weeks (Node only, engine)](polyfill-bugs/ac-ae.md#ad-node-26-adds-one-smallestunit-when-it-rounds-a-whole-number-of-years-months-or-weeks-node-only-engine)
- [AE. ICU4C 75+ counts every Persian year before year 0 as a leap year (macOS WebKit, engine)](polyfill-bugs/ac-ae.md#ae-icu4c-75-counts-every-persian-year-before-year-0-as-a-leap-year-macos-webkit-engine)
- [AF. Some languages' date patterns print the week-of-year year: the wrong year everywhere, and a V8 crash in `formatToParts` (engine and CLDR)](polyfill-bugs/af-ag.md#af-some-languages-date-patterns-print-the-week-of-year-year-the-wrong-year-everywhere-and-a-v8-crash-in-formattoparts-engine-and-cldr)
- [AG. Other wrong years in formatted text, ranges that drop a field, and islamic calendar names (engine, ICU and CLDR)](polyfill-bugs/af-ag.md#ag-other-wrong-years-in-formatted-text-ranges-that-drop-a-field-and-islamic-calendar-names-engine-icu-and-cldr)
