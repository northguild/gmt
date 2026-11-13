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
