# temporalCompat — calendar workarounds for `@js-temporal/polyfill` and the runtime's ICU

GMT always imports `@js-temporal/polyfill`. For non-ISO calendars, polyfill 0.5.1 and Node's ICU4C
return wrong fields, or throw, for some in-range dates. This directory makes those answers match
TC39 Temporal and the Intl era/monthCode proposal. It also lets each workaround be deleted once
upstream ships the fix. The upstream filings for these defects, and their status, are tracked on the
docs site at `/upstream/` (data: `apps/dox/src/data/upstream-filings.json`).

Decisions: `context/domination/issues/CORE-6.md` § Decisions. Owner choices:
`context/domination/research/calendar-standards-decisions.md`.

## Rules

1. **Import surface.** `index.ts` is the only import surface. Call sites use `calendarDateFromFields`,
   `calendarDateFromMonthCode`, `longestDayOfMonthCode`, `calendarFieldsOf`, `calendarDateAdd`,
   `calendarDateUntil`, `isCalendarArithmeticCompatNeeded`,
   `isNudgeWindowCompatNeeded`, `isSecondsOffsetMatchCompatNeeded`,
   `isTransitionSearchCompatNeeded`, `isDayRoundClampCompatNeeded`, `isZIgnoreExactCompatNeeded`,
   `isTimeZoneEqualsCompatNeeded` and `timeZoneEquals`, never the files behind them.
