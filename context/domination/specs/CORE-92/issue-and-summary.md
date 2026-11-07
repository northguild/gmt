# Slice 4 — issue-and-summary: open the swap issue, add the summary block

Index: [index.md](index.md). Needs slice 3's verdict shape. Clauses: the GMT rules "Swap issue
on success only…" and "A swap leg or sweep that could not run…" (index Authority table) and the
existing marker and body-limit rules of `canary-issues.mjs`.

Two outcomes file something; one files nothing:

| Run outcome | Files |
| ----------- | ----- |
| Every leg ran, `swapReady` true | the swap issue, or a comment on the open one |
| Every leg ran, not swap-ready (tests fail or zones differ) | **nothing** (issue Scope 4) |
| A swap leg has no verdict, a could-not-run verdict, or a Node sweep that could not run | the workflow's existing `temporal-oracle/could-not-run` issue (CORE-81 scheme), listing it |

## `scripts/lib/canary-issues.mjs`

### Sources

- `export const SWAP_SOURCES = ["temporal-polyfill-swap-node", "-chromium", "-firefox", "-webkit"]`
  (written out in full).
- Append `...SWAP_SOURCES` to `WORKFLOW_SOURCES["temporal-oracle"]`, after the native-suite
  sources. That one change routes everything through the existing paths with no new code:
  `canary-report.mjs` `readVerdicts` reads the four files (missing → `null`, corrupt → an
  "unreadable verdict" could-not-run verdict), and `failedSources` lists each missing or
  could-not-run swap source in the one `temporal-oracle/could-not-run` finding, beside any other
  source of the workflow that failed. A missing verdict reads `NO_VERDICT` ("no verdict file: an
  earlier step or job failed"), which covers a skipped leg after `swap-version` fails (slice 5).
- **The sweep is part of the Node leg's check.** The Node verdict can say `status: "ran"` with
  `sweep.status: "could-not-run"`, because the suite still ran. `findings()` adds
  `{ source: "temporal-polyfill-swap-node", message: "offset sweep: " + sweep.message }` to the
  `failed` list before `couldNotRunFinding` is built. Do this in a small helper
  (`swapSweepFailures(verdicts)`) so `failedSources` itself keeps its single meaning.

### `swapReady(verdicts)`

Pure. It returns `{ ready: true, version }` only when **all** of these hold:

1. All four swap verdicts exist with `status: "ran"`;
2. They name the same `version`;
3. `counts.failed === 0` on every leg;
4. The Node verdict's `sweep.status === "ran"` and `sweep.differingZones === 0`.

Otherwise it returns `{ ready: false, reason }`, where `reason` names the first condition that
failed, in that order (for example `"temporal-polyfill-swap-node: 12 tests fail on the swap"`,
`"offset sweep: 2 zones differ"`, `"legs ran different versions: 1.0.7, 1.0.8"`). The report
summary shows the reason. No issue is filed.

### Finding

In `findings()`, after leap and before could-not-run, when the workflow's sources include the
swap sources:

- `swapReady` true → one finding:
  - key `temporal-polyfill-swap/ready` (no version, so a later passing run comments on the same
    open issue);
  - title `` `Swap to temporal-polyfill ${version}: it passes the GMT suite and the offset sweep` ``;
  - labels `[CANARY_LABEL]`.
- `swapReady` false → nothing (unless forced, below).

`planIssueActions` already turns a finding into "comment on the open issue with that marker",
or "open a new one". Use it unchanged. The comment body is the same text as the issue body,
under a first line `` `temporal-polyfill ${version} also passes.` ``. Body and comment name the
run only in their trailing `Run: <runUrl>` line, and the sweep's end reads as a rule, not a date, so
an unchanged report keeps its fingerprint and repeats as one line (CORE-81).

### Body

First line: `marker(key)`, as for every canary issue. Then:

```md
temporal-polyfill <version>, imported from `temporal-polyfill/full/implementation`, passed every
check on this run.

| Runtime | Tests | Fail on swap only | Fail on both | Fail only on @js-temporal/polyfill |
| ------- | ----- | ----------------- | ------------ | ---------------------------------- |
| Node <node> | … | 0 | … | … |
| Chromium <version> | … | 0 | … | … |
| Firefox <version> | … | 0 | … | … |
| WebKit <version> | … | 0 | … | … |

Offset sweep: every one of <zones> zones matches `Intl.DateTimeFormat` at 12:00 UTC each day from
<from> to ten years past the run date (tz <tz>).

What the swap involves is in [temporal-polyfill-swap.md § 5 and § 7](https://github.com/northguild/gmt/blob/main/context/domination/research/temporal-polyfill-swap.md).
Type errors are not checked here; § 5 lists them.

A person makes the swap. CI opens issues, never pull requests.

Run: <runUrl>
```

- Runtime names and versions come from each verdict's `runtime`.
- "Fail on both" is a column, so a reader sees what host failures the browsers carried.
- The body is far below `BODY_LIMIT` (65,536) by construction (four rows), and no `fitRows` call
  is needed. Add a test that asserts the length stays under the limit anyway.
- No business wording, no statute, no person's name.

### Force: `--force-swap-ready`

- `Force` gains `swapReady?: true`. `applyForce` marks the **first swap leg that ran** (order
  `node, chromium, firefox, webkit`) with `forced: { swapReady: true }`. If no swap leg ran, it
  is skipped with the standard "nothing to force against" reason.
- A forced verdict set yields a dry-run finding through the existing `dryRun(real, flag,
  paragraphs, runUrl)`: key `dry-run/temporal-polyfill-swap/ready`, title `[dry run] …`, labels
  plus `DRY_RUN_LABEL`. The first paragraph reads
  `` `Forced for a dry run. Real result on this run: <swapReady reason, or "every check passed">.` ``
  The rest is the real body, built from whatever legs ran (missing legs show "did not run").
- A forced run never comments on, or edits, the real issue (the `dryRun` rule).

- **Dry-run coverage of the could-not-run path.** No existing dispatch input forces a
  could-not-run finding for any canary: the CORE-81 forces cover removable, mismatch,
  native failure and leap difference only. So the swap sources get none either; their
  could-not-run path is covered by the unit rows below, as the oracle's is. A forced swap-ready
  run alongside a real could-not-run leg files both the `[dry run]` issue and the real
  could-not-run finding, because `applyForce` never hides a real finding.

## `scripts/canary-report.mjs`

- `FORCE_FLAGS["temporal-oracle"]` gains `"--force-swap-ready"`; `parseArgs` maps it to
  `force.swapReady = true`; `USAGE` names it.
- `readVerdicts` reads the extra sources (above).
- No other change: `--print`, label creation and `runActions` are untouched. `canary` already
  exists in `LABEL_SPECS`.

## `scripts/lib/canary-summary.mjs`

`summaryMarkdown` gains a "Temporal polyfill swap" block after the native-suite blocks
(`nativeBlocks` shows the pattern):

```md
### Temporal polyfill swap

temporal-polyfill <version> — <Ready to swap | Not ready: <reason>>

| Runtime | Tests | Fail on swap only | Fail on both |
| ------- | ----- | ----------------- | ------------ |
| node | … | … | … |
| chromium | could not run: <message> | | |
| firefox | no verdict | | |

Offset sweep: <differingZones> zones differ (<zones> zones, <from> to <through>, tz <tz>).
```

When the sweep differs, add the first ten zones, as `Zone (n days)`, comma-separated. Messages
go through the module's `oneLine`. A forced run adds its line through `dryRunLines`, like the
other flags.

## Tests (extend the existing files in `apps/dox/scripts/canary/`)

| File | Rows |
| ---- | ---- |
| `canary-issues.test.ts` | `swapReady`: all pass → ready with version; each of conditions 1–4 failing on its own → its reason; a missing leg; versions differ; Node sweep could-not-run; `sweep.differingZones: 1` |
| | `findings`: ready → one finding with key, title and label as specified; ran but not ready → **no** finding at all; the `WORKFLOW_SOURCES` test (line ~318) now lists the four swap sources last |
| | could-not-run: a swap leg's could-not-run verdict → one `temporal-oracle/could-not-run` finding listing `**temporal-polyfill-swap-<leg>**: <message>`, and no swap finding; all four swap verdicts missing → the finding lists all four with `NO_VERDICT`; a swap leg and the oracle both failing → **one** finding listing both; Node ran but its sweep could not run → listed as `offset sweep: <message>`; an open issue with the could-not-run marker → `comment`, not `open` |
| | `planIssueActions`: an open issue with the marker → `comment` naming the new version; none → `open` |
| | body: marker on line 1; four runtime rows; research link exact; "never pull requests" sentence; length < 65,536 |
| | force: forced with all passing → dry-run key and title, `DRY_RUN_LABEL`; forced with WebKit failing → dry run states the real reason; no swap leg ran → skipped with reason |
| `canary-report.test.ts` | `--force-swap-ready` parsed for `temporal-oracle`, rejected for `leap-seconds`; swap verdict files read; a corrupt swap file → an unreadable could-not-run verdict, listed in the could-not-run issue |
| `canary-summary.test.ts` | the block for ready, not ready, a leg that could not run, a leg with no verdict, and a differing sweep (ten zones listed) |

Each test builds its own verdict objects. No shared mutable fixture, and no reliance on mock
state between tests.
