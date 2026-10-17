# Fiscal calendar: 53rd-week placement and year label — implementation spec

**Origin:** the international-standards audit. The owner has approved the change.
**Host story:** CORE-5 (`getFiscalPeriod`, `getQuarter`, `isValidFiscalPattern`). This spec
reverses two of CORE-5's decisions, so slice 6 adds a `## Corrections` entry to
`context/domination/issues/CORE-5.md` (see §9.3).
**Release:** `minor` changeset with a **Breaking changes** section (1.19.0 → 1.20.0). Users are
internal, so there is no compatibility shim and no deprecation.
**Blocked by:** nothing. Every file touched already exists.

Every number in this spec came from running code: the reference implementation in §3 run under
`@js-temporal/polyfill` 0.5.1, checked against the published calendars in §6.1.

## Scoped files

Section numbers (§0 to §10) run across the files in order. Load only the part the task needs.

- [01-scope-authority-files.md](audit-fiscal-calendar-spec/01-scope-authority-files.md) — What changes, §0 authority table for each rule, §1 files, types, public functions and internal signatures.
- [02-validation-and-algorithms.md](audit-fiscal-calendar-spec/02-validation-and-algorithms.md) — §2 validation order and sentinels, §3 algorithms: week-to-period, year label, `getQuarter` and the Gregorian cycle shift, `getFiscalPeriod`, validators.
- [03-jsdoc-types-and-getfiscalperiod.md](audit-fiscal-calendar-spec/03-jsdoc-types-and-getfiscalperiod.md) — §4.1 and §4.2 JSDoc drafts for the types and for `getFiscalPeriod`.
- [04-jsdoc-getquarter-validators.md](audit-fiscal-calendar-spec/04-jsdoc-getquarter-validators.md) — §4.3 to §4.5 JSDoc drafts for `getQuarter`, the validators and the internal helpers.
- [05-wiring-and-published-years.md](audit-fiscal-calendar-spec/05-wiring-and-published-years.md) — §5 wiring and the §6 test matrix opening, §6.1 published NRF and ONS years.
- [06-test-matrix-rest.md](audit-fiscal-calendar-spec/06-test-matrix-rest.md) — §6.2 to §6.7 tests: `extraWeek` placement, `yearLabel`, `getQuarter`, invalid input, validators, Temporal range limits.
- [07-slices-breaking-docs-findings.md](audit-fiscal-calendar-spec/07-slices-breaking-docs-findings.md) — §7 TDD slices, §8 breaking-change inventory and changeset, §9 doc impact, §10 findings to report.
