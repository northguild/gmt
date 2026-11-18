# Slice 2 · Offline layer and baseline

[Index](./index.md) · Binding rules: [built/index.md § Rules](../../built/index.md#rules-that-bind-every-change),
[tier-6-chat.md](../../built/tier-6-chat.md) · Needs: [slice 1](./s1-cases.md)

## Goal

`pnpm test` scores every case on the steps the Worker runs before the model, through the same
code the Worker runs, and fails when a score moves off its committed floor.

## Extract the pipeline

Today `worker/chat-handler.ts` (around lines 242–280) builds the query, searches, fits, selects
tools and selects vocabulary inline. Move that into `worker/prepare-turn.ts`:

```ts
export function queryOf(messages: readonly UIMessage[]): string; // last user turn's text parts, joined
export async function prepareTurn(input: {
  messages: readonly UIMessage[];
  pageContext: string | undefined;
  search: (query: string, options: { namespace?: string }) => RetrievalChunk[] | Promise<RetrievalChunk[]>;
  skills: readonly VocabularySkill[];
}): Promise<{
  query: string;
  searched: readonly RetrievalChunk[];   // before fitChunks: retrieval metrics read this
  retrieved: readonly RetrievalChunk[];  // after fitChunks: prompt, allowlist and trace read this
  offered: readonly DoxToolName[];
  chosen: readonly VocabularySkill[];
}>;
```

The handler passes `search: (q, o) => watch.time("search", () => searchChunksImpl(chunks, q, o))`,
so the `search` timing stays where it is, then builds the prompt from the result with
`vocabulary: joinSkills(chosen)`. Nothing else in the handler changes; its existing tests must pass
unedited. `namespaceFromPageContext` moves inside `prepareTurn`.

In `worker/select-vocabulary.ts`, split `selectVocabulary` into `chooseSkills(skills, retrieved,
budget = VOCABULARY_BUDGET_CHARS): VocabularySkill[]` and `joinSkills(chosen): string`, and keep
`selectVocabulary` as their composition only if another caller still needs it (delete it if not).
Its tests move to `chooseSkills` and assert names, which is stronger than matching joined text.

`worker/prepare-turn.test.ts` pins the extraction: with a stub `search`, `retrieved` equals
`fitChunks(searched)`, `offered` equals `selectTools({query, retrieved, messages})`, the
namespace bias reaches `search`, and `queryOf` joins only the last user turn's text parts.

## `evals/metrics.ts`

Pure. `scoreCases(cases, run)` takes each case's `prepareTurn` result and returns
`{ metrics: Record<MetricName, number>, failures: Record<MetricName, string[]>, ranks: Record<string, number> }`.
`failures` lists the case ids that missed a pass/fail metric; `ranks` holds each `chunks` case's
rank of its first expectation (0 when absent). Names and definitions:

| Metric | Cases | A case passes when |
| --- | --- | --- |
| `retrieval.recallAt10` | cases with `chunks` | micro-averaged: each expectation counts once; it hits when any of its URLs (name-resolved or prefix) is in `searched` top 10 |
| `retrieval.mrr` | cases with `chunks` | mean of 1 / rank of the first expectation in `searched` (0 when absent). A ranking score, not pass/fail: it has no failures, and its diff prints the cases whose rank changed |
| `retrieval.withinK` | cases with `k` | the first expectation ranks at or above `k` |
| `fit.kept` | cases with `chunks` | every expectation hit in `searched` top 10 is still in `retrieved` |
| `vocabulary.hit` | cases with `skill` | `chosen` contains `skill` (`null`: `chosen` is empty) |
| `tools.offered` | cases with `tool` | `offered` contains `tool` |
| `refusal.quiet` | `offTopic` cases | `searched.length < 5` |

`absent` cases are left out of `refusal.quiet` on purpose: "sunrise" retrieves real time chunks,
and refusing is the model's job, graded live. `injection` cases have no offline metric.

## `evals/offline.test.ts`

Builds the corpus once with `buildRetrievalCorpus()` (Vitest only: it uses `import.meta.glob`),
the skills from `VOCABULARY_SKILLS` (Vitest only: `.md` Text imports), runs `prepareTurn` for every
case with `search: (q, o) => searchChunks(corpus, q, o)`, and scores them.

### Floors

`evals/baseline.json`:

```json
{ "metrics": { "retrieval.mrr": 0.874, "retrieval.recallAt10": 1, "...": 1 },
  "failures": { "retrieval.recallAt10": [], "...": [] },
  "ranks": { "lookup-format-date": 1, "...": 2 } }
```

Every pass/fail metric's floor is 1 and its `failures` list is empty once phase 3 is done: a case
the chat misses is a bug, fixed in this PR, never a floor. `retrieval.mrr` is the one floor below
1, because a correct chunk at rank 2 is not a miss.

- Values are truncated (not rounded) to 3 decimals, on both sides of the comparison. The run is
  deterministic, so no tolerance band.
- One `it` per metric. It fails when `trunc3(measured) < floor`, and also when
  `trunc3(measured) > floor`: a rise raises the floor in the same PR.
- Each failure message names the metric, both values, the case ids that now fail and the ids that
  now pass (set difference against `failures`; for `retrieval.mrr`, the ids whose rank moved
  against `ranks`), and the command that rewrites the file.
- A metric with no eligible cases is an error, not a 1.0.
- `pnpm --filter @gmt/dox evals:baseline` rewrites the file: a `package.json` script
  `"evals:baseline": "pnpm run generate && EVALS_WRITE_BASELINE=1 vitest run evals/offline.test.ts"`.
  With the variable set, the test writes `baseline.json` (keys sorted, 2-space indent, trailing
  newline) and passes. It must go through Vitest because the corpus and skills load only there.
- An added or removed case changes the denominators; the rewrite is the same command.

**First run.** End this slice by running `evals:baseline` once to see where the chat stands. Every
case in a pass/fail metric's `failures` is a miss that [phase 3](./s3-fix-misses.md) fixes before
the floors are final. Do not commit to that first file as the floors.

## Moving tests

Quality questions move into `cases.ts` (slice 1) and leave their old test. Mechanism tests stay.

| File | Moves into cases | Stays |
| --- | --- | --- |
| `src/lib/retrieval/search.test.ts` | the DOX-C1 spread (formatDate, UTC to Tokyo, DST gap, `addBusinessDay`); the GNSS and leap-second set; fiscal and workforce; SWIFT, GTFS and PTP; the camelCase pair; `OFF_DOMAIN` | result count per question; namespace bias; guide chunks exist; guide URLs resolve; the conceptual-question guide share; "an everyday word inside an identifier" (sourdough returns `[]`); "no full context out of weak matches" (pasta 2 or fewer); one index per corpus; warm equals cold |
| `worker/select-tools.test.ts` | the starter `it.each` (now the `tools.offered` metric over starter and reworded cases); the FHIR questions | core tools first; at most core plus `MATCHED_TOOL_COUNT`; enabled only; history keeps a tool; a non-enabled history part is ignored |

A moved question must exist as a case before its test is deleted. It passed as a test, so if it
misses through `prepareTurn` (the old tool test skipped `fitChunks`), that is a phase 3 fix;
never weaken the case to pass.

## Constraints

- No network, no model, no AI binding: the offline layer touches only the corpus, the skills and
  pure functions.
- `evals/metrics.ts` imports no `.md` and no `import.meta.glob`, so slice 4 can reuse its name
  resolver under tsx. Name resolution reads `gmt-corpus.json` (`~/generated/reference/corpus`).
- No count in a test: denominators come from `CASES`.
- The test leaves no timers or pending work; `prepareTurn` is awaited per case.

## Tests

`worker/prepare-turn.test.ts`, the `chooseSkills` tests, `evals/metrics.test.ts` (hand-made
results: a hit at rank 3 gives MRR 1/3, a missing expectation fails recall, a prefix matches,
an empty eligible set throws), `evals/offline.test.ts`, the trimmed `search.test.ts` and
`select-tools.test.ts`, and the unedited `chat-handler` tests.
