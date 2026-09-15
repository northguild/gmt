# temporalCompat — calendar workarounds for `@js-temporal/polyfill` and the runtime's ICU

GMT always imports `@js-temporal/polyfill`. For non-ISO calendars, polyfill 0.5.1 and Node's ICU4C
return wrong fields, or throw, for some in-range dates. This directory makes those answers match
TC39 Temporal and the Intl era/monthCode proposal. It also lets each workaround be deleted once
upstream ships the fix.

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

Parse path: `calendarDateFromFields` asks the polyfill first. It keeps the result when the fields
read back unchanged through `calendarFieldsOf`. Otherwise, inside a D1 window or a corrected read
range, the field search answers over the corrected reads.

Arithmetic path (`calendarDateAdd`, `calendarDateUntil`): `iso8601` is the polyfill. Weeks and days
are ISO day arithmetic. In a corrected range the spec algorithms run over ISO (buddhist) or the owned
Hebrew and Indian models. Otherwise the polyfill answers first: an add is kept unless it throws near a
limit (D1); an until is kept unless it throws or, while D6/D7 are present, is not the spec's result.
The spec algorithms (`NonISODateAdd`, `ConstrainMonthCode`, `NonISODateSurpasses`, `NonISODateUntil`)
live in `nonIsoArithmetic.ts`, over an integer model:

- `readArithmeticModel.ts` answers from reads, `calendarDateFromFields` and the polyfill's own month
  arithmetic between day-1 dates (never constrained, so correct wherever it does not throw), stepping
  month by month through the field search next to a limit. It owns no calendar rule: the leap month a
  missing `M05L` constrains to is read from the polyfill at a modern year.
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

Not a workaround: `;era=japanese` is GMT's own deprecated input alias of `ce`. It is mapped in
`internal/calendarDateString.ts`, stays until the next major, and does not depend on the polyfill.

## Canary and native oracle

`repros.ts` also carries the zoned range-limit repros of `internal/zonedWallClock*` (`zoned.A`,
`zoned.B`, `zoned.D`, upstream issue drafts A, B and D). They are canary-only: no capability probe
gates those fallbacks, which already run only when the polyfill throws or returns an unchecked UTC
value. Draft C (calendar fields near the limits) is the `D1` group.

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
| D1 | A js-temporal release ports proposal-temporal `a41eb67` (+ `af0cb4b`, + a clamp of the bisection step if it proves reachable) and becomes GMT's floor |
| D2 | A js-temporal release contains `2bb6ba1` (already on main) |
| D3 + D4 | **Both** hold: a js-temporal release ports proposal-temporal `0df570c`, **and** GMT's `engines.node` floor bundles an ICU containing `5267bb5778` (ICU-23007) |
| D5 | A js-temporal release ports proposal-temporal `314b112` |
| D6 | A js-temporal release contains `10aeb98` (already on main) |
| D7 | A js-temporal release ports proposal-temporal `0e32ee0` |
| D8 | A js-temporal release contains `2bb6ba1` |
| zoned.A | A js-temporal release contains `05ce7a3` **and** a separate fix for the minimum edge. `05ce7a3` fixes only the `max.*` probes: a 0.5.1 build with it applied still throws for every `min.*` probe, so the maximum alone never retires this group |
| zoned.B | A js-temporal release fixes `GetNamedTimeZoneNextTransition` near the maximum (draft B; not fixed on main) |
| zoned.D | A js-temporal release validates the `"UTC"` fast path of `GetPossibleEpochNanoseconds` (draft D; not fixed on main) |

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
8. **zoned.A / zoned.B / zoned.D:** follow the removal notes in the headers of
   `internal/zonedWallClock.ts`, `internal/zonedWallClockOperations.ts` and
   `internal/zonedWallClockDifference.ts` (zoned.A: the defect-1 fallbacks and the `*AtLimit`
   fallbacks; zoned.B: the defect-2 transition fallback; zoned.D: `checkUtcValidity` and its call
   in `runAtRangeLimit`), then delete that group's repros and its group in
   `scripts/temporal-compat.mjs`. Run `internal/zonedWallClock*` tests: no expected value changes.
9. **After every step:** run the calendar test files (`plain/convert`, `zoned/convert`,
   `plain/validate/isValidCalendarDate`, `plain/calculate/{addDate,subtractDate,diffDate,diffDateAsDuration}`,
   `plain/interval/{intervalLengthDate,intervalCountDate,intervalFromDurationDate,splitIntervalByUnitDate}`,
   `zoned/calculate/{addZoned,subtractZoned,diffZoned,diffZonedAsDuration}`,
   `zoned/interval/{intervalLengthZoned,intervalCountZoned,splitIntervalByUnitZoned}`,
   `duration/{normalize/normalizeDuration,calculate/durationAs,compare/compareDurations}`,
   `internal/zonedWallClock*`, `internal/calendarDateString`, `internal/temporalCompat`). No
   expected value changes. When nothing
   is left, `calendarFieldsOf` is `date.withCalendar(calendarId)`'s fields. Keeping `index.ts` as a
   thin facade costs nothing.
