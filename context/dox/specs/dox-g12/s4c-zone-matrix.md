# Slice 4c · Zone matrix: other suites under our time-zone matrix

[Index](./index.md) · Binding rules: [Hand-written pages](../../built/tier-0-1-generator.md#hand-written-pages)
(Compare and Migrate), [Tier 2 · Gates](../../built/tier-2-gates.md#gates). Model runner: `scripts/behaviour-matrix/`.

## Goal

Run each library's own test suite under the zones GMT's suite runs in, and report what fails,
sorted by cause. One committed JSON feeds three readers: a new page `/compare/zone-matrix/`, a
column in the full table on `/compare`, and one line on each Migrate page. Deck 0 reads only its
zone list, for the clock pins (`planetZones` in `src/slides/give-me-temporal/stage-data.ts`);
its numbers slides read `zone-probe.json`.
Neutral throughout: versions, commands and counts, no adjectives.

## The runner: `scripts/zone-matrix/` (repo root)

A private package installed on its own, like `scripts/behaviour-matrix/` (own `package.json`,
`pnpm-workspace.yaml`, `README.md`; `.gitignore` gains its lockfile, `node_modules/` and
`.work/`). A person runs `pnpm matrix` there; no CI workflow runs it. Node built-ins plus `yaml`
2.9.1 (pinned, as in `apps/dox`); dates from `scripts/lib/gmt.mjs`, never `Date`. Like the
behaviour-matrix runner, `date-ban`, oxlint's date-library rule, fallow and Renovate skip it.

- **Matrix:** read the zones and Node majors from the `gmt-matrix` job in
  `.github/workflows/ci.yml` with `yaml`; nothing is copied. Today that is 10 zones × Node 22,
  24 and 26.
- **Suites** (`suites.mjs`), nine: Moment.js, Luxon, date-fns, Day.js, Spacetime,
  `@internationalized/date`, `@js-temporal/polyfill`, `temporal-polyfill` and GMT (the control).
  Each entry: repository, release tag, full commit SHA, install command (lockfile frozen), the
  runner command, a report parser, and the files to scan for zone pins. The six libraries on
  `/compare` pin the versions in `library-measurements.json` (a test holds them equal, so a
  `/compare` row describes one release); `@internationalized/date` runs its own package's tests
  inside its `adobe/react-spectrum` checkout. The polyfills pin their npm release (0.5.1, 1.0.8).
  GMT runs from the working tree, its commit recorded.
- **Fetch:** shallow clone of the pinned commit into `.work/<suite>@<sha>/`, checked by SHA
  before install. Nothing is vendored into the repo.
- **Runner output:** each suite's own JSON reporter where it has one (Jest `--json`, Vitest
  `--reporter=json`); otherwise an adapter that parses the runner's summary and failure lines,
  tested against a recorded sample. Test ids are `file › full name`.
- **Could not run:** a suite whose toolchain fails on a Node major before any test runs is
  recorded `couldNotRun` with the first error line, never as failures. (`@js-temporal/polyfill`'s
  `test` script passes `--experimental-specifier-resolution`, which current Node majors reject:
  the adapter calls its runner the way its CI does, or the cell reports it.) Test262 is not run:
  it is a shared conformance suite, not a library's own suite.

## Zone pins: found, overridden where honest, reported

- `pins.mjs` scans the files each suite names (package `scripts`, runner configs, setup files,
  CI workflows) for `TZ=`, `process.env.TZ =` and `cross-env TZ`, and records each as
  `{ file, line, text }`. Day.js's `test` script, for example, runs two time-zone files under six
  fixed zones before its full Jest run.
- **Script-level pins** are bypassed: the runner is called directly with the matrix `TZ` in its
  environment, and the page prints that command beside the suite's own.
- **Code-level pins** (a setup file that assigns `process.env.TZ`) are not patched. A probe
  loaded through `NODE_OPTIONS=--import` records the zone each test process actually saw; when it
  differs from the matrix zone the cell is `overriddenBy: { file, line, zone }` and counts no
  failures. The page states it plainly: the suite sets its own zone, so the matrix zone never
  reached its tests. That pin is the finding for that suite.

## Two kinds of failure, and who decides

- **Reference run:** each suite also runs once per Node in its reference zone: the zone its own
  scripts or CI pin, else `UTC`, recorded with its source (`package.json scripts.test`,
  `.github/workflows/x.yml:12`, or "none: CI default"). A test that fails there as well is a
  known failure, listed apart and counted in neither kind (`/compare` already reports those).
- **Every other failure is zone-dependent** and must carry a tag in `scripts/zone-matrix/tags.mjs`,
  keyed `<suite>@<version> | <test id>`, with an optional `zones` scope:
  - `one-zone`: **the test assumes one zone.** Its expected value holds only in the reference
    zone (a hard-coded wall time, offset or calendar day the zone under test does not have).
  - `wrong-answer`: **the library gives a wrong answer.** The expected value is right for the
    zone under test by the tz data that Node ships (`process.versions.tz`, recorded), checked by
    running the same input through Temporal (`@js-temporal/polyfill`) in that zone, and the
    library returns something else. Each such tag carries `{ input, zone, temporal, library }`.
  - Every tag has a one-line reason. The script prints each untagged failure with its assertion
    diff; a person writes the tag, and the tag file is reviewed in the PR like code
    (the `scripts/lib/native-suite-tags.mjs` pattern).
- **Reproducible:** pinned SHAs, frozen lockfiles, exact Node versions and tz versions in the
  JSON, and the tags committed. Re-running at the same pins gives the same ids; a tag whose test
  no longer fails is reported stale. Untagged failures make the script exit 1 and are written to
  the JSON as `untagged`, which the data test rejects, so nothing unsorted reaches the site.
- **GMT control:** any failure in GMT's cells is a GMT bug, fixed in this PR through the library
  pipeline with a changeset (zero known bugs); it is never shown. The JSON reaches the site only
  with GMT at zero in every cell.
- **Upstream:** each `wrong-answer` tag goes through the house filing flow (duplicate search,
  the owner approves the exact text, filed, added to `upstream-filings.json`). This slice files
  nothing; slice 5 lists the tags awaiting that flow.

## Run cost and keeping it local

9 suites × 10 zones × 3 Node majors = 270 matrix runs, plus 27 reference runs (297). The library
suites hold 386 to 8,910 tests each and take one to two minutes a run; the `react-spectrum`
install is the slowest single step, done once. GMT's 77,843 tests dominate (33 of the 297 runs,
most of the wall time), and the control runs locally in the same harness as every other suite.
On a 10-core laptop expect 3 to 5 hours.
- Node majors switch with the repo's `fnm` (`fnm exec --using=<major> --`); the script checks
  each major is installed first and prints the `fnm install` line if not. Install runs once per
  suite on the newest major; a suite that needs a per-major install says so in `suites.mjs`.