2. **Dormant unless needed.** Each defect has a repro in `probeRepros.ts` (or, for the canary-only
   groups, `repros.ts`), probed lazily in `capabilities.ts`: once per process, per calendar,
   memoized. If the installed runtime passes, that workaround never runs. When a probe fails, a
   per-call guard (a range check, a polyfill throw, a failed read-back, or a result that is not the
   spec's) decides whether this call needs it. `iso8601` values always pass straight through.
3. **Same answer after removal.** Every workaround computes the spec's answer, so deleting it on a
   fixed runtime changes no output and no test row. If a row would have to change, the workaround was
   wrong.
4. **`repros.ts` and `probeRepros.ts` import only the polyfill**, through `../temporal` (`repros.ts`
   also imports `probeRepros.ts`). A canary script can then load the compiled file from `dist`. A
   repro the shipped probes do not read lives in `repros.ts`, which no shipped module imports.
5. **Tests never mock Temporal or force a probe.** Public rows assert spec values that hold either
   way. The algorithms (`fieldSearch`, `nonIsoArithmetic`, `hebrewArithmetic`, `indianArithmetic`)
   are also tested directly.
6. **The probe cache is process-global.** It never goes stale because the polyfill is imported once.

## Workarounds

| Defect | What goes wrong (0.5.1 + Node 24 / ICU 78.3) | Where | Range guard |
|---|---|---|---|
| **D1** | Fields → ISO bisection probes outside the legacy `Date` range within about a year of both limits and throws `Invalid ISO date`, in parsing and in calendar add and until. Affects hebrew (max), buddhist, islamic-*, persian (min), indian (min) and ethioaa (max, until). | Parse: `calendarDateFromFields.ts` → `fieldSearch.ts`. Arithmetic: `calendarDateArithmetic.ts` → `nonIsoArithmetic.ts` over `readArithmeticModel.ts` | Parse: calendar year within 1 of a limit's year. Arithmetic: the polyfill threw a RangeError |
| **D2** | Buddhist is read through ICU4C's Julian/Gregorian hybrid, so every date before 1582-10-15 is wrong, and so is its arithmetic. | Reads: `calendarFields.ts` (`buddhistFields`: ISO year + 543, ISO month and day). Arithmetic: `calendarDateArithmetic.ts` runs buddhist add/until as ISO add/until | Every buddhist read and calendar-unit operation while the probe fails |
| **D3** | Hebrew `inLeapYear` uses JS `%`, so every year ≤ −1 is treated as leap. The result is wrong ordinal months, `Missing month` throws, invalid fields accepted, and wrong arithmetic. | Reads: `calendarFields.ts` → `hebrewArithmetic.ts`. Arithmetic: `nonIsoArithmetic.ts` over `hebrewArithmeticModel` | Hebrew years ≤ 0 (arithmetic: any year involved ≤ 2) |
| **D4** | ICU4C Hebrew is one day off for years ≤ 0. | same as D3 | same as D3 |
| **D5** | The "V8 bug 10529" detector expects `Saka` but ICU 78 prints `Śaka`, so every ISO year < 1 throws. | Reads: `calendarFields.ts` → `indianArithmetic.ts`. Arithmetic: `nonIsoArithmetic.ts` over `indianArithmeticModel` | ISO years < 1 (reads), Saka years ≤ −78 (parse; arithmetic ≤ −76) |
| **D6** | `until` re-constrains the day while counting months, so Aug 31 → Sep 30 is `P1M` where the spec's `NonISODateSurpasses` gives `P30D`. Every non-ISO calendar, at ordinary dates. | `calendarDateArithmetic.ts`: the polyfill's `until` is kept only when `isNonIsoDateUntilResult` proves it is the spec's; otherwise `nonIsoDateUntil` | Every non-ISO `until` by years or months while the probe fails |
| **D7** | `until` by years from a leap-year Hebrew `M05L` date throws "mixed-sign" (tc39/proposal-temporal#3159). | same as D6 | same as D6 |
| **D8** | Pre-proposal era codes: `japanese` instead of `ce`, `japanese-inverse` instead of `bce`, and `meiji` 1–5 for 1868–1872, which the proposal counts as `ce`. | `calendarFields.ts` (`japaneseFields`) remaps reads; `calendarDateFromFields.ts` rejects `japanese-inverse` input | Every japanese read while the probe fails |
| **D10** | Guard, not a 0.5.1 defect: proposal-temporal #3292 gave `calendarToIsoDate` a fixed 8-day search step, which skips a 5- or 6-day month 13 in far years and trips an assertion (tc39/proposal-temporal#3329). 0.5.1 predates #3292. GMT computes coptic and ethiopic in ethioaa (`internal/calendarSystemIds.ts`), so ethioaa is probed. | `calendarDateFromFields.ts` → `fieldSearch.ts`; `calendarDateArithmetic.ts` → `nonIsoArithmetic.ts` | While the probe fails: every ethioaa fields → ISO searches, and add/until fall back on a throw. On any runtime, a polyfill throw that is not a `RangeError` takes GMT's own path instead of the sentinel |
| **D9** | Non-ISO months are added (`addMonthsCalendar`) and counted (`until` by months) one month at a time, caching each step, so a few million in-range months is a fatal heap OOM (persian `1402-10-25` + 3,000,000 months aborts at 256 MB in about 3 s). Years and reads are O(1). Every non-ISO calendar. | `largeMonthSpan.ts`, called from `readArithmeticModel.ts` (`addMonths`, `monthsBetween`); `calendarDateArithmetic.ts` sends such adds and month differences to the spec algorithms | Amounts of at least `LARGE_MONTH_SPAN` (1,200) months, or years that far apart. Canary-only: no capability probe |
| **D11** | The calendar nudge window is never retried. TC39 bounds a duration between `relativeTo + r1 units` and `relativeTo + r2 units` and, when the target falls outside that window, recomputes it one unit further along (`ComputeNudgeWindow` with `additionalShift`, tc39/proposal-temporal#3172). The polyfill computes it once — its `assert(start <= dest <= end)` is compiled out of production builds — so the answer is taken over bounds that exclude the target. Hits `Duration#total` (wrong fraction), `Duration#round` and `until`/`since` with a calendar `smallestUnit` (a whole unit lost: `2024-01-31` to `2024-02-29T12:00` truncates to `PT0S` instead of `P1M`). Any calendar; only a `relativeTo` past the 28th reaches it, because only there does adding a month constrain the day. | `internal/zonedWallClockDifference.ts`: `monthTotalBySpec` and `monthRoundBySpec` in `durationTotal`/`durationRound`, the defect-4 gate in `zonedUntil`, `plainUntilWithRounding`, and the D11 term in `internal/plainDateUntil.ts` | Unit `month` or `year` with a `relativeTo` past the 28th, while the probe fails |
| **D12** | `ToTemporalZonedDateTime` matches a string's offset against the zone by minutes even when the offset is written with seconds, where TC39 requires an exact match. `1970-01-01T12:00-00:45:00[Africa/Monrovia]` is accepted (the zone stood at −00:44:30; the spec throws), and `1952-10-15T23:59:59-11:20:00[Pacific/Niue]` reads as the first pass of that repeated second (−11:19:40) instead of the second. Not a calendar defect: ISO strings, named zones with a sub-minute offset. | `internal/zonedWallClock.ts` `matchSecondsOffsetExactly`, called by `zonedDateTimeFrom`, which every GMT zoned-string parse goes through (a zoned `relativeTo` string included, via `internal/resolveDurationRelativeTo.ts`); it recomputes TC39 `InterpretISODateTimeOffset` with match-exactly | A string whose offset has a seconds part, read with `offset: "reject"` or `"prefer"`, whose polyfill result has a sub-minute offset, while the probe fails |
| **D13** | The time zone transition search samples the offset every 14 days and bisects a step whose ends differ. Two changes inside one step break it. A pair that returns to the same offset is skipped: `getTimeZoneTransition("next")` from 2000-10-01 in `America/Boa_Vista` misses 2000-10-08 and 2000-10-15 (601,200 s apart), and the start of 2000-10-08, whose midnight that change skips, throws a TypeError there and is 2001-10-14 in `America/Noronha`. Three different offsets in one step make the bisection loop for ever: `next` from 1944-04-15 in `Europe/Riga` never returns. Not a calendar defect: named zones. | `internal/zonedTransitionSearch.ts` (`nextTransitionAfter`, `previousTransitionBefore`), called by `zonedNextTransition` and `zonedPreviousTransition` in `internal/zonedWallClockOperations.ts`, which every GMT transition walk goes through; `needsOwnStartOfDaySearch` and `needsOwnDayBoundsSearch` in `internal/zonedWallClock.ts` send a skipped midnight to GMT's own `GetStartOfDay` | While the probe fails: every transition search in a named zone (the polyfill's search cannot be tried first, because it may not return), and a start of day, `hoursInDay` or day rounding whose midnight is skipped. Offset zones and `UTC` pass straight through |
| **D14** | `ZonedDateTime#round` to `day` does not clamp an instant in the second piece of a date that starts twice. A fall-back across midnight re-enters a date: `America/Goose_Bay` on 2010-11-06 (from 23:01−04:00), `Antarctica/Casey` on 2010-03-04 (from 23:00+08:00). `Temporal.ZonedDateTime.prototype.round` clamps the instant to the date's last nanosecond (tc39/ecma262#3966, commit `5f44331e0a11`; tc39/proposal-temporal#3312); without it `floor` and `trunc` give the next date's midnight, `ceil` and `expand` the end of the next date, and the half modes are wrong where the clock went back by about a day (`America/Sitka`, 1867-10-18: the second midnight instead of the first). Node 26's V8 throws `RangeError: ZonedDateTime is outside the expected day bounds`. Not a calendar defect: named zones. | `internal/zonedWallClockOperations.ts` `roundZonedDateTime` (the day branch) and `roundToDayFromOwnStartOfDay` (the clamp), called by `roundZoned` and `roundUnix` | While the probe fails: every day rounding in a named zone. Offset zones and `UTC` pass straight through |
| **D15** | `ToTemporalZonedDateTime` applies `offset: "ignore"` to a `Z` string and reads the wall clock in the zone, where TC39 keeps the string's own instant: it sets `offsetBehaviour` to ~exact~ for a UTC designator, and `InterpretISODateTimeOffset` applies `ignore` only when `offsetBehaviour` is ~option~. `2022-07-08T00:14:07Z[Europe/London]` with `offset: "ignore"` is `2022-07-08T00:14:07Z` by the spec and `2022-07-07T23:14:07Z` on the polyfill (native V8 in Node 24.21 with `--harmony-temporal` agrees with the polyfill). Near a range limit the wrong reading can also throw for an instant the spec accepts. Not a calendar defect: ISO strings, any zone with a non-zero offset. Not filed upstream yet. js-temporal `main` (`c55b211`) and tc39/proposal-temporal `main` (`e8cc03f`) still have it (bug doc § O). | `internal/zonedWallClock.ts` `zExactOptions`, called by `zonedDateTimeFrom`, which every GMT zoned-string parse goes through (`classifyStoredZoned`, `calendarSystemOfZonedValue` and `parseCalendarZonedValue` pass `offset`) | A string with a `Z` or `z` designator read with `offset: "ignore"`, while the probe fails; GMT reads it with `offset: "use"`, the exact reading. Every other string passes straight through |
| **D16** | ICU-20548: `DateIntervalFormat` drops the `timeZoneName` width in a range. V8 and JSC print `long` and `longGeneric` as short names ("EST", "ET") and drop `shortOffset` and `longOffset` (no `timeZoneName` part at all), where UTS #35 (Matching Skeletons) expects "fields in the skeleton and pattern ... to be adjusted in parallel" and ECMA-402 §11.5.8 builds each range part with FormatDateTimePattern over the range pattern's own fields. The ICU skeleton code (`getDateTimeSkeleton`) drops `O` and cuts `zzzz` and `vvvv` to `z` and `v`. Seen on Node 22.22.2 (ICU 78.2), 24.21.0 and 26.12.1 (ICU 78.3), Chromium 153 and WebKit 26.6; Firefox 155 carries `intl/icu-patches/bug-1856290-ICU-20548-dateinterval-timezone.diff` and is right. Not a calendar defect: any locale and zone, only `Intl.DateTimeFormat#formatRange`. | `internal/repairRangeParts.ts` (the part merge), called by `zoned/format/formatZonedRange.ts` for the zone name branch, gated by `isRangeZoneNameCompatNeeded(style)` | A `formatZonedRange` call with `timeZoneName` `long`, `longGeneric`, `shortOffset` or `longOffset`, while the probe for that style fails. It formats the range with `short`, and writes the requested names (from `formatToParts` of each endpoint) into the zone parts. No `timeZoneName`, `short` and `shortGeneric` pass straight through |
| **D17** | SpiderMonkey (Firefox 155) `formatRange` writes the AM/PM day period where `dayPeriod` asks for a flexible one ("10 AM GMT-5 – 12 PM GMT-5" for 10:00 to 12:00 in New York with `{ hour, dayPeriod: "short", timeZoneName: "shortOffset" }`), when `timeZoneName` is set and neither `hourCycle` nor `hour12` is. Its single format is right ("10 in the morning GMT-5", "12 noon GMT-5"). Not a width rule (UTS #35 treats a, b and B as close matches): ECMA-402 §11.5.8 picks the range pattern by the resolved [[HourCycle]] only, en-US resolves to h12 with or without `hourCycle: "h12"`, yet only the explicit one prints the flexible period. It happens with `short`, `long` and the offset zone styles, with and without minutes, and not with no `timeZoneName`, `hourCycle: "h12"` or `hour12: true`. An affected range always prints each endpoint whole (`startRange` and `endRange` parts, never a shared `dayPeriod`). V8 and JSC are right. Not a calendar defect. Filed as [Bugzilla 2085525](https://bugzilla.mozilla.org/show_bug.cgi?id=2085525); engine record Q in the bug doc. | `internal/repairRangeParts.ts` (the part merge), called by `zoned/format/formatZonedRange.ts` for the day period branch, gated by `isRangeDayPeriodCompatNeeded()` | A `formatZonedRange` call with `dayPeriod` and `timeZoneName`, while the probe fails. It replaces each day period part with the endpoint's single-format day period. Everything else passes straight through |
| **D18** | WebKit (JavaScriptCore: Safari and Playwright WebKit 26.6) prints an `islamic-civil`, `islamic-tbla` or `islamic-umalqura` date before the Hijra as a positive year in a second era (`Before Hijra`), where V8 and SpiderMonkey print a negative year in the one era. Polyfill 0.5.1 (`IslamicBaseHelper`, no era) takes the year as printed, so ISO `0621-01-01` reads as year 2 instead of -1 and `-271821-04-19` as 280805 instead of -280804; month, month code and day read correctly. The polyfill's fields → ISO conversion, add and until for an Islamic year <= 1 then do not return in WebKit, or land in the mirror year (year 1 and year 0 print the same digits, and the epoch day itself, 1 Muharram of year 1, prints as year 0 in the earlier era): `diffDateAsDuration` over the Islamic minimum hung the WebKit control pass of the native suite. The Intl era/monthCode proposal numbers the years through the epoch (`bh` era year n is year 1 - n); Node 26 native Temporal gives the expected values. Not filed yet; record R in the bug doc (`main` declares the Islamic eras, which may or may not read WebKit's spelling). | Reads: `calendarFields.ts` → `islamicEra.ts` (the date's era part compared with a modern date's, from the runtime's own formatter). Fields → ISO: `calendarDateFromFields.ts` → `fieldSearch.ts` for years <= 1 (`polyfillCannotReturn`), and for any Islamic year whose polyfill answer does not read back. Arithmetic: `calendarDateArithmetic.ts` → `nonIsoArithmetic.ts` over `readArithmeticModel.ts`, whose month steps for such years are `fixedMonthArithmetic.ts` at the runtime's month count | Reads: an Islamic date whose era part is not a modern date's, while the probe fails (year becomes `1 - read`). Fields → ISO and arithmetic: an Islamic year <= 1 at either end or within 2 years of the sum, while the probe fails. Every other date, year and engine passes straight through |
| **D19** | `ZonedDateTime#equals` answers false for two identifiers of one time zone on a host whose `Intl.DateTimeFormat#resolvedOptions` returns the identifier as written. The polyfill's `GetAvailableNamedTimeZoneIdentifier` finds a primary identifier in `Intl.supportedValuesOf("timeZone")` and takes a non-primary identifier's primary from `resolvedOptions().timeZone`. ECMA-262 TimeZoneEquals compares the two [[PrimaryIdentifier]]s, and ECMA-402 §6.5 (Time Zone Identifiers) fixes `"UTC"` as primary with `"Etc/UTC"`, `"Etc/GMT"` and `"GMT"` resolving to it; the IANA backward links (`Asia/Calcutta` → `Asia/Kolkata`) are the rest. JavaScriptCore (WebKit 26.6 in Playwright, Safari 27) keeps the identifier as written, the rule of the Stage 3 Time Zone Canonicalization proposal, so there the polyfill compares `Etc/UTC` with `UTC` and `Asia/Calcutta` with `Asia/Kolkata` and answers false, and `diffZoned` and `intervalLengthZoned` refuse a calendar unit across the pair. V8 and SpiderMonkey return the primary identifier and are right; native WebKit `Temporal` is right. Not a calendar defect: any pair of identifiers of one zone. Polyfill record U in the bug doc, not filed yet. | `temporalCompat/timeZoneEquals.ts`, called by `isCalendarDifferenceAcrossZones` (`internal/zonedWallClockDifference.ts`) for `diffZoned`, `diffZonedAsDuration` and `intervalLengthZoned`, gated by `isTimeZoneEqualsCompatNeeded()` | Two different identifiers while the probe fails: GMT resolves `Etc/UTC`, `Etc/GMT` and `GMT` to `UTC` by name (ECMA-402 §6.5, on every host, Safari 27 included), then asks the host's own `Temporal.ZonedDateTime#equals` when `globalThis.Temporal` exists (WebKit 26.6). On a host without `Temporal` (Safari 27) the polyfill's answer stands for any other pair, so the IANA links (`Asia/Calcutta`, `Etc/UCT`) stay two zones there: resolving a link needs IANA data that no Intl API exposes (bug doc § U). Equal identifiers, and every pair while the probe passes, go straight through |

Fields → ISO (`calendarDateFromFields`): asks the polyfill first. It keeps the result when the fields
read back unchanged through `calendarFieldsOf`. Otherwise, inside a D1 window or a corrected read
range, the field search answers over the corrected reads. An Islamic year the polyfill cannot return
from (D18) is never asked of it: the search answers at once. Since 1.16.0 (CORE-8) GMT's calendar strings are
RFC 9557 (ISO digits), so string parsing no longer builds a date from calendar fields; only the
arithmetic model below does.

Arithmetic path (`calendarDateAdd`, `calendarDateUntil`): `iso8601` is the polyfill. Weeks and days
are ISO day arithmetic. In a corrected range the spec algorithms run over ISO (buddhist) or the owned
Hebrew and Indian models. Otherwise the polyfill answers first: an add is kept unless it throws near a
limit (D1); an until is kept unless it throws or, while D6/D7 are present, is not the spec's result.
An add of 1,200 months or more, and an until by months across 100 years or more, skip the polyfill
and run the spec algorithm (D9).
The spec algorithms (`NonISODateAdd`, `ConstrainMonthCode`, `NonISODateSurpasses`, `NonISODateUntil`)
live in `nonIsoArithmetic.ts`, over an integer model:

- `readArithmeticModel.ts` answers from reads, `calendarDateFromFields` and the polyfill's own month
  arithmetic between day-1 dates (never constrained, so correct wherever it does not throw), stepping
  month by month through the field search next to a limit. It owns no calendar rule: the leap month a
  missing `M05L` constrains to is read from the polyfill at a modern year. Over 1,200 months or more
  it jumps whole years through `largeMonthSpan.ts` (D9): `years × monthsInYear` for calendars without
  leap month codes (proposal §4.1.4 Table 3), and for `hebrew` the day span between year starts over
  a mean month length measured from Temporal's own reads, accepted only within a third of a month of
  a whole count.
- `hebrewArithmeticModel` and `indianArithmeticModel` answer from the owned arithmetic.

Month code + day → ISO (`calendarDateFromMonthCode`, CORE-54): the date of a month code and day in a
calendar year, `null` when that year lacks the month (hebrew `M05L`) or the month lacks the day, and
for a date beyond a range limit in the calendar year that limit cuts; a `RangeError` when the
calendar cannot be read or the whole calendar year is out of range. It adds no workaround of
its own: it runs `monthOrdinal`, `daysInMonth` and `toDate` of `arithmeticModelFor(calendarId)` (the
owned Hebrew or Indian model where its read correction is active, else `readArithmeticModel`), so it
is correct exactly where those are and needs no probe. Used by `internal/holidayRules.ts`.

Longest month length (`longestDayOfMonthCode`, CORE-54): the most days a month code has in any year
of a calendar, `0` when the calendar has no such month. It reads `daysInMonth` of the same model
over the 33 calendar years from the one holding 2000-01-01: the Persian cycle, the longest leap
cycle, and a complete Hebrew year both fall inside, and the span is far from the range limits the
polyfill misreads. GMT keeps no month-length table. The result is kept per calendar and month code.
`internal/holidayRules.ts` uses it to refuse a `calendarFixed` day the month never has.

Whole operations (CORE-6 slices S5–S7). A wrong calendar `until` (D6) is returned, not thrown, so
code that owns a TC39 algorithm for a whole operation checks `isCalendarArithmeticCompatNeeded(id)`
— true when any D1–D7 probe fails for that calendar, never for `iso8601` — and then runs the spec
algorithm over the two entry points above instead of the polyfill's method:

| Seam | Operation | Spec algorithm |
|---|---|---|
| `internal/zonedWallClockOperations.ts` `addWithCalendarCompat` | `addToZoned`, `subtractFromZoned` | `AddZonedDateTime` |
| `internal/zonedWallClockDifference.ts` `zonedUntil` | zoned differences | `DifferenceZonedDateTimeWithRounding` |
| `internal/zonedWallClockDifference.ts` `calendarTotalBySpec`, `calendarRoundBySpec`, `calendarCompareBySpec` | `Duration` total, round, compare with a zoned or plain `relativeTo` | `DifferenceZonedDateTimeWithTotal` / `…WithRounding`, `DifferencePlainDateTimeWithTotal` / `…WithRounding`, `DateDurationDays` |
| `internal/plainDateUntil.ts` → `plainDateUntilWithRounding` | plain differences with rounding options | `DifferenceTemporalPlainDate` (plain context: `GetUTCEpochNanoseconds`) |
| `internal/zonedBucket.ts` `needsCalendarCompat` | zoned calendar buckets (`intervalCountZoned`) | calendar periods from corrected reads; everything else in ISO |

`zoned/interval/splitIntervalByUnitZoned.ts` steps through `addToZoned`.

GMT-owned rules, per owner decision Q4: the Hebrew arithmetic (Dershowitz & Reingold, *Calendrical
Calculations*, ch. 8) and the Indian national calendar rule (Calendar Reform Committee 1955;
*Explanatory Supplement to the Astronomical Almanac*). Both are cited in their files. Buddhist
arithmetic as ISO arithmetic follows from the proposal's statement that buddhist months and days are
identical to ISO 8601.

Transition search (D13). GMT's search computes TC39 `GetNamedTimeZoneNextTransition` and
`GetNamedTimeZonePreviousTransition` from offsets alone, with no zone data:

- **Sampling assumption.** No zone changes its offset twice within the 5-day step (432,000 s). The
  closest pair in tz 2026c is 601,200 s apart (`zdump -v`: `America/Boa_Vista`, `Noronha` and
  `Recife` in 2000, `Asia/Gaza` and `Asia/Hebron` in 2040), so a step holds at most one change:
  equal ends mean none, different ends mean exactly one, and bisecting it always narrows. The
  all-zones guard in `internal/zonedTransitionSearch.test.ts` reads the runtime's data through
  `Intl.DateTimeFormat` and fails if any pair is closer than the step plus a day.
- **"No further change"** follows the polyfill's own rule, so removal changes no answer: three
  366-day years past the later of the instant and now going forward, 1847-01-01 going back (then
  the `zoned.E` offset comparison).
- **Bounded.** With a limit instant, one offset read per 5 days of the limit plus at most 51 to
  pin the change. Without one, at most 200,000 steps, then a `RangeError` (the caller's sentinel).
  The daylight rule, `getDstTransitions` and the bucket walkers pass a limit.
- **Probe order.** The `skip.*` repros cannot stall and come first, so a runtime that fails them
  never runs `stall.*` in process. The canary runs `stall.*` with `Intl.DateTimeFormat#format`
  bounded to 20,000 reads. `stall.nextElAaiun` passes on 0.5.1 (14-day step) and fails on
  js-temporal main; the workaround goes dormant only when every repro passes
  (`anyReproFails`, tested with each one failing alone).

## Canary and native oracle

`repros.ts` also carries the canary-only `D9` repros, which count `Intl.DateTimeFormat#formatToParts`
calls instead of running an amount large enough to abort, and the zoned repros of `internal/zonedWallClock*`: the range-limit groups
`zoned.A`, `zoned.B` and `zoned.D` (upstream issue drafts A, B and D), and `zoned.E`, the transition
search the polyfill starts at 1847-01-01 (js-temporal/temporal-polyfill#372), which misses the
1844-12-31 date-line crossing of Asia/Manila, Pacific/Guam, Saipan, Kosrae and Palau. They are
canary-only: no capability probe gates those fallbacks, which already run only when the polyfill
throws or returns an unchecked UTC value, or, for `zoned.E`, only for an instant or local date
before 1847-01-01 in a named zone, where GMT finds the transition from offsets by bisection and so
computes the spec's answer whether or not the polyfill is fixed. Draft C (calendar fields near the
limits) is the `D1` group.

- **`pnpm compat`** (`scripts/temporal-compat.mjs check`, needs `pnpm build`): prints the installed
  polyfill, Node and ICU versions, then one line per repro, `STILL NEEDED (<output>)` or
  `REMOVABLE (returns spec value)`, grouped by workaround with its removal trigger. When every probe
  of a group passes it prints that group's removal steps. It always exits 0; `--fail-on-removable`
  exits 1 when a whole group is removable, for a manual release checklist only. Run it on every
  polyfill or Node upgrade.
- **`pnpm compat:oracle`** (`scripts/temporal-compat.mjs oracle`): runs
  `scripts/temporal-compat/scan-body.js` in Chromium's native Temporal (Playwright from `apps/dox`:
  `pnpm --filter @gmt/dox exec playwright install chromium`, or `--chrome=<path>`), runs a twin of
  the scan through GMT's public functions from `dist`, and writes
  `artifacts/temporal-oracle-<date>.{json,txt}`. Exit 0 when every mismatch is in the script's
  `TAGGED_MISMATCHES` (a documented test262-vs-Chromium disagreement, test262 file named); exit 1 on
  any other mismatch, which is a GMT bug; exit 2 when it cannot run. Weekly and manual in
  `.github/workflows/temporal-oracle.yml`; never in `validate` or `ci.yml`.

## Removal triggers

| Defect | Remove when |
|---|---|
| D1 | A js-temporal release ports proposal-temporal `a41eb67` + `af0cb4b` **and** the C-D1b patch (`context/domination/js-temporal-polyfill-bugs.md` § C): those two ports alone still leave Hebrew/Persian `until` and Hebrew `relativeTo` throwing near the maximum, in proposal-temporal main too. `D1.fieldsMin hebrew` also needs D3's port. No clamp of the bisection step is needed |
| D2 | A js-temporal release contains `2bb6ba1` (already on main) |
| D3 + D4 | **Both** hold: a js-temporal release ports proposal-temporal `0df570c`, **and** GMT's `engines.node` floor bundles an ICU containing `5267bb5778` (ICU-23007) |
| D5 | A js-temporal release ports proposal-temporal `314b112` |
| D6 | A js-temporal release contains `10aeb98` (already on main) |
| D7 | A js-temporal release ports proposal-temporal `0e32ee0` **and** C-D7b (part of proposal-temporal `196a3191`; bug doc § C). `0e32ee0` fixes the `mixedSign` probe only: the `leapMonthEnd` probe (`5784-M05L-30` → `5785-M06-29` by years) still returns `P1Y` without C-D7b |
| D8 | A js-temporal release contains `2bb6ba1` **and** proposal-temporal `977d11e0` + `993e6322`: `2bb6ba1` alone still reads `1872-12-31` as `meiji` 5 |
| D10 | A js-temporal release ports proposal-temporal #3292 **together with** the tc39/proposal-temporal#3329 fix. The group passes on 0.5.1 (no #3292); it fails only on a release with #3292 alone |
| D9 | A js-temporal release adds and differences non-ISO months in bounded work: each `D9` probe reads at most 100 `Intl.DateTimeFormat` dates for 1,200 months |
| D11 | A js-temporal release contains js-temporal/temporal-polyfill#361's `50d66d2`, which ports proposal-temporal #3172 (`5dd0b0d97ee1`, merged 2025-11-19 — the fix for tc39/proposal-temporal#3168), so the nudge window is retried. The port is **already written**, in ptomato's open PR #361 ("April 2026 rebase, part 3", opened 2026-04-22, no reviews as of 2026-09-20) — not on `main`, so a release alone will not do it, and no new filing is needed. Verified locally: `50d66d2` applies cleanly on `main` alone, touches only `lib/ecmascript.ts`, and flips all three probes (`total` 1.0172413793103448 → 1.0161290322580645; `until`/`round` `PT0S` → `P1M`) with test262 clean |
| D12 | A js-temporal release contains `23d1275` ("Normative: Require strict matching with a precise ZonedDateTime offset"), on main since 2026-04 and in no release. Expected values are test262 `intl402/Temporal/ZonedDateTime/from/zoneddatetime-sub-minute-offset.js` (bug doc § I) |
| D13 | A js-temporal release on which **every** `D13` probe returns the spec value, the `stall.*` ones within 20,000 offset reads. `a79c6a1` (per-zone transition search windows, on main, in no release) is **not** enough: it fixes the zones it lists, leaves `bisect` unchanged, and gives `Africa/El_Aaiun` a 17-day window that holds three offsets in April 1976, so `stall.nextElAaiun` fails there and GMT would hang without the workaround (bug doc § K; not filed). Expected values are Node 26.10.0's native Temporal and `zdump -v` |
| D14 | A js-temporal release contains the port of tc39/proposal-temporal#3312 (reference polyfill commit `59a51ea9d4`), so the `D14` probe returns `2010-03-04T00:00:00+11:00[Antarctica/Casey]`. Expected values are test262 `intl402/Temporal/ZonedDateTime/prototype/round/same-date-starts-twice.js` |
| D15 | A js-temporal release (and a Node whose V8 matches) in which `ToTemporalZonedDateTime` keeps a `Z` string's own instant under `offset: "ignore"`, so the `D15` probe returns `2022-07-08T00:14:07Z`. Expected value is the specification's (`InterpretISODateTimeOffset`), not an oracle run: native V8 has the defect too. js-temporal `main` (`c55b211`) and tc39/proposal-temporal `main` (`e8cc03f`) still have it (bug doc § O) |
| D16 | An ICU release that fixes ICU-20548 is bundled by GMT's `engines.node` floor (`>=22.16.0`) and by every browser the native suite runs, so every `D16` repro passes on every engine (the range's zone name equals the single format's for all six styles). `pnpm compat` reports Node; the weekly `temporal-oracle` run runs the same probes in Chromium, Firefox and WebKit (`scripts/lib/native-suite-compat.mjs`, one `temporal-compat-<leg>` verdict each) and files the removal issue only when every engine says removable. The expected value is a self-comparison, so GMT owns no CLDR string |
| D17 | The weekly `temporal-oracle` run's compat check in Firefox (`temporal-compat-firefox`) reports D17 removable: every `D17` repro passes in the Firefox the native suite runs, once Firefox prints the flexible day period in a range (Bugzilla 2085525). D17 names `engines: ["firefox"]` (`scripts/lib/workarounds.mjs`), so Firefox is the only engine in its scope; `pnpm compat` and the Chromium and WebKit checks report it out of scope, never removable. The expected value is a self-comparison, so GMT owns no CLDR string |
| D18 | The weekly `temporal-oracle` run's compat check in WebKit (`temporal-compat-webkit`) reports D18 removable: every `D18` repro passes in the WebKit the native suite runs, once a js-temporal release reads the Islamic eras (`main` declares `ah` and `bh` for the Islamic helpers; whether its era parser accepts WebKit's `Before Hijra` spelling is untested) or WebKit prints the year as V8 does. D18 names `engines: ["webkit"]` (`scripts/lib/workarounds.mjs`), so WebKit is the only engine in its scope; `pnpm compat` and the Chromium and Firefox checks report it out of scope, never removable. Expected values are Node 26.12.1's native Temporal |
| D19 | A js-temporal release whose TimeZoneEquals finds the primary identifier on a host whose `Intl.DateTimeFormat#resolvedOptions` returns the identifier as written (the Time Zone Canonicalization proposal's rule, which JavaScriptCore applies today): the weekly `temporal-oracle` run's compat check in WebKit (`temporal-compat-webkit`) reports D19 removable once the `D19` probe (`Etc/UTC` equals `UTC`) passes there. D19 names `engines: ["webkit"]` (`scripts/lib/workarounds.mjs`), so `pnpm compat` and the Chromium and Firefox checks report it out of scope, never removable; a failing probe on any engine still keeps it. Widen `engines` when another engine keeps the identifier as written. The expected value is the pair ECMA-402 §6.5 fixes, so GMT owns no time zone data |
| zoned.A | A js-temporal release contains `05ce7a3` (maximum) **and** `95237e0` (minimum), both on main. `05ce7a3` alone fixes only the `max.*` probes: a 0.5.1 build with just that commit still throws for every `min.*` probe |
| zoned.B | A js-temporal release fixes `GetNamedTimeZoneNextTransition` near the maximum. Not fixed on main; the verified patch is in bug doc § B |
| zoned.D | A js-temporal release ports proposal-temporal #3205 (`d90d432`), which validates the `"UTC"` fast path of `GetPossibleEpochNanoseconds` (bug doc § D) |
| zoned.E | A js-temporal release contains js-temporal/temporal-polyfill#372 (tc39/proposal-temporal#3330): transition searches no longer floored at `BEFORE_FIRST_DST` = 1847-01-01 (bug doc § E) |

In every case the fix must be in the release that becomes GMT's `@js-temporal/polyfill` floor
(D4: GMT's `engines.node` floor). Check with `pnpm compat`: a probe passes when
`runRepro(repro) === repro.expected`.

## Removal steps

1. **D1:** delete the `D1` entries in `probeRepros.ts`, the D1 term of `needsFieldSearch` in
   `calendarDateFromFields.ts`, and the D1 fallbacks in `calendarDateArithmetic.ts` (the `catch`
   branch of `calendarDateAdd`, and the D1 term of `untilWorkaroundNeeded`). When no range guard is
   left (see D2–D5), delete `fieldSearch.ts` + test. `calendarDateFromFields` then becomes
   `Temporal.PlainDate.from({ ...fields, calendar: calendarId }, { overflow })`.
2. **D2:** delete `buddhistFields`' arithmetic branch, the buddhist case of `hasReadCorrection`,
   `usesIsoArithmetic` in `calendarDateArithmetic.ts`, and the `D2` repros.
3. **D3 + D4:** delete `hebrewArithmetic.ts` + test, `hebrewFields`' arithmetic branch, the hebrew
   case of `hasReadCorrection` and of `ownedModels`, and the `D3`/`D4` repros.
4. **D5:** delete `indianArithmetic.ts` + test, `indianFields`' arithmetic branch, the indian case of
   `hasReadCorrection` and of `ownedModels`, and the `D5` repros. Delete `fixedDay.ts` once neither
   arithmetic file uses it.
5. **D6 + D7:** delete the `D6`/`D7` repros and their terms in `calendarDateArithmetic.ts`
   (`verifiedPolyfillUntil` then returns the polyfill's result unless D1 applies).
6. **When D1, D2, D3–D5, D6 and D7 are all removed:** delete `nonIsoArithmetic.ts`,
   `readArithmeticModel.ts` and their test; `calendarDateAdd` becomes `date.add(duration,
   { overflow })` and `calendarDateUntil` the date fields of `one.until(two, { largestUnit })`.
   `isCalendarArithmeticCompatNeeded` is then false for every calendar, so the whole-operation
   seams above are dormant. To delete them: remove `addWithCalendarCompat` and its two calls in
   `zonedWallClockOperations.ts`; the `isCalendarArithmeticCompatNeeded` block in `zonedUntil` and
   the `calendar*BySpec` calls in `durationTotal`, `durationRound` and `durationCompare` in
   `zonedWallClockDifference.ts` (the plain-context section can go too once nothing calls it); the
   `isCalendarArithmeticCompatNeeded` branch in `plainDateUntil.ts`; and `needsCalendarCompat` with
   its `*WithCompat` / `wallClockUntil` / `addOneUnit` / `truncatedWallClockUntil` helpers in
   `zonedBucket.ts`. Delete `isCalendarArithmeticCompatNeeded` and the `D1.relativeTo` repro last.
7. **D8:** delete `japaneseFields`' remap, `PRE_PROPOSAL_ERAS`, and the `D8` repros.
8. **zoned.A / zoned.B / zoned.D / zoned.E:** follow the removal notes in the headers of
   `internal/zonedWallClock.ts`, `internal/zonedWallClockOperations.ts` and
   `internal/zonedWallClockDifference.ts` (zoned.A: the defect-1 fallbacks and the `*AtLimit`
   fallbacks; zoned.B: the defect-2 transition fallback; zoned.D: `checkUtcValidity` and its call
   in `runAtRangeLimit`; zoned.E: the defect-3 pre-1847 checks — `missedNextTransition`,
   `missedPreviousTransition`, `isBeforePolyfillTransitionSearch` and their gates, with
   `zonedPreviousTransition` reduced to the plain polyfill call), then delete that group's repros
   and its group in `scripts/temporal-compat.mjs`. Run `internal/zonedWallClock*` tests (and, for
   zoned.E, the test files with a `zoned.E` describe block): no expected value changes.
9. **D9:** delete `largeMonthSpan.ts`, its two calls in `readArithmeticModel.ts` (`addMonths`,
   `monthsBetween`), the two D9 branches in `calendarDateArithmetic.ts`, and the `D9` repros with
   `withBoundedIntlReads`. Keep `largeMonthArithmetic.test.ts`: its rows are spec values that must
   still pass in bounded time.
10. **D10:** delete the `D10` repros, the D10 term of `needsFieldSearch` in
   `calendarDateFromFields.ts`, the D10 terms in `calendarDateArithmetic.ts` (`calendarDateAdd`'s
   `catch`, `untilWorkaroundNeeded`) and `D10` in `ARITHMETIC_DEFECTS`. Keep the non-`RangeError`
   fallbacks: they cost nothing on a correct runtime.
11. **D11:** delete the `D11` repros, `isNudgeWindowCompatNeeded` in `capabilities.ts` and its
   export in `index.ts`, and the defect-4 terms in `internal/zonedWallClockDifference.ts`
   (`monthTotalBySpec`, `monthRoundBySpec`, the `zonedUntil` gate, `plainUntilWithRounding`) and in
   `internal/plainDateUntil.ts`, so all three operations are the polyfill's again. Keep
   `test/nudgeWindowRetry.test.ts` and `test/intervalLengthOracle.test.ts`: their values are the
   spec's either way. Keep the `progress === 0n` branch in `nudgeToCalendarUnit` — that is GMT's own
   fix, not the polyfill's, and `Duration.compare` needs no gate (256 rows against Chromium 153,
   0 mismatches: it reaches no nudge window).
12. **D12:** delete `matchSecondsOffsetExactly` and its call in `zonedDateTimeFrom`
   (`internal/zonedWallClock.ts`, with defect 4 in that file's header note),
   `isSecondsOffsetMatchCompatNeeded` in `capabilities.ts` and its export in `index.ts`, and the
   `D12` repros. `zonedDateTimeFrom`'s `try` returns the polyfill call again. Keep
   `resolveDurationRelativeTo` reading a zoned string through `zonedDateTimeFrom` (the range-limit
   fallbacks need it too) and
   `test/secondsOffsetMatch.test.ts`: its values are test262's and hold either way.
13. **D13:** delete `internal/zonedTransitionSearch.ts` (its per-zone transition memo goes with it,
   and so do the `the transition memo` and `the transition memo at its edges` blocks in its test)
   and the `isTransitionSearchCompatNeeded` branches of `zonedNextTransition` and
   `zonedPreviousTransition` (`internal/zonedWallClockOperations.ts`), which then return the
   polyfill path filtered by the caller's limit; `isMidnightSkipped` and the D13 terms of
   `needsOwnStartOfDaySearch` and `needsOwnDayBoundsSearch` (`internal/zonedWallClock.ts`, with
   defect 5 in that file's header note); `isTransitionSearchCompatNeeded` in `capabilities.ts` and
   its export in `index.ts`; and the `D13` repros with `withBoundedOffsetReads`. Keep the limit
   arguments at the call sites: they cost nothing. In `internal/zonedTransitionSearch.test.ts`
   delete only the step guard; keep its rows and every `America/Boa_Vista`, `Europe/Riga` and
   `Europe/Simferopol` row in the public test files: their values are native Temporal's and hold
   either way.
14. **D14:** delete the probe-gated routing: the `isDayRoundClampCompatNeeded()` term in the day branch of `roundZonedDateTime` (`internal/zonedWallClockOperations.ts`; the branch itself stays for the D13 and pre-1847 cases), `isDayRoundClampCompatNeeded` in `capabilities.ts` and its export in `index.ts`, and the `D14` repros. Keep the `min(thisNs, endNs - 1)` clamp in `roundToDayFromOwnStartOfDay`: it is the spec step, and the D13, pre-1847 and range-edge paths use it. Keep the same-date-starts-twice rows in `roundZoned.test.ts` and `roundUnix.test.ts`: their values are test262's and hold either way.
15. **D15:** delete `zExactOptions` and its call in `zonedDateTimeFrom` (`internal/zonedWallClock.ts`, with defect 6 in that file's header note), `UTC_DESIGNATOR`, `isZIgnoreExactCompatNeeded` in `capabilities.ts` and its export in `index.ts`, and the `D15` repros. Keep the `Z` rows in `zonedWallClock.test.ts` and `calendarValueOfZoned.test.ts`, and the all-16-cells row in `classifyStoredZoned.test.ts`: their values are the specification's and hold either way.
16. **D16:** delete the `zoneNames` branch of `rangeWithRepairedParts` (the `timeZoneName` entry in its type list) and its gate in `zoned/format/formatZonedRange.ts`, `isRangeZoneNameCompatNeeded` in `capabilities.ts` and its export in `index.ts`, and the `D16` repros. Keep every `formatZonedRange` row: their values are the field formats and hold either way.
17. **D17:** delete the `dayPeriods` branch of `rangeWithRepairedParts` (the `dayPeriod` entry in its type list) and its gate in `zoned/format/formatZonedRange.ts`, `isRangeDayPeriodCompatNeeded` in `capabilities.ts` and its export in `index.ts`, and the `D17` repros. Keep every `formatZonedRange` row and the `D17` rows of `internal/repairRangeParts.test.ts`: the values are the requested forms and hold either way (delete `repairRangeParts` only with the last of D16 and D17).
18. **D18:** delete `islamicEra.ts`, `fixedMonthArithmetic.ts` and their tests, `islamicFields`, `ISLAMIC_CALENDARS`, `polyfillMisreadsIslamicEra` and `polyfillCannotReturn` in `calendarFields.ts` (the `default` case of `calendarFieldsOf` returns the runtime read and the `default` case of `hasReadCorrection` returns false), the D18 branch at the top of `calendarDateFromFields` and the D18 term of `needsFieldSearch`, `fixedMonthsIfPolyfillCannotReturn` and its two uses in `readArithmeticModel.ts`, `reachesPolyfillLimit`, `lowestYearOfSum` and their two branches in `calendarDateArithmetic.ts`, `fixedMonthsPerYearOf` in `largeMonthSpan.ts`, and the `D18` repros. Keep every Islamic row of `diffDateAsDuration.edges.test.ts` and `addDate.edges.test.ts`: the values are the spec's and hold either way.
19. **D19:** delete `temporalCompat/timeZoneEquals.ts` and its exports in `index.ts`, `isTimeZoneEqualsCompatNeeded` in `capabilities.ts` and its export in `index.ts`, and the `D19` repro; `isCalendarDifferenceAcrossZones` (`internal/zonedWallClockDifference.ts`) compares with `new Temporal.ZonedDateTime(0n, id).equals(...)` again. Keep every `diffZoned`, `diffZonedAsDuration` and `intervalLengthZoned` row: the values are TimeZoneEquals answers and hold either way.
20. **After every step:** run the calendar test files (`plain/convert`, `zoned/convert`,
   `plain/validate/isValidCalendarDate`, `plain/calculate/{addDate,subtractDate,diffDate,diffDateAsDuration}`,
   `plain/interval/{intervalLengthDate,intervalCountDate,intervalFromDurationDate,splitIntervalByUnitDate}`,
   `zoned/calculate/{addZoned,subtractZoned,diffZoned,diffZonedAsDuration}`,
   `zoned/interval/{intervalLengthZoned,intervalCountZoned,splitIntervalByUnitZoned}`,
   `duration/{normalize/normalizeDuration,calculate/totalDuration,compare/compareDurations}`,
   `internal/zonedWallClock*`, `internal/calendarDateString`, `internal/temporalCompat`). No
   expected value changes. When nothing
   is left, `calendarFieldsOf` is `date.withCalendar(calendarId)`'s fields. Keeping `index.ts` as a
   thin facade costs nothing.
