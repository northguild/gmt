# temporalCompat — workarounds for `temporal-polyfill` and the runtime's ICU

GMT imports `temporal-polyfill` (1.0.8, through `temporal-polyfill/full/implementation`). This
directory holds the few places where that polyfill, or the ICU of the engine GMT runs on, still
differs from TC39 Temporal and ECMA-402. Each workaround computes the spec's answer, stays dormant
where the runtime is right, and is deleted once upstream ships the fix. The upstream filings for these
defects, and their status, are tracked on the docs site at `/upstream/` (data:
`apps/dox/src/data/upstream-filings.json`).

Decisions: `context/domination/specs/CORE-108/workarounds.md`. The defects earlier GMT versions
worked around on the previous polyfill (calendar arithmetic near the range limits, the Hebrew,
Indian, Buddhist, Japanese and Islamic reads, the nudge window, the transition search, `Temporal.Now`
before 1970 and the rest) are gone: every repro for them passes on `temporal-polyfill` 1.0.8.

## Rules

1. **Import surface.** `index.ts` is the only import surface. Call sites use `calendarDateAdd`,
   `calendarDateUntil`, `calendarDateFromMonthCode`, `longestDayOfMonthCode`, `calendarFieldsOf`,
   `assertMonthsInRange`, `MAX_MONTHS_IN_RANGE`, `isNudgeOriginCompatNeeded`,
   `isRangeZoneNameCompatNeeded`, `isRangeDayPeriodCompatNeeded`, `isTimeZoneEqualsCompatNeeded`,
   `timeZoneEquals` and `timeZoneEqualsByHost`, never the files behind them.
2. **Dormant unless needed.** Each defect has a repro in `probeRepros.ts` (or, for the canary-only
   `D9` group, `repros.ts`), probed lazily in `capabilities.ts`: once per process, memoized. If the
   installed runtime passes, that workaround never runs. A guard that fires only where the spec throws
   (`assertMonthsInRange`) is always on: its answer is the spec's, and a probe would cost what it
   saves. When a probe fails, a per-call check decides whether this call needs the workaround.
3. **Same answer after removal.** Every workaround computes the spec's answer, so deleting it on a
   fixed runtime changes no output and no test row. If a row would have to change, the workaround was
   wrong.
4. **`repros.ts` and `probeRepros.ts` import only the polyfill**, through `../temporal` (`repros.ts`
   also imports `probeRepros.ts`). A canary script can then load the compiled file from `dist`. A
   repro the shipped probes do not read lives in `repros.ts`, which no shipped module imports.
5. **Tests never mock Temporal or force a probe.** Public rows assert spec values that hold either
   way.
6. **The probe cache is process-global.** It never goes stale because the polyfill is imported once.

## Workarounds

