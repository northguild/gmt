# Slice 4 — Duty engine: runs and prefix sums built once

Read with [index.md](./index.md). Story scope part 4. Target O((N + C) log N + W) per rule, where
N is log entries, C candidate instants and W the runs inside the windows the candidates judge.
Verification: `dutyViolations` on a 365-day log takes no more than 5x a 90-day log (14.8x today).

## Why it is quadratic today

`ruleViolations` (`dutyEngine.ts:2254`) checks every candidate instant `at` from
`candidateInstants` (`:1936`). For each one, `evaluateRule` (`:1109`) copies the log up to `at`
with `clip` (`:208`, O(N)), then calls `runsOf(log, …)` (`:257`, filter + coalesce, O(N)) and
`timeIn(log, …)` (`:335`, O(N)) once or more. C grows with N, so the whole is O(N·C) = O(N²).

## The facts the rewrite rests on

- Entries are sorted by start and never overlap (`dutyLog.ts:16`, enforced by the parser).
- `runsOf(clip(entries, at), test)` equals the whole-log runs of `test` with every run starting
  at or after `at` dropped and the run containing `at` cut to end at `at`. Proof: `clip` drops
  entries starting at or after `at` and cuts the one straddling it; coalescing commutes with
  cutting at a single instant, because a cut can only shorten the last run.
- `timeIn(clip(entries, at), test, from, to)` equals `timeIn(entries, test, from, min(to, at))`.
- Length of time in a status set over `[from, to)` is additive over entries, which are disjoint
  (index authority row "half-open intervals").

## New internal structure

A new module `internal/dutyRunIndex.ts`, built lazily per `DutyContext` and kept for the call:

```ts
/** One status test's view of the whole log, built once per call. */
type RunIndex = {
  runs: readonly DutyRun[];        // whole-log runs (today's logRuns)
  runEnds: readonly bigint[];      // runs[i].end, for binary search
  entryPrefix: readonly bigint[];  // entryPrefix[i] = time in the test over entries[0..i)
};
function runIndex(context: DutyContext, test: StatusKey): RunIndex;
```

- `StatusKey` is a `StatusSet` or `{ not: StatusSet }`. The two closures in
  `evaluateRestBeforeDuty` (`:1037`, `isRest` and `!isRest`) become `rule.restStatuses` and
  `{ not: rule.restStatuses }`. No function-valued `StatusTest` remains, so every index is
  cacheable. `context.runs` becomes a `Map<StatusSet, RunIndex>` plus a second map for
  complements, both keyed by the resolved set object, which is created once per rule at
  resolution.
- Plain `bigint[]`, not `BigInt64Array`: epoch nanoseconds reach ±8.64e21, past 2^63.

Queries, each O(log N):

| Query | Replaces | How |
| ----- | -------- | --- |
| `timeInBefore(index, from, to, at)` | `timeIn(log, test, from, to)` with `log = clip(…, at)` | `cumulative(min(to, at)) - cumulative(from)`; `cumulative(t)` = `entryPrefix[k]` plus the matched part of the entry containing `t`, `k` found by binary search on entry starts |
| `runsUntil(index, at)` | `runsOf(log, test)` | A view `{ runs, count, last }`: the first `count` runs, the last cut at `at`. No copy |
| `lastAtLeastUntil(index, at, minimum)` | `lastAtLeast(runsOf(log, …), minimum)` | Check the cut last run first; then a per-`(test, minimum)` array `latestQualifying[i]` (index of the latest run at or before `i` whose length is at least `minimum`, or -1), built once |
| `countFrom(view, from)` | `events.filter((run) => run.start >= from).length` | Binary search on starts within the view |
| `runEndingAt(view, t)` | `rests.find((run) => run.end === t)` | Binary search on `runEnds` |
| `firstEntryAtOrAfter(context, t)` | `log.find(…)` (`:1148`) and `log[0]` | Binary search on entry starts |

Per-`(test, minimum)` arrays live in the same per-call cache, keyed by the minimum's bigint.

## Call sites to convert

Every `runsOf(log, …)`, `timeIn(log, …)` and `clip` in `evaluateRule`,
`evaluateRestRequirement` (`:959`) and `evaluateRestBeforeDuty` (`:1032`): lines 1126, 1132,
1145, 1148, 1174, 1217, 1235, 1263, 1281, 1289, 1294, 1300, 1324, 1368, 1378, 1392, 1398, 1411,
1417, 1462, 1467, 1539, 1554, 1577. Then delete `clip`.

- A site that filters runs **inside the rule's window** (`:1174`, `:1378`, `:1467`, `:1554`) first
  narrows the view to the window by binary search, then filters only those runs. That is the W
  term: bounded by the window, not by the log.
- `candidateInstants` (`:1993`–`2141`) reads whole-log runs once per rule; it switches to
  `runIndex(context, …).runs` so the runs are built once per call, not once per rule kind.

**The pairing loop** at `:2044`–`2062` compares every `near` rest with every other (O(R²) per
shift). Runs are sorted and disjoint, so for each `earlier` the `later` runs that do not
`continue` form one contiguous index range: those with `later.end > earlier.start - 2·shift`
and `later.start < earlier.end + 2·shift`. Find its first index by binary search and stop at
the first run past it. The inner loop still visits survivors **in the same increasing order**,
so its output is unchanged.

**`dutyPeriods.ts:212`** inserts each resolved span with `splice`. When `index === spans.length`
(the forward walk, every call today), `push` instead; keep `splice` for an out-of-order insert.

**External users** (`workforce/calculate/{qualifyingRestPairs,longestRun,qualifyingRests,dutyTotals}.ts`)
call the exported `runsOf`, `clipRuns`, `timeIn`, `restPairs` once per call, not per candidate:
leave them, and keep those exports.

## Tests

The existing rows are the contract: every `workforce/` and `internal/duty*` test stays green
on the full zone matrix, unchanged. New rows only where an invariant is newly load-bearing,
with expected values worked by hand from the log, never from the old implementation:

- `timeInBefore` on a log whose entry straddles `at`, whose `to` is past `at`, and whose `from`
  equals an entry boundary (half-open: an entry ending at `from` contributes nothing).
- `runsUntil` where `at` falls in a gap, at a run's start (the run is dropped), at a run's end
  (kept whole), and inside a run (cut).
- `lastAtLeastUntil` where the cut last run falls below `minimum` and an earlier one qualifies.
- The pairing loop: three rests a, b, c where (a, c) is beyond `2·shift` and (a, b), (b, c) are
  within it; output order matches the order each pair is found.
- An empty log and a one-entry log through each query.

Differential check (not a test): run the 7 d, 90 d and 365 d bench logs through the old and new
`dutyViolations` and diff the JSON. A difference is a defect in the new code until shown
otherwise; it never becomes an expected value.

## Bench

Add the 10-year row to `dutyViolations.bench.ts` (slice 1 deferred it). Record 7 d, 90 d, 365 d
and 10 y, before and after.

## Done when

- `clip` and the function-valued `StatusTest` are gone; no per-candidate O(N) remains.
- 365 d ≤ 5x 90 d in `pnpm bench`; all duty tests green; `pnpm run validate` green.
