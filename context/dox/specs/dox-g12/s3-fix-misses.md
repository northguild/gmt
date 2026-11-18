# Phases 3 and 6 · Fix the misses

[Index](./index.md) · Binding rules: [built/index.md § Rules](../../built/index.md#rules-that-bind-every-change),
[tier-6-chat.md](../../built/tier-6-chat.md), [tier-6-brains.md](../../built/tier-6-brains.md)

## Goal

Every miss the first runs find is fixed in this PR before its floor or live report is set. A case
the chat misses is a bug (zero known bugs), so no floor or report records one, and nothing is
deferred to a follow-up story.

## What counts as a miss

- **Offline (phase 3):** a case id in any pass/fail metric's `failures` after slice 2's first run:
  `retrieval.recallAt10`, `retrieval.withinK`, `fit.kept`, `vocabulary.hit`, `tools.offered`,
  `refusal.quiet`. A rank below 1 in `retrieval.mrr` is not a miss.
- **Live (phase 6):** a `fail` verdict from the first live run (phase 5) on a check that only the
  live layer can see: `brain`, `tool` (called), `input`, `prose`, `names`, `known`, `links`,
  `refuse`, `leak`, `markup`. An `ungraded` case is not a miss; it is re-run inside the budget.

## How to fix

- Fix the cause in the chat: retrieval (`src/lib/retrieval/`), `fit-chunks.ts`, the tool index in
  `select-tools.ts`, the vocabulary skills or `select-vocabulary.ts`, `system-prompt.ts`,
  `core-rules.md`, the middleware, or a brain's settings. Each fix gets a mechanism test where the
  cause is a mechanism (for example, a tokeniser change gets a `search.test.ts` pin).
- A case may change only when its own expectation is wrong: it names the wrong function, or a
  rewording asks for something its starter's arguments do not answer. Say so in the handback, one
  line per case. Never loosen a case, drop it, or move it out of a metric to make a number rise.
- A gmt function that is missing or misdocumented is not a Dox fix: stop and report it, because
  `packages/gmt` work goes through the library pipeline.

## Iterate offline; spend live quota only where offline cannot see

- **Phase 3 runs offline only.** Re-run `pnpm --filter @gmt/dox exec vitest run evals/` and
  `evals:baseline` as often as needed; they cost nothing. When every pass/fail metric is 1 and its
  `failures` list is empty, write the final `baseline.json`.
- **Phase 6 re-runs only the affected cases.** After a fix, re-check with
  `evals:live --only <ids>` (the failed cases plus, when the fix touched a shared file such as
  `system-prompt.ts`, the rest of the live subset once at the end). Run the offline layer after
  every live-side fix as well; a prompt or vocabulary change must not move an offline floor.
- When every live case passes, write `evals/live-cf-gemma-4-26b.json` with `--write-baseline`.

## Live budget for the whole story

All live runs in this story are on `BRAINS[0]` (`cf-gemma-4-26b`), on the owner's word each day.

| Limit | Value | Why |
| --- | --- | --- |
| Neurons per run | the script's default `--budget 2500` | 12 cases at the 180-Neuron worst case is 2,160 |
| Neurons per UTC day, all runs | 3,000 | leaves 7,000 of the 10,000 allowance to readers |
| Neurons for the story, all days | 8,000 | about 3 full subsets plus targeted re-runs |
| Gemini requests | 0 | `BRAINS` does not change here; the stall case's graders are proven on fixtures |

The builder keeps a running total from each report's `neurons` and states it in every handback.
Before a run that would cross a limit, stop and ask the main session.

## Stop and report

Stop and report to the owner, through the main session, only when a miss cannot be fixed without
changing a decision in [index.md § Decided](./index.md#decided): for example, a rewording no
search change can reach without breaking another case, a fix that needs a model as judge, or a
brain that cannot pass a check whatever the prompt says (that last one is a `BRAINS` decision).
Name the case, what was tried, and the decision it would change.

## Tests

The same as slices 2 and 4, plus one mechanism test per fixed cause. Phase 3 ends with the final
`baseline.json`; phase 6 ends with the committed live report, all `pass`.
