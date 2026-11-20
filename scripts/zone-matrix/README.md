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

## The agent's answer

`agent-answer.mjs` runs the code each agent wrote for the running question of Deck 0 in every zone
and Node major of the `gmt-matrix` job, and in `Europe/Helsinki`, and records what it returned. It
reads the owner's transcript, `apps/dox/src/slides/give-me-temporal/quotes/agent-answer.json`: the
shared `question`, `quoted` (the id of the answer the deck quotes) and `answers`, each with `id`,
`model`, `date`, `answer`, `code`, `call` and an optional `excerpt` of line ranges. It writes
`agent-run.json` beside it, one record per answer id.

```sh
cd scripts/zone-matrix
fnm exec --using=26 -- node agent-answer.mjs
```

- Exit 2 with the file path when a field of any answer is empty.
- Exit 2 naming the package when the code imports one that is not pinned in `package.json`, with the
  `pnpm add --ignore-workspace --save-exact <package>` command that pins it. Any library the agent
  picked can be added that way.
- The code and a runner go to `.work/agent-answer/` (ignored). The code runs as an ES module or as
  CommonJS, and `call` is evaluated in its scope. A promise is awaited and a throw is recorded as
  `{ "threw": "<name>: <message>" }`.
- `agent-run.json` holds a `sha256` of the code and the call, the command, the instant (from GMT),
  the installed version of each library, and one `{ node, tzdata, zone, value }` per run.

The slides show each answer's run on Node 26 at `Europe/Helsinki` and its number of distinct
values: `agent-answer` the quoted one, `agents` every one. An answer is current only while its
record's hash matches the code and the call; otherwise its panel or row is marked and
`slides-check` fails naming the answer, the file and the command.

`familiar.test.mjs` runs each Moment, date-fns and Day.js shape in `familiar.json` against the
pinned versions, so no shape on the "Names you already know" slide is one the library rejects.

## The kinds of a date

`date-kinds.mjs` runs the `Date` chain of Deck 0's `kinds` slide with each kind of input (a date, a
local time, a UTC time, a time with an offset, a time with a zone, a `Date` object) in the same zones
and Node majors as the agent's answer, with the same runner. It reads
`apps/dox/src/slides/give-me-temporal/date-kinds.json` (`code`, `want` and `kinds`, each with `id`,
`kind` and `call`) and writes `date-kinds-run.json` beside it, one record per kind id.

```sh
cd scripts/zone-matrix
fnm exec --using=26 -- node date-kinds.mjs
```

Exit 2 when the file has no code or no kinds, or a kind's id is malformed or repeated, or it has no
call. A kind is current only while its record's hash matches the code and its call; otherwise the
slide marks the grid and `slides-check` fails naming the file and the command.

## The record's shape

`apps/dox/src/data/zone-matrix.json` is stored compactly by `record-shape.mjs`: the Node release and
tzdata once per major, each distinct tag and cause once, and per suite a table of the test ids it
names that every list of failures indexes into. `run.mjs` and `zone-matrix.ts` read it back into
one cell per suite, Node and zone. Two releases of one Node major cannot sit in one record: run
every suite again on the newer release (the cache keeps the cells already run).

## The zone probe

`probe/run.mjs` feeds every library the same questions in each zone and Node major and writes
`apps/dox/src/data/zone-probe.json`. It builds its cases from the Temporal specification at the
start of every run and writes them to `.work/cases.json` for its child processes. No file of cases
is kept in git. `fnm exec --using=26 -- node probe/build-cases.mjs` writes the same file by hand.
The cache key holds a hash of the cases, so a changed question runs the cells again.

`node-runner.mjs` holds what the three runners share: the flags, `fnm exec`, the Node info and the
work pool.

## Tests

```sh
pnpm test    # node --test: parsers, pins, tags, causes, cells, the cache key, the record shape, the probe, the matrix reader, the agent-answer and date-kinds runners and the familiar shapes
```
