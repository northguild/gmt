# Zone matrix runner

Runs each library's own test suite under the zones and Node majors of the `gmt-matrix` job in
`.github/workflows/ci.yml`, and writes the committed record `apps/dox/src/data/zone-matrix.json`.
The Dox page `/compare/zone-matrix/`, the "Fails in our zone matrix" column on `/compare` and the
lines on `/migrate/` read that file through `apps/dox/src/data/zone-matrix.ts`.

Nine suites: Moment, Luxon, date-fns, Day.js, Spacetime, `@internationalized/date`,
`@js-temporal/polyfill`, `temporal-polyfill` and GMT. GMT is the control. It runs from the working
tree in the same harness. It must fail nothing.

This folder is not part of the pnpm workspace. It has its own `package.json` with exact versions.
Its `pnpm-lock.yaml`, `node_modules` and the `.work/` clones are ignored by git. The JSON record is
what is kept, and only a run by hand writes it.

## Run

Node 26 or newer runs the runner. `fnm` supplies each Node major it tests under.

```sh
cd scripts/zone-matrix
pnpm install --ignore-workspace
pnpm matrix -- --plan          # list the runs without starting them
pnpm matrix                    # the full matrix: 9 suites x 10 zones x 3 Node majors
```

Flags: `--suite <id>`, `--zone <iana>` and `--node <major>` (each repeatable) narrow the run.
`--parallel <n>` (default 2) sets suites in flight and `--workers <n>` (default 2) the test workers
per suite. `ZONE_MATRIX_RECORD=<path>` writes the record somewhere else, for a trial run.

Install the newest release of each Node major first. An older release carries older tzdata, and
GMT's own tests (`oh-canada.test.ts`) need tzdata 2026e or later. Each cell records
`process.versions.tz` beside the Node version so a stale install shows.

## How a run works

- Each suite is cloned shallowly into `.work/<id>@<sha12>/` at a pinned commit. The runner checks
  the commit after the clone and stops if it differs. The install steps in `suites.mjs` follow the
  suite's own CI: `temporal-polyfill` fetches the two submodules its build reads, installs, then
  runs `pnpm run build` before any test.
- It calls the suite's test binary with `node` under `fnm exec --using=<major>`, with `TZ` set to
  the zone.
- A scan of the suite's files finds pins of the zone (`TZ=`, `cross-env TZ`, YAML `TZ:`,
  `process.env.TZ =`). A script-level pin is bypassed. The scan only lists pins; it decides nothing.
- A probe loaded with `NODE_OPTIONS` records the zone each process starts in and ends in. A process
  is an override when its zone changed after it started (`process.env.TZ =`, or a test-env setting in
  the runner config), or when no process started in the zone asked for. The cell then gets
  `overriddenBy` and counts no failures. A child process that a test starts with its own `TZ` starts
  in that zone and keeps it, so it is not an override.
- A run with a failing test is run a second time. A test that fails in both runs is a failure. A test
  that fails in only one is `unstable` on the cell (or on the reference run) and is counted as
  neither kind. The log prints each unstable test with the first line of its failure message, where
  the report has one (Jest and Vitest JSON do; Moment's QUnit reporter and TAP do not).
- A suite's cells run `--parallel` at a time, in one clone. A suite whose test command writes into
  its clone is marked `serial` in `suites.mjs` and runs one at a time: Moment's `scripts/test.js`
  deletes and rebuilds `build/qunit/` on every run.
- Each suite also runs once per Node major in its reference zone (America/New_York where the suite's
  own CI uses it, otherwise UTC). A test that fails there goes to `alsoFailsAtReference` and is
  counted as neither kind.
- A report with zero tests, or a file that did not load, is `couldNotRun`, never a pass.
- Four report formats are parsed: Jest and Vitest JSON, QUnit text, TAP and the demitasse tree.
- Results are cached in `.work/cache/`. The key holds the suite, commit, Node release, tzdata,
  zone, test command, the install steps, a hash of `probe.mjs`, the attempt (first run or rerun)
  and, for a serial suite, `serial`, so a change to any of them runs the cell again.

## Tags

Every failure outside the reference zone needs a tag in `tags.mjs`, keyed
`<suite>@<version> | <test id>`:

- `kind: "one-zone"`: the test assumes one zone.
- `kind: "wrong-answer"`: the library gives a wrong answer. It also carries
  `evidence: { input, zone, temporal, library }`, with the answer from Temporal beside the
  library's.

Each tag has a `reason`, and optionally `zones`. Tags describe tests, not libraries: no text judges
a library. An untagged failure is listed in the record and makes the runner exit 1. Any GMT failure
exits 1 as well: it is a GMT bug, or old tzdata.

## Causes

Every failure counted in neither kind, from the reference zone or failing once in two runs, needs a
cause in `causes.mjs`, keyed the same way: `{ cause, nodes? }`. The cause states a fact about the
test and the machine ("V8 14.6 formats with U+0020 where the test expects U+202F", "the test reads
the real clock"), never a judgement of the library. `nodes` limits it to the Node majors it is true
on. A failure with no cause is listed in the record's `uncaused` and makes the runner exit 1; a cause
that matches no failure is reported as stale.

## When to run again

Run it again, and commit the JSON, when a pinned version or commit in `suites.mjs` changes, the
`gmt-matrix` job changes, or a tag or cause is added. The counts are derived in `zone-matrix.ts`; the file
stores none.

## Tests

```sh
pnpm test    # node --test: parsers, pins, tags, causes, cells, the cache key and the matrix reader
```
