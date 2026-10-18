# Slice 1 — Benchmarks and the size budget

Read with [index.md](./index.md). This slice comes first so every later slice reports its numbers
against the same harness. It changes no source under `packages/gmt/src`.

## A. Benchmarks

**Location.** `packages/gmt/bench/`, outside `src`, so `tsconfig.build.json`, the published
`files` (`dist` only), `scripts/test-markers.mjs` and `scripts/stats.mjs` never see them. Add
`"bench/**/*"` to `packages/gmt/tsconfig.json` `include` so `typecheck` covers them, and include
`bench/` in the package's `oxlint` run.

**Config.** `packages/gmt/vitest.bench.config.ts`: `benchmark.include = ["bench/**/*.bench.ts"]`,
the same `setupFiles` as `vitest.config.ts`. Scripts:

- `packages/gmt/package.json`: `"bench": "vitest bench --run --config vitest.bench.config.ts"`
- root `package.json`: `"bench": "pnpm --filter @northguild/gmt bench"`

`bench` is not part of `validate` and CI does not run it. It reports; it never fails a build.

**Fixtures.** `bench/fixtures.ts` builds the audit inputs
([audit appendix](../../../perf-and-bundle-size-audit/agent-changes-and-decisions.md#appendix--how-the-figures-were-measured)),
generated from integers so a fixture costs nothing to describe:

| Fixture | Shape |
| ------- | ----- |
| Duty log | A repeating 24-hour day: 10 h off, 1 h on, 5 h driving, 0.5 h off, 5.5 h driving, 2 h on. Rule: an 11-hour driving cap that resets after 10 hours off |
| Schedule | Mon–Fri 09:00–17:00, Wednesday split 09:00–12:00 and 13:00–17:00, `Europe/London` |
| Holidays | 480 dates, 12 a year over 2020–2059 (the 15th of each month) |
| Free-time terms | `chargeableDays` from `2024-06-14T19:00:00Z`, `freeDays` 3, basis calendar/calendar, `firstDay` `"eventDay"`, in `America/Port_of_Spain` and `Europe/London`; plus a working-basis row in `Europe/London` with the 480 holidays |

**Rows.** One `describe` per function, one `bench` per input size. Every function in the story's
speed table, at a short, a 1-year and a 10-year input:

| File | Rows |
| ---- | ---- |
| `dutyViolations.bench.ts` | 7 d, 90 d, 365 d. The 10-year row is added by slice 4 (today it would take about 40 s) |
| `operatingTimeBetween.bench.ts` | 1 week, 1 year, 10 years |
| `chargeableDays.bench.ts` | 2 weeks, 1 year, 10 years (10 years stays under `MAX_WALKED_DAYS`) |
| `businessDays.bench.ts` | `businessDaysBetween` and `addBusinessDays` at 0 and 480 holidays, 10 days, 1 year, 30 years |
| `bucketRange.bench.ts` | `bucketRange` by day, `Asia/Kolkata` (no transitions since 1945) and `Europe/London`, starting 1900-01-01 and 2400-01-01, at 1, 365 and 10,001 days. These exercise `certainlyTouchesMoreBuckets` (slice 5) |
| `formatDate.bench.ts` | `formatDate` and `getLocaleMonthNames`, one locale, repeated (slice 9) |
| `zonedSpans.bench.ts` | `intervalCountZoned` by day, hour and month, `intervalOverlappingDaysZoned` and `dwellTime`, `Europe/London` from 2024-01-01, at 1, 10 and 100 years; `intervalSplitAtZoned` at 100 and 1,000 points (slice 10) |

Use `bench(name, fn, { time: 500 })`. No assertion of any kind in a bench file. Timing is never
asserted in an `it` row either (story design note).

**Handoff.** Each later slice records before and after for its rows in its handoff, with input
sizes and Node version. Vitest 4.1's `vitest bench --outputJson <file>` and `--compare <file>`
save a run and print another against it; `pnpm bench --outputJson …` passes them through (no
bare `--`: Vitest would read what follows it as file filters).

## B. Size script

`scripts/bundle-size.mjs`, Node ESM, no build needed: esbuild bundles `packages/gmt/src`
in memory (`write: false`), so `dist` and the Dox dev server are untouched.

**Dependency.** Add `esbuild` to the root `devDependencies`, caret range like the other tools,
at the version already in the lockfile through Vite (0.28.x). The lockfile pins it, so minified
sizes are byte-for-byte repeatable.

**Build options** (the audit's method):

```js
{
  stdin: { contents, resolveDir: GMT_DIR, loader: "ts" },
  bundle: true, minify: true, format: "esm", platform: "neutral",
  mainFields: ["module", "main"], target: "es2022", write: false, metafile: true,
}
```

**Entries.** Fixed in the budgets file, each one a `stdin` string:

| Name | `contents` |
| ---- | ---------- |
| `root` | `export * from "./src/index.ts";` |
| `polyfill` | `export { Temporal } from "@js-temporal/polyfill";` (the floor, reported, not budgeted) |
| `isValidDate`, `formatDate`, `businessDaysBetween`, `addBusinessDays`, `chargeableDays`, `operatingTimeBetween`, `dutyViolations` | `export { <name> } from "./src/index.ts";` |

**Output.** One table: entry, minified bytes, gzipped bytes (`zlib.gzipSync`, level 9), the
minified budget, and the entry's size above the polyfill floor. With `--files <entry>` it also
prints the top 15 inputs by `bytesInOutput` from the metafile, which is how a reviewer answers
"what did this change drag in".

- `--json <file>` also writes `{ measuredAt, node, esbuild, commit, dirty, entries: { <name>:
  { minified, gzipped } } }` (`commit` from `git rev-parse HEAD`, `dirty` from
  `git status --porcelain`).
- `--compare <file>` reads such a file and prints, per entry, in kB (1,000 bytes) to one decimal:
  minified before, after, change and change in %; gzipped the same; then the totals. It reports only: the exit status is the
  check's, as without it. An entry missing on either side prints `—`.

**Gate.** `scripts/bundle-size.budgets.json`:

```json
{ "entries": { "root": { "minified": 492000 }, "addBusinessDays": { "minified": 175400 } },
  "absent": {} }
```

(Figures illustrative; `--update` writes the real ones.) Slice 3 adds the `absent` entry for
`addBusinessDays`.

- `check` (the default) exits 1 when an entry's minified bytes exceed its budget, or when a path
  listed under `absent` appears in that entry's metafile inputs. Gzipped bytes are reported, never
  gated: they vary with zlib's version, minified bytes do not.
- `--update` rewrites every budget to the current minified size plus 1%, rounded up to the next
  100 bytes, and prints the old and new figures. Only an owner-reviewed edit runs it.
- Exit 2 when esbuild fails to bundle, with esbuild's message.

The budget figures are set by slice 10's last commit, from that state's measurements, per owner
decision 2. Until then the file carries the baseline sizes from the index plus 1%, so slices 2–8
can only shrink entries.

**Wiring.** Root `package.json`:

- `"size": "node scripts/bundle-size.mjs"`
- `validate`: insert `node scripts/bundle-size.mjs check` after `node scripts/api-surface.mjs check`.
- `.github/workflows/ci.yml`: the PR checks job (Node 22) that runs `stats.mjs check` and
  `api-surface.mjs check` gets a step `node scripts/bundle-size.mjs check` after them. One Node
  version is enough: the bundle does not depend on it.

## C. The before snapshot

The last step of this slice, before slice 2 changes anything: this slice touches no source, so
the tree measures as the branch's code does now. Run, on the machine that will run the after
figures:

```sh
pnpm size --json context/domination/specs/CORE-80/baseline/size.json
pnpm bench --outputJson ../../context/domination/specs/CORE-80/baseline/bench.json
```

(`pnpm bench` runs in `packages/gmt`, hence the relative path.) Both files live in the spec
folder, which stays in the repo until the story closes, so they survive across sessions and
reach the finalizer. Add `baseline/README.md`, three lines: Node version, date, commit. The
index baselines are planning figures; the PR uses these. If the after run must be on another
machine, re-run both commands there at the baseline commit first.

## Edge cases the script must handle

- A bare `--` argument is ignored.
- An entry that names a function no longer exported: esbuild errors, exit 2 with the name.
- A metafile path is relative to `resolveDir`; compare `absent` paths after normalising both to
  forward slashes.

## Done when

- `pnpm bench` prints every row above; `pnpm size` prints the table; `pnpm run validate` runs the
  size check and is green.
- `baseline/size.json`, `baseline/bench.json` and `baseline/README.md` exist, and
  `pnpm size --compare context/domination/specs/CORE-80/baseline/size.json` prints a zero change.
- No file under `packages/gmt/src` changed.
