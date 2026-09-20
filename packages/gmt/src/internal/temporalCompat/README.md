# temporalCompat — calendar workarounds for `@js-temporal/polyfill` and the runtime's ICU

GMT always imports `@js-temporal/polyfill`. For non-ISO calendars, polyfill 0.5.1 and Node's ICU4C
return wrong fields, or throw, for some in-range dates. This directory makes those answers match
TC39 Temporal and the Intl era/monthCode proposal. It also lets each workaround be deleted once
upstream ships the fix. The upstream filings for these defects, and their status, are tracked on the
docs site at `/upstream/` (data: `apps/dox/src/data/upstream-filings.json`).

Design: `context/domination/specs/CORE-6-calendar-correctness-spec.md`. Owner decisions:
`context/domination/research/calendar-standards-decisions.md`.

## Rules

1. **Import surface.** `index.ts` is the only import surface. Call sites use `calendarDateFromFields`,
   `calendarFieldsOf`, `calendarDateAdd`, `calendarDateUntil` and `isCalendarArithmeticCompatNeeded`,
   never the files behind them.
2. **Dormant unless needed.** Each defect has a repro in `repros.ts`, probed lazily in
   `capabilities.ts`: once per process, per calendar, memoized. If the installed runtime passes, that
   workaround never runs. When a probe fails, a per-call guard (a range check, a polyfill throw, a
   failed read-back, or a result that is not the spec's) decides whether this call needs it.
   `iso8601` values always pass straight through.
3. **Same answer after removal.** Every workaround computes the spec's answer, so deleting it on a
   fixed runtime changes no output and no test row. If a row would have to change, the workaround was
   wrong.
4. **`repros.ts` imports only the polyfill.** A canary script can then load the compiled file from
   `dist`.
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

Fields → ISO (`calendarDateFromFields`): asks the polyfill first. It keeps the result when the fields
read back unchanged through `calendarFieldsOf`. Otherwise, inside a D1 window or a corrected read
range, the field search answers over the corrected reads. Since 1.16.0 (CORE-8) GMT's calendar strings are
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
| D11 | A js-temporal release ports proposal-temporal #3172 (`5dd0b0d97ee1`, merged 2025-11-19 — the fix for tc39/proposal-temporal#3168), so the nudge window is retried. Not on js-temporal `main` either, so a release alone will not do it |
| zoned.A | A js-temporal release contains `05ce7a3` (maximum) **and** `95237e0` (minimum), both on main. `05ce7a3` alone fixes only the `max.*` probes: a 0.5.1 build with just that commit still throws for every `min.*` probe |
| zoned.B | A js-temporal release fixes `GetNamedTimeZoneNextTransition` near the maximum. Not fixed on main; the verified patch is in bug doc § B |
| zoned.D | A js-temporal release ports proposal-temporal #3205 (`d90d432`), which validates the `"UTC"` fast path of `GetPossibleEpochNanoseconds` (bug doc § D) |
| zoned.E | A js-temporal release contains js-temporal/temporal-polyfill#372 (tc39/proposal-temporal#3330): transition searches no longer floored at `BEFORE_FIRST_DST` = 1847-01-01 (bug doc § E) |

In every case the fix must be in the release that becomes GMT's `@js-temporal/polyfill` floor
(D4: GMT's `engines.node` floor). Check with `pnpm compat`: a probe passes when
`runRepro(repro) === repro.expected`.

## Removal steps

1. **D1:** delete the `D1` entries in `repros.ts`, the D1 term of `needsFieldSearch` in
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
12. **After every step:** run the calendar test files (`plain/convert`, `zoned/convert`,
   `plain/validate/isValidCalendarDate`, `plain/calculate/{addDate,subtractDate,diffDate,diffDateAsDuration}`,
   `plain/interval/{intervalLengthDate,intervalCountDate,intervalFromDurationDate,splitIntervalByUnitDate}`,
   `zoned/calculate/{addZoned,subtractZoned,diffZoned,diffZonedAsDuration}`,
   `zoned/interval/{intervalLengthZoned,intervalCountZoned,splitIntervalByUnitZoned}`,
   `duration/{normalize/normalizeDuration,calculate/durationAs,compare/compareDurations}`,
   `internal/zonedWallClock*`, `internal/calendarDateString`, `internal/temporalCompat`). No
   expected value changes. When nothing
   is left, `calendarFieldsOf` is `date.withCalendar(calendarId)`'s fields. Keeping `index.ts` as a
   thin facade costs nothing.
