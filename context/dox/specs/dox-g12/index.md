---
story: DOX-G12
issue: 511
status: approved
dox: none
---

# DOX-G12 · Evals for the Dox chat

Give the chat a fixed question set and two ways to score it. The **offline layer** runs inside
`pnpm test`, spends nothing, and scores what the Worker does before a model sees the question:
retrieval, the `fitChunks` cut, the vocabulary pick and the tool offer. It fails below committed
floors. The **live layer** replaces `scripts/probe-brains.ts`: it sends a dozen cases through a
running Worker and grades the streamed answers with code. It runs by hand, before a merge that
changes how the chat answers. Site work in `apps/dox` only: no new Dox tool or chat pill, no
`packages/gmt` change, no changeset. Blockers #408 and #409 are closed.

## Where the issue is out of date

Spec against the code, not the issue text:

- `context/dox/built.md` is now the `context/dox/built/` folder. The Evals section is a new
  `built/tier-6-evals.md`, linked from the `built/index.md` map.
- `.agents/dox-tester.md` has no gate called "chat grounding". The gate is a new line in its
  **Chat:** list under Surface gates.
- The probe runs every Workers AI brain by default, not `BRAINS[0]`. `BRAINS` holds 2 Workers AI
  brains and 3 Gemini brains, so `overview.md`'s "nine Gemini brains" line is stale.
- The pipeline is inline in `worker/chat-handler.ts`, and `selectVocabulary` returns joined
  bodies, not skill names. The offline layer needs both extracted first ([slice 2](./s2-offline.md)).
- `apps/dox/evals/` is outside every test glob (`src/test/isolation.ts`), so a test there would
  never run.