| Defect | What goes wrong (temporal-polyfill 1.0.8 + Node 26 / ICU 78.3) | Where | When it runs |
|---|---|---|---|
| **D9** | An out-of-range non-ISO month amount throws only after work linear in the amount. In range, `temporal-polyfill` 1.0.8 adds and counts months in bounded work. For an amount past the date range it throws RangeError, as TC39 does, but only after that linear work (hebrew `{ months: 4294967295 }`: about 5 s). Years and reads are O(1). Every non-ISO calendar. | `monthRange.ts` (`assertMonthsInRange`), called from the helpers listed in its header (`calendarDateAdd` here, `addToZoned`, `subtractFromZoned`, `durationTotal`, `durationRound`, `durationCompare`, `moveYearMonth` and the rest of its call-site table) | `\|months\| > MAX_MONTHS_IN_RANGE` (7,365,462), always on; no capability probe, only the canary repro |
| **D16** | ICU-20548: `DateIntervalFormat` drops the `timeZoneName` width in a range. V8 and JSC print `long` and `longGeneric` as short names ("EST", "ET") and drop `shortOffset` and `longOffset` (no `timeZoneName` part at all), where UTS #35 (Matching Skeletons) expects "fields in the skeleton and pattern ... to be adjusted in parallel" and ECMA-402 §11.5.8 builds each range part with FormatDateTimePattern over the range pattern's own fields. The ICU skeleton code (`getDateTimeSkeleton`) drops `O` and cuts `zzzz` and `vvvv` to `z` and `v`. Seen on Node 22.22.2 (ICU 78.2), 24.21.0 and 26.12.1 (ICU 78.3), Chromium 153 and WebKit 26.6; Firefox 155 carries `intl/icu-patches/bug-1856290-ICU-20548-dateinterval-timezone.diff` and is right. Not a calendar defect: any locale and zone, only `Intl.DateTimeFormat#formatRange`. | `internal/repairRangeParts.ts` (the part merge), called by `zoned/format/formatZonedRange.ts` for the zone name branch, gated by `isRangeZoneNameCompatNeeded(style)` | A `formatZonedRange` call with `timeZoneName` `long`, `longGeneric`, `shortOffset` or `longOffset`, while the probe for that style fails. It formats the range with `short`, and writes the requested names (from `formatToParts` of each endpoint) into the zone parts. No `timeZoneName`, `short` and `shortGeneric` pass straight through |
| **D17** | SpiderMonkey (Firefox 155) `formatRange` writes the AM/PM day period where `dayPeriod` asks for a flexible one ("10 AM GMT-5 – 12 PM GMT-5" for 10:00 to 12:00 in New York with `{ hour, dayPeriod: "short", timeZoneName: "shortOffset" }`), when `timeZoneName` is set and neither `hourCycle` nor `hour12` is. Its single format is right ("10 in the morning GMT-5", "12 noon GMT-5"). Not a width rule (UTS #35 treats a, b and B as close matches): ECMA-402 §11.5.8 picks the range pattern by the resolved [[HourCycle]] only, en-US resolves to h12 with or without `hourCycle: "h12"`, yet only the explicit one prints the flexible period. It happens with `short`, `long` and the offset zone styles, with and without minutes, and not with no `timeZoneName`, `hourCycle: "h12"` or `hour12: true`. An affected range always prints each endpoint whole (`startRange` and `endRange` parts, never a shared `dayPeriod`). V8 and JSC are right. Not a calendar defect. Filed as [Bugzilla 2085525](https://bugzilla.mozilla.org/show_bug.cgi?id=2085525); engine record Q in the bug doc. | `internal/repairRangeParts.ts` (the part merge), called by `zoned/format/formatZonedRange.ts` for the day period branch, gated by `isRangeDayPeriodCompatNeeded()` | A `formatZonedRange` call with `dayPeriod` and `timeZoneName`, while the probe fails. It replaces each day period part with the endpoint's single-format day period. Everything else passes straight through |
| **D19** | `ZonedDateTime#equals` answers false for two identifiers of one time zone on a host whose `Intl.DateTimeFormat#resolvedOptions` returns the identifier as written. The polyfill's `GetAvailableNamedTimeZoneIdentifier` finds a primary identifier in `Intl.supportedValuesOf("timeZone")` and takes a non-primary identifier's primary from `resolvedOptions().timeZone`. ECMA-262 TimeZoneEquals compares the two [[PrimaryIdentifier]]s, and ECMA-402 §6.5 (Time Zone Identifiers) fixes `"UTC"` as primary with `"Etc/UTC"`, `"Etc/GMT"` and `"GMT"` resolving to it; the IANA backward links (`Asia/Calcutta` → `Asia/Kolkata`) are the rest. JavaScriptCore (WebKit 26.6 in Playwright, Safari 27) keeps the identifier as written, the rule of the Stage 3 Time Zone Canonicalization proposal, so there the polyfill compares `Etc/UTC` with `UTC` and `Asia/Calcutta` with `Asia/Kolkata` and answers false, and `diffZoned` and `intervalLengthZoned` refuse a calendar unit across the pair. V8 and SpiderMonkey return the primary identifier and are right; native WebKit `Temporal` is right. Not a calendar defect: any pair of identifiers of one zone. Polyfill record U in the bug doc, not filed yet. | `temporalCompat/timeZoneEquals.ts`, called by `zonedUntil` (the end is read in the start's identifier before `until`, which the polyfill rejects with "Mismatching TimeZones" across two identifiers of one zone) and by `isCalendarDifferenceAcrossZones` (`internal/zonedWallClockDifference.ts`) for `diffZoned`, `diffZonedAsDuration` and `intervalLengthZoned`, gated by `isTimeZoneEqualsCompatNeeded()` | Two different identifiers while the probe fails: GMT resolves `Etc/UTC`, `Etc/GMT` and `GMT` to `UTC` by name (ECMA-402 §6.5, on every host, Safari 27 included), then asks the host's own `Temporal.ZonedDateTime#equals` when `globalThis.Temporal` exists (WebKit 26.6). On a host without `Temporal` (Safari 27) the polyfill's answer stands for any other pair, so the IANA links (`Asia/Calcutta`, `Etc/UCT`) stay two zones there: resolving a link needs IANA data that no Intl API exposes (bug doc § U). Equal identifiers, and every pair while the probe passes, go straight through |
| **D22** | A zoned `relativeTo` or start in a repeated hour has no value in TC39 for some lengths, and `temporal-polyfill` 1.0.8 answers one. TC39 `ComputeNudgeWindow` takes the window's start from the origin's own exact time when no date unit has been added (tc39/ecma262#3759), and `DifferenceZonedDateTime` subtracts the exact times when both fall on one local date; 1.0.8 gets these right (the `D22` repros for the later pass, the earlier pass and a week with no start days pass). Where a TC39 Assert fails no value exists (tc39/proposal-temporal#3336), and 1.0.8 answers one anyway: `PT24H30M` from `2024-11-02T01:30:00-04:00[America/New_York]` in days totals `1.02` on 1.0.8, where GMT returns its sentinel (`null`), and a skipped hour reaches the same Assert (`-PT23H20M` from `2024-03-11T02:30:00-04:00[America/New_York]` in days is `null`). The `totalsWithNoValue` and `noDayCorrection` repros fail on 1.0.8. Bug doc § AC. | `internal/zonedDifference/nudgeOrigin.ts`, called from `durationTotal`, `durationRound` and the repeated-hour term in `untilTakesSpecPath` (`internal/zonedWallClockDifference.ts`) | A date unit (`total`) or date `largestUnit` (`round`, `until`) when the origin or the target names two instants, or the target is earlier and a window's end bound falls in a gap, while the probe fails |

Engine scope. D16 is judged on every engine: it is removable only when Node, Chromium, Firefox and
WebKit all pass. D17 is a Firefox defect and is judged on Firefox only; D19 is a WebKit defect and is
judged on WebKit only. Elsewhere their probes pass because the defect is not there, which proves
nothing, so `pnpm compat` reports them `OUT OF SCOPE`, never removable.

The `D22` port lives in `internal/zonedDifference/nudgeOrigin.ts` and `operations.ts`: TC39's
`ComputeNudgeWindow`, `DifferenceZonedDateTime` and the Asserts that give no value.

## Canary and native oracle

`repros.ts` also carries the canary-only `D9` repro, which times how long a hebrew `2024-01-15` +
40,000,000 months and + 400,000,000 months take to throw. It prints timings, so its output differs
between runs.

- **`pnpm compat`** (`scripts/temporal-compat.mjs check`, needs `pnpm build`): prints the installed
  polyfill, Node and ICU versions, then one line per repro, `STILL NEEDED (<output>)`,
  `REMOVABLE (returns spec value)` or, for a group that names `engines` the run is not on,
  `OUT OF SCOPE (returns spec value)`, grouped by workaround with its removal trigger. When every
  probe of a group passes it prints that group's removal steps. It always exits 0;
  `--fail-on-removable` exits 1 when a whole group is removable, for a manual release checklist only.
  Run it on every polyfill or Node upgrade.
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
| D9 | A temporal-polyfill release throws for an out-of-range month amount in bounded time: the `D9` probe has hebrew `2024-01-15` + 40,000,000 months throw in at most 5,000 ms (an absolute ceiling that fails the repro at once), and + 400,000,000 months throw in under 3 × the time of + 40,000,000 months + 10 ms |
| D16 | An ICU release that fixes ICU-20548 is bundled by GMT's `engines.node` floor (`>=22.16.0`) and by every browser the native suite runs, so every `D16` repro passes on every engine (the range's zone name equals the single format's for all six styles). `pnpm compat` reports Node; the weekly `temporal-oracle` run runs the same probes in Chromium, Firefox and WebKit (`scripts/lib/native-suite-compat.mjs`, one `temporal-compat-<leg>` verdict each) and files the removal issue only when every engine says removable. The expected value is a self-comparison, so GMT owns no CLDR string |
| D17 | The weekly `temporal-oracle` run's compat check in Firefox (`temporal-compat-firefox`) reports D17 removable: every `D17` repro passes in the Firefox the native suite runs, once Firefox prints the flexible day period in a range (Bugzilla 2085525). D17 names `engines: ["firefox"]` (`scripts/lib/workarounds.mjs`), so Firefox is the only engine in its scope; `pnpm compat` and the Chromium and WebKit checks report it out of scope, never removable. The expected value is a self-comparison, so GMT owns no CLDR string |
| D19 | A temporal-polyfill release whose TimeZoneEquals finds the primary identifier on a host whose `Intl.DateTimeFormat#resolvedOptions` returns the identifier as written (the Time Zone Canonicalization proposal's rule, which JavaScriptCore applies today): the weekly `temporal-oracle` run's compat check in WebKit (`temporal-compat-webkit`) reports D19 removable once the `D19` probe (`Etc/UTC` equals `UTC`) passes there. D19 names `engines: ["webkit"]` (`scripts/lib/workarounds.mjs`), so `pnpm compat` and the Chromium and Firefox checks report it out of scope, never removable; a failing probe on any engine still keeps it. Widen `engines` when another engine keeps the identifier as written. The expected value is the pair ECMA-402 §6.5 fixes, so GMT owns no time zone data |
| D22 | A temporal-polyfill release on which every `D22` repro passes, including `totalsWithNoValue`, `noDayCorrection` and `emptyDaySpan`, where TC39 gives no value (tc39/proposal-temporal#3336, #3311, #3310) and 1.0.8 answers one. The repros are samples of each shape, so `test/noSpecValue.test.ts` and `test/laterPassOrigin.test.ts` must also pass on the release (bug doc § AC) |

In every case the fix must be in the release that becomes GMT's `temporal-polyfill` floor (D16: GMT's
`engines.node` floor). Check with `pnpm compat`: a probe passes when `runRepro(repro) === repro.expected`.

## Removal steps

9. **D9:** delete `monthRange.ts` and `monthRange.test.ts`, its exports in `index.ts`, its calls (`calendarDateAdd` in `calendarDateArithmetic.ts`, `addToZoned` and `subtractFromZoned` in `zonedWallClockOperations.ts`, `durationTotal`, `durationRound` and `durationCompare` in `zonedWallClockDifference.ts`, and the others in the `monthRange.ts` header's call-site table), and the `D9` repro with `millisecondsToThrow` in `repros.ts`. Keep `largeMonthArithmetic.test.ts`: its rows are spec values that must still pass, in bounded time, on the fixed polyfill.
16. **D16:** delete the `zoneNames` branch of `rangeWithRepairedParts` (the `timeZoneName` entry in its type list) and its gate in `zoned/format/formatZonedRange.ts`, `isRangeZoneNameCompatNeeded` in `capabilities.ts` and its export in `index.ts`, and the `D16` repros. Keep every `formatZonedRange` row: their values are the field formats and hold either way.
17. **D17:** delete the `dayPeriods` branch of `rangeWithRepairedParts` (the `dayPeriod` entry in its type list) and its gate in `zoned/format/formatZonedRange.ts`, `isRangeDayPeriodCompatNeeded` in `capabilities.ts` and its export in `index.ts`, and the `D17` repros. Keep every `formatZonedRange` row and the `D17` rows of `internal/repairRangeParts.test.ts`: the values are the requested forms and hold either way (delete `repairRangeParts` only with the last of D16 and D17).
19. **D19:** delete `temporalCompat/timeZoneEquals.ts` and its exports in `index.ts`, `isTimeZoneEqualsCompatNeeded` in `capabilities.ts` and its export in `index.ts`, and the `D19` repro; `isCalendarDifferenceAcrossZones` (`internal/zonedWallClockDifference.ts`) compares with `new Temporal.ZonedDateTime(0n, id).equals(...)` again, and `zonedUntil` calls `one.until(two, options)` without reading `two` in `one`'s identifier first. Keep every `diffZoned`, `diffZonedAsDuration` and `intervalLengthZoned` row: the values are TimeZoneEquals answers and hold either way.
22. **D22:** delete the `D22` repros in `probeRepros.ts` (and `"D22"` in `DefectId`),
   `isNudgeOriginCompatNeeded` in `capabilities.ts` and its export in `index.ts`, and `internal/zonedDifference/nudgeOrigin.ts` and its three calls in
   `internal/zonedWallClockDifference.ts` (the `origin*BySpec` operands in `durationTotal` and
   `durationRound`, the repeated-hour term in `untilTakesSpecPath`), and `possibleEpochNanoseconds`'
   export from `internal/zonedWallClock.ts`. Also delete `readOrNone` in `probeRepros.ts` and its
   tests in `capabilities.test.ts`, `WHAT_BREAKS.D22` in `apps/dox/src/data/temporal-compat.ts` and
   the D22 entry in `scripts/lib/workarounds.mjs`: nothing fails if these stay behind. Keep the
   throws in `nudgeToCalendarUnit`, `differenceZonedDateTime`, `combineDateAndTimeDuration` and
   `nudgeToZonedTime` (in `internal/zonedDifference/operations.ts`): they are this port's own Asserts. Then drop the imports and locals tsc reports unused, and the `internal/zonedDifference/operations.ts` exports fallow reports unused.
   Keep `test/laterPassOrigin.test.ts`, `test/noSpecValue.test.ts` and the later-pass rows in
   `internal/lengthFromNow.test.ts`. Their values are the specification's, but a release can
   pass every repro and still answer a value on a length the repros do not try. Run these files on
   the release first, with the probe passing and so the gate off. If a row fails, D22 stays. If
   tc39/proposal-temporal#3336, #3311 or #3310 gives these lengths a value instead, the rows, the
   throws and the repros change together.
23. **After every step:** run the calendar test files (`plain/convert`, `zoned/convert`,
   `plain/validate/isValidCalendarDate`, `plain/calculate/{addDate,subtractDate,diffDate,diffDateAsDuration}`,
   `plain/interval/{intervalLengthDate,intervalCountDate,intervalFromDurationDate,splitIntervalByUnitDate}`,
   `zoned/calculate/{addZoned,subtractZoned,diffZoned,diffZonedAsDuration}`,
   `zoned/interval/{intervalLengthZoned,intervalCountZoned,splitIntervalByUnitZoned}`,
   `duration/{normalize/normalizeDuration,calculate/totalDuration,compare/compareDurations}`,
   `internal/zonedWallClock*`, `internal/calendarDateString`, `internal/temporalCompat`). No
   expected value changes. The step numbers 9, 16, 17, 19 and 22 are cited from
   `scripts/lib/workarounds.mjs`; keep them.