- Runs go in parallel: `P = floor(os.availableParallelism() / W)` processes, each runner capped
  at `W = 2` workers (`--maxWorkers=2`). Both are flags.
- `--suite`, `--zone` and `--node` re-run a subset; results merge cell by cell, and each cell
  keeps its own run date. `--plan` prints the cell list and a time estimate from the reference
  runs, then stops.

## Data: `apps/dox/src/data/zone-matrix.json` and `zone-matrix.ts`

The JSON (formatted by `scripts/lib/format-json.mjs`): `matrix` (zones, Node versions, the
`ci.yml` path), `tags`, and per suite `{ id, name, version, repository, commit, command,
ownCommand, reference, pins, cells[] }`; each cell `{ node, nodeVersion, tz, zone, ranOn,
tests, failed[], alsoFailsAtReference[], overriddenBy?, couldNotRun? }`. No count is stored.

`zone-matrix.ts` derives everything: per cell, per suite and per zone, the `oneZone` and
`wrongAnswer` counts (distinct test ids; a zone's figure on stage is the union over the three
Node majors), the run-date range, and `zoneMatrixLine(id)` for the Migrate pages. It throws on
an `untagged` entry or on a GMT failure, so the build stops.

## Readers

- **`/compare/zone-matrix/`:** `src/content/docs/compare/zone-matrix.mdx` beside `behaviour.mdx`,
  title "Library test suites across time zones". A summary table (suite, version, commit,
  tests, the two kinds, known failures, pins), then a table per suite (zones down, Node majors
  across, each cell "n one-zone · m wrong-answer", "Pass", "Set its own zone" or "Could not run").
  A section "How it was measured" in the style of `compare.mdx`: who runs what command, where
  the zones come from, the reference run, both definitions above, the tag review, and how pins
  were handled. Rendered by `ZoneMatrix.astro` from `CompareTable` builders added to
  `library-compare-tables.ts`, and registered in `mdx-jsx.ts` so the `.md` twin states the same.
- **`/compare` full table:** one column, "Fails in our zone matrix", in each library's row, from
  `zoneMatrixStats` joined into `LibraryComparisonStats` in `library-comparison.ts` beside
  `fullSuiteZones` and `partialZoneRuns` (no parallel model). Every row has a
  figure, since every library on `/compare` is in the matrix; GMT's row reads 0. A line under "How to read the columns" links the new page.
- **Migrate pages:** `{zoneMatrixLine("moment")}` under the existing `checkedLine` on
  `migrate/moment`, `luxon`, `date-fns`, `dayjs` and `internationalized-date` (Spacetime has no
  Migrate page), and one line per polyfill on
  `migrate/temporal.mdx`, each linking `/compare/zone-matrix/`.

## Tests

- `zone-matrix.test.ts` (data): derived counts match a fixture; the `ci.yml` zones and majors
  equal the JSON's; library versions equal `library-measurements.json`; every failure is tagged;
  every `wrong-answer` tag has evidence; GMT has no failure; counts never come from stored numbers.
- `scripts/zone-matrix/*.test.mjs` (`node --test`): pin scan, report parsers on recorded
  samples, tag matching and stale-tag reporting, cell merge.
- `library-compare-tables.test.ts`, `migrate-view.test.ts`, `head-tags.test.ts` (new page id)
  and `mdx-jsx` twin tests extended; `src/slides/give-me-temporal/stage-data.test.ts` holds the
  deck's pins to the matrix zones.

## Definition of done

- A full run is committed with every cell present or `couldNotRun`, no untagged failure, GMT 0.
- The new page, the `/compare` column and the seven Migrate lines all read the one JSON, and the
  deck's pins read its zone list.
- Own tests, `pnpm dox:lint`, `pnpm dox:check` green; the owner reads the page once in full.