- The route manifest lists `/reference/...` paths only. Inline-only types have no route, so names
  are checked against `gmt-corpus.json` instead ([slice 4](./s4-live.md#identifiers)).
- 59 starters with 2 rewordings each make 177 cases, past the issue's "100 to 150". The owner
  chose about 220 cases in all; a rewording reuses its starter's tool and arguments.
- The probe does not run in this worktree today: `chat-constants.ts` imports a generated file
  that only `pnpm run generate` writes ([slice 4](./s4-live.md#loading-under-tsx-checked-during-planning)).

## Phases

One PR. Each phase is landed by `dox-builder` and checked by its own tests, lint and `check`.
Full gates and `dox-tester` run once, after phase 6.

| # | Phase | What it delivers |
| --- | --- | --- |
| 1 | [Cases](./s1-cases.md) | `evals/cases.ts`, its self-check test, the test globs that reach `evals/` |
| 2 | [Offline layer](./s2-offline.md) | `prepareTurn` and `chooseSkills` extracted; `offline.test.ts` in `pnpm test`; a first offline run that lists the misses |
| 3 | [Fix offline misses](./s3-fix-misses.md) | every offline miss fixed, iterating offline for free; final `baseline.json` with every pass/fail floor at 1 |
| 4 | [Live layer and graders](./s4-live.md) | `read-stream.ts`, `graders.ts`, `budget.ts` (all proven on fixtures), `scripts/eval-live.ts`; the probe deleted |
| 5 | [Docs, gate and first live run](./s5-docs-gate.md) | `built/tier-6-evals.md`, every probe reference, `dox-tester`'s gate; the first live run on `BRAINS[0]` (owner's word) |
| 6 | [Fix live misses](./s3-fix-misses.md#iterate-offline-spend-live-quota-only-where-offline-cannot-see) | every live-only miss fixed, re-checked with `--only`; `evals/live-cf-gemma-4-26b.json` written, all `pass` |

Phase 2 scores phase 1's cases; phase 4 grades their `live: true` subset; phase 5 documents 2 and
4; phases 3 and 6 follow [s3-fix-misses.md](./s3-fix-misses.md), which also holds the story's live
budget and the one case for stopping to report.

## Files

Create, under `apps/dox/`:

- `evals/cases.ts`, `evals/cases.test.ts` (1)
- `worker/prepare-turn.ts` + test, `evals/metrics.ts` + test, `evals/offline.test.ts`,
  `evals/baseline.json` (2, final in 3)
- `evals/{read-stream,graders,budget}.ts` + tests, `evals/fixtures/*.sse`, `scripts/eval-live.ts` (4)
- `evals/live-cf-gemma-4-26b.json` (6); `context/dox/built/tier-6-evals.md` (5)

Modify:

- `src/test/isolation.ts`, `src/test/isolation.test.ts`, `oxlint.config.mts` (test-rule globs) (1)
- `worker/chat-handler.ts`, `worker/select-vocabulary.ts` + test, `worker/vocabulary.ts` (stale
  "eight" comment), `src/lib/retrieval/search.test.ts`, `worker/select-tools.test.ts`,
  `package.json` (`evals:baseline`) (2)
- Whatever each miss's cause lives in, with a mechanism test (3, 6)
- `package.json` (`evals:live`), `worker/brains.ts:450` and `src/lib/chat-constants.ts:73`
  comments (4)
- `.agents/dox-tester.md`, `context/dox/built/{index,tier-6-brains,tier-6-chat,tier-6-ops}.md`,
  `context/dox/reference/verification-and-risks.md`, `context/dox/overview.md` (brain count) (5)

Delete: `scripts/probe-brains.ts` (4).

## Gates every phase passes

- `pnpm --filter @gmt/dox exec vitest run <the phase's test files>`, `pnpm dox:lint`, `pnpm dox:check`.
- No test touches the network (`src/test/no-network.mjs`) or spends quota.
- Counts are derived: no test asserts "59 starters" or "13 skills".
- Cases follow [international authority first and GMT tracks no law](../../built/index.md#rules-that-bind-every-change):
  rotate the six zones, no US-led question, no statute names.

## Decided

- **One code path.** The offline layer calls the same `prepareTurn` the handler calls.
- **Code graders only.** No model as judge, no Evalite or promptfoo, no logging of readers'
  questions.
- **Floors are exact, both ways.** Truncated to 3 decimals; below fails, above fails until
  `evals:baseline` rewrites the floor ([phase 2](./s2-offline.md#floors)).
- **No miss becomes a floor.** Every miss the first runs find is fixed in this PR (phases 3 and
  6); every pass/fail floor ends at 1 and every live case at `pass`.
- **The live report is committed, prose is not.** `evals/live-<brainId>.json` holds verdicts,
  latency and Neurons; full answers go to the git-ignored `apps/dox/.cache/evals/`.
- **The chat budget is guarded.** Never in CI or `pnpm test`; by default one brain and the live
  subset under a 2,500-Neuron run budget measured from the wrangler log; `--only` for re-checks;
  `--brains all` prints its cost and needs `--confirm-spend`; a per-model Gemini cap. The story
  spends at most 8,000 Neurons and no Gemini requests ([budget](./s3-fix-misses.md#live-budget-for-the-whole-story)).
- **Live runs and the gmt build need the owner's word.** He is warned first that the build breaks
  his open `pnpm dox:dev` tools; build once, last.

## Definition of done

- Every case's expected tool input passes `resolveWidget` and `entry.validate` (`cases.test.ts`).
- `pnpm dox:test` runs `evals/offline.test.ts`. Every pass/fail metric is 1 with no failures; a
  metric off its floor either way fails and names the cases that changed.
- `scripts/eval-live.ts` replaces the probe, enforces the budget guard (proven in
  `budget.test.ts`), prints the difference from the committed report and exits 1 on a regression.
- `evals/live-cf-gemma-4-26b.json` records every live case as `pass` with its Neurons, within the
  story's live budget.
- `rg probe-brains` finds nothing outside git history.
- `built/tier-6-evals.md` exists and the `built/index.md` map links it.
- `dox-tester`'s Chat list runs the offline layer and names when the live layer is required.
- `pnpm run validate` is green.

## Close-out

`dox-builder` updates `context/dox/built/` in present tense (phase 5). The tracker row moves to
Done when the story merges, then `pnpm deps:sync`. The finalizer deletes this folder and its line
in `specs/index.md`.
