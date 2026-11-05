# Slice 3 — swap-runner: `scripts/polyfill-swap.mjs` and its verdict

Index: [index.md](index.md). Needs slice 1 (configs and `GMT_TEMPORAL=temporal-polyfill`) and
slice 2 (`offset-sweep.mjs`). Clauses: correction 2 (judge against the control pass) and the
"Type errors do not decide" GMT rule.

## CLI

```text
node scripts/polyfill-swap.mjs <leg> --version=<x.y.z>
node scripts/polyfill-swap.mjs summary <leg>
```

`<leg>` is one of `node`, `chromium`, `firefox`, `webkit`. `--version` must match
`^\d+\.\d+\.\d+$` (an exact release; the workflow resolves "latest" before this runs). Any
other argument shape prints a usage line and exits **2** without writing a verdict, the same as
`native-suite.mjs`. Export `main(argv, { root, stdout, stderr, deps })` with injectable `deps`
(`runPass`, `shards`, `sweep`, `loadEntry`, `today`), modelled on `native-suite.mjs` `main`.

Exit codes: **0** when both passes ran (whether the swap passed or failed); **2** when the leg
could not run (a verdict `couldNotRunVerdict("temporal-polyfill-swap-<leg>", message)` is saved).
It never exits 1. The workflow job is `continue-on-error`, so the verdict is the only signal.

## Flow for a leg

1. **Preflight** (any failure → could-not-run, message as quoted):
   - Read `packages/gmt/node_modules/temporal-polyfill/package.json`. If it is missing →
     `"temporal-polyfill is not installed in packages/gmt"`. If its version differs from
     `--version` → `"installed temporal-polyfill is <a>, expected <b>"`.
   - Node leg only: `loadEntry()` resolves `SWAP_ENTRY` from `packages/gmt/package.json`
     (`createRequire`), then `import()`s it. If it exports no `Temporal`, or
     `entry.Temporal === globalThis.Temporal` →
     `"temporal-polyfill/full/implementation returned the runtime's built-in Temporal"`.
2. **Sweep** (Node leg only, before the passes, so a suite timeout cannot lose it):
   - `zones = Intl.supportedValuesOf("timeZone")`; for each zone, one
     `new globalThis.Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "longOffset" })`.
     `intlOffset` returns the `timeZoneName` part from `formatToParts(ms)`. Always use the
     runtime's `Intl`, never the polyfill's exported `Intl`.
   - `implOffset(zone, ms)` = `Number(entry.Temporal.Instant.fromEpochMilliseconds(ms)
     .toZonedDateTimeISO(zone).offsetNanoseconds) / 1e9`.
   - Span: `sweepSpan(globalThis.Temporal.Now.plainDateISO("UTC"))` (the built-in `Temporal`).
   - If `sweepOffsets` throws, record `sweep: { status: "could-not-run", message }`. The suite
     still runs. A sweep that could not run blocks the swap issue and is listed in the
     could-not-run issue (slice 4), but does not stop the leg.
   - On success: `sweep: { status: "ran", tz: process.versions.tz, ...result }`.
3. **Passes**: run `control`, then `swap`, each through `runPassAgainIfStopped` from
   `native-suite.mjs`, with the same sharding (`BROWSER_SHARDS` = 8 on browser legs, 1 on Node)
   and the same 18-minute pass limit.
4. **Completeness**: `incompleteRun(control, swap, controlExit, controlErrors, "swap")` (see the
   `native-suite.mjs` changes below). A non-null result → could-not-run.
5. **Classify**: `classify(swapReport, controlReport, leg, [], [], swapErrors, controlErrors)`
   from `scripts/lib/native-suite-tags.mjs`, with **empty** divergence rows and host groups, so
   nothing is excused by a tag. Mapping:
   - `untagged` = fails on the swap and passes on the control → **`failing`** (blocks);
   - `hostUntagged` = fails on both → `counts.both` (does not block);
   - `controlOnly` = fails on the control only → `counts.fixed` (information only).
6. **Verdict**: `saveVerdict(root, polyfillSwapVerdict(...), "polyfill-swap")`. Print one line:
   `` `polyfill-swap: <leg> temporal-polyfill <v>: <failed> swap-only failures of <tests> tests[; sweep: <n> zones differ]` ``.

## `native-suite.mjs` changes (behaviour of the native suite unchanged)

