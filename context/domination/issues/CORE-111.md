# CORE-111 — Core: Public functions call internal cores, never another public function

**Scope:** Every public module in `packages/gmt/src` stops importing a function from another
public module. Each shared step moves to, or already lives in, an `internal/` core that both
public functions call. The rule in [coding-standards.md § Loop cost](../../coding-standards.md#loop-cost)
stays as written. Adds no library function. Tracked as #508.

## Gap

`context/coding-standards.md` § Loop cost, under Resolve once, says: "A public function never
calls another public function; both call the core."

On main, about 453 public modules import a function from another public module (test files,
`internal/`, `regex/`, `types/` and the `index.ts` barrels not counted). Most calls go to the
public validators: `isValidZonedDateTime` (70 modules), `isValidDateTime` (62), `isValidDate` (56),
`isValidUtc` (48), `isValidTime` (40), `isValidDateTimeDurationUnit` (34), `getSystemTimeZone`
(20), `isValidCalendarDate` (19), `isValidCalendarZonedDateTime` (18), `isValidDateTimeUnit` (17),
and `isValidTimeZone`, `isValidDuration`, `isValidInstant`, `getWeekNumber` (10 to 14 each).

By namespace: `plain` 207, `zoned` 101, `utc` 58, `unix` 24, `intermodal` 20, `duration` 12,
`precision` 8, `transport` 7, `calendar` 6, `span` 3, `instant` 2, `healthcare` 2, and one each in
`interval`, `aviation` and `finance`.

Some call more than a validator: `isValidHL7` calls `parseHL7`, `isValidSsimDate` calls
`parseSsimDate`, `isValidFixUtcTimestamp` calls `parseFixUtcTimestamp`, `clampInterval` calls
`intersectIntervals`, and `spanMs` and `spanSeconds` call `spanNs`.

A public validator called as a guard parses the input, then the caller parses it again.

## Scope

- **The whole class, in one PR,** done in phases by namespace. No public function is left calling
  another.
- **Behaviour is unchanged.** Every existing test row stays green on the full zone matrix.
- **A guard against regressions,** so a new public-to-public call fails the checks.

## Decisions

- **The guard is oxlint `no-restricted-imports`, not fallow.** It already runs in `lint:gmt` and the
  root `lint`. Fallow always allows same-zone imports, so it cannot say that no public file imports
  another public file. The shared options live in `packages/gmt/oxlint.boundary.mts`: a public file
  may value-import only `internal/`, `regex/` and `types/`; an internal core may import no public
  module. `import type` is exempt (`allowTypeImports`). `index.ts` barrels, tests, `src/test/**` and
  `*.browser.ts` files are exempt, and the polyfill ban still holds everywhere. Patterns use gitignore
  `group` lists with `!` negation, because oxlint's regex engine has no look-around, and `../**`
  because `../*` does not reach a nested path.
- **Parse-once cores.** `internal/inputChecks.ts` and the other core homes hold `plainDateOf`,
  `plainTimeOf`, `plainDateTimeOf`, `durationOf`, `zonedDateTimeOf`, `utcInstantOf`, `instantOf`,
  `calendarDateOf` and `calendarZonedOf`. Each parses once and returns the parsed value or `null`.
  A public `isValidX` is `return xOf(value) !== null;`. `zonedDateTimeOf` lives in
  `internal/zonedWallClock.ts`, so `addBusinessDays` and `businessDaysBetween` do not pull that file in.
- **Rewrite rules.** A guard followed by a parse of the same value becomes `const x = xOf(v); if (x === null) return S;`.
  A guard with no later parse, or whose later parse passes options, becomes `xOf(v) !== null`. Unit and
  cycle-field checks use `internal/unitNames.ts`. A call to a composite public function becomes a call to
  its core. If `v` is reassigned between guard and parse, the guard form is used.
- **Keep both parses where a caller's own parse passes options.** The two parses can disagree on an
  ambiguous wall time, so behaviour wins over parsing once. Kept: the calendar pair parses of
  `diffDate`, `diffDateAsDuration`, `splitIntervalByUnitDate`, `intervalCountDate`, `intervalLengthDate`
  and their zoned counterparts (they normalise two calendars together); `spanWallClock` (a different
  Temporal type); `convertPlainDateTimeToZoned` and `internal/resolveLocalInstant` (options on a built
  string); `internal/deliverySchedule` (cursor parses); `getFiscalPeriod` (an existing double parse).
- **`systemTimeZone()` is not memoised.** It depends on a process default, so it is not pure.
- **`weekNumberOf` returns `null` for a non-ISO `PlainDate`.** It reproduces `getWeekNumber(date.toString())`,
  whose date check accepts only the ISO calendar.
- **Interval and event getters are read once.** Interval `start`/`end` and `demurrageClock` event `.at`
  are read once per call. Objects whose getters change between reads see a different result. Accepted.
- **Plain multi-argument functions parse every argument up front.** This costs a little work on an
  early return and saves bundle size. Results are unchanged. Accepted.
- **Imports go to the core's own file**, not to `internal/index.ts`, which keeps each bundle entry's
  input list short.