- `Pass` gains `"swap"`. In `runPass`: on Node, `pass === "swap"` → config
  `packages/gmt/vitest.swap.config.ts`; on browser legs, the browser config with env
  `GMT_TEMPORAL: "temporal-polyfill"`. `control` and `native` stay exactly as they are.
- Export `runPassAgainIfStopped` and `incompleteRun`. `incompleteRun` gains a fifth parameter,
  `candidate = "native"`, used in its messages (`"the ${candidate} pass ran no tests"`, …). The
  existing call passes nothing, so the native-suite messages stay byte-identical. The existing
  `native-suite.test.ts` rows must pass with no edit.
- Report files keep `reportPath(leg, pass)`: `artifacts/native-suite-<leg>.swap.vitest.json`
  and `.control.vitest.json`. The swap job uploads them under its own artifact name (slice 5).

## `polyfillSwapVerdict` (in `scripts/lib/canary-verdict.mjs`)

Add `VERDICT_FILES["temporal-polyfill-swap-<leg>"] = "artifacts/temporal-polyfill-swap-<leg>.json"`
for all four legs.

```js
{
  source: "temporal-polyfill-swap-<leg>",
  status: "ran",
  leg,
  version: "1.0.7",                                   // the --version argument
  entry: "temporal-polyfill/full/implementation",
  runtime: { node, vitest, playwright /* null on node */, browser /* name+version, null on node */ },
  counts: { files, tests, passed, skipped, failed, both, fixed },
  failing: [{ file, test, message }],                 // first 50; message ≤ 300 chars
  failingTruncated: boolean,
  sweep: null | { status: "ran", tz, from, through, zones, days, comparisons,
                  differingZones, differing, differingTruncated }
             | { status: "could-not-run", message },  // null on browser legs
}
```

- `failed` = `failing` before the cap. `both` and `fixed` are counts only; their rows stay in the
  uploaded reports. Reuse `UNTAGGED_ROWS_IN_VERDICT` (50) and `MESSAGE_CHARS_IN_VERDICT` (300).
- No timestamps, so the same input gives a byte-identical file (the module's existing rule).
- `runtime` reuses whatever `native-suite.mjs` already gathers for its `engine`/`runtime`
  fields. Browser version comes from Playwright, as the native-suite browser preflight reads it.
  If that helper is internal, export it rather than copy it.

## `summary <leg>`

Reads the leg's verdict and prints Markdown for `$GITHUB_STEP_SUMMARY` (issue Scope 5):

```md
### Temporal polyfill swap (<leg>)

temporal-polyfill <version>: <failed> tests fail on the swap and pass on @js-temporal/polyfill (of <tests>).
<both> fail on both; <fixed> fail only on @js-temporal/polyfill.
Offset sweep: <differingZones> zones differ from Intl, 1970-01-01 to <through>, <zones> zones, tz <tz>.
```

The sweep line appears on Node only. A could-not-run verdict prints `could not run: <message>`.
A missing verdict prints `no verdict was written`. It always exits 0.

## Tests (`apps/dox/scripts/canary/polyfill-swap.test.ts`, plus rows in the existing tests)

All with injected `deps`. No real Vitest run, no browser and no `temporal-polyfill`.

| Row | Expected |
| --- | -------- |
| bad args: no leg, unknown leg, `--version=latest`, extra arg | exit 2, usage on stderr, no verdict |
| package missing / version mismatch | exit 2, could-not-run verdict with the quoted message |
| entry returns `globalThis.Temporal` | exit 2, the quoted message |
| control and swap identical, all pass | exit 0, `failed: 0`, `failing: []` |
| one test fails on swap only | `failed: 1`, row in `failing` |
| one test fails on both | `both: 1`, `failed: 0` |
| one test fails on control only | `fixed: 1`, `failed: 0` |
| swap pass ran fewer files than control | exit 2, message says "swap pass", not "native pass" |
| swap pass stops twice | exit 2 (from `runPassAgainIfStopped`) |
| 60 swap-only failures | 50 listed, `failingTruncated: true`, `failed: 60` |
| sweep throws (node) | exit 0, `sweep.status: "could-not-run"`, passes still ran |
| browser leg | `sweep: null`, `runPass` called with pass `"swap"` |
| `runPass` for `swap` on node / chromium | node config `vitest.swap.config.ts`; browser env `GMT_TEMPORAL=temporal-polyfill` |
| summary for ran / could-not-run / missing verdict | the three texts above |
| `polyfillSwapVerdict` | shape, caps, key order stable (in `canary-verdict.test.ts`) |
| `native-suite.test.ts` | unchanged and green |
