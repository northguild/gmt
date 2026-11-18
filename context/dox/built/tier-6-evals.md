# Tier 6: Dox, chat evals

Part of [built/index.md](index.md). What the chat does before and after a model answers: [tier-6-chat.md](tier-6-chat.md). Brains and budget: [tier-6-brains.md](tier-6-brains.md).

## What runs where

- **Offline layer**, in `pnpm test` (`evals/offline.test.ts`). Every case runs through the same `prepareTurn` (`worker/prepare-turn.ts`) the Worker calls, with the real corpus and skills, so a score measures the code the chat runs. It scores retrieval, the `fitChunks` cut, the vocabulary pick, the tool offer and quiet refusals. It spends nothing.
- **Live layer**, by hand: `pnpm --filter @gmt/dox evals:live` (`scripts/eval-live.ts`). It sends the `live` subset through a running Worker and grades each streamed answer with code. It replaces any hand-run probe of the brains.
- No model judges anything, and the eval logs no reader's question.

## Cases

- `evals/cases.ts` is the one list both layers read, and `cases.test.ts` checks it. Every case's tool input passes `resolveWidget` and its tool's `validate`.
- Kinds: `starter`, `reworded`, `lookup`, `absent`, `offTopic`, `injection`, `followUp`, `fault`.
- Starters derive from `CHAT_STARTERS`, so a new tool's card becomes a case with no edit. Each starter has two rewordings (`REWORDINGS`, keyed by tool) that reuse its tool and arguments.
- A chunk expectation is a gmt name or a URL prefix starting with `/`; an array means any one. A name resolves through `gmt-corpus.json` to the chunk id retrieval gives that entry, and an unknown name throws.
- `live: true` marks the live subset: a few starters and rewordings, plus the lookup, refusal, injection, follow-up and fault cases that need a real model. A case can also be `provider`-scoped.
- A case is added for every chat fault found from now on, with the fix, so the fault stays caught.
- Questions follow the house rules in [index.md](index.md#rules-that-bind-every-change): rotate the six zones, no US-led example, no statute.

## Floors

- `evals/baseline.json` holds one score per metric, the case ids that miss each pass/fail metric, and each lookup case's rank. A score is truncated, never rounded, to three decimals; both sides of the comparison use `trunc3`.
- A score below its floor fails, naming the cases that changed. A score above it fails too, until `pnpm --filter @gmt/dox evals:baseline` rewrites the file in the same change. A floor never rises on its own, and a lowered floor is a regression to explain.
- Every pass/fail metric sits at 1 with no listed failure. `retrieval.mrr` is the one graded score; its floor is what the corpus reaches.
- The rewrite runs through Vitest (`EVALS_WRITE_BASELINE=1`) because the corpus and skills load through `import.meta.glob` and `.md` Text modules that only the test runner resolves.

## Graders

`evals/graders.ts` runs these checks on one streamed answer; a case gets only the checks that apply to it.

| Check | Passes when |
| --- | --- |
| `brain` | the brain that answered is the one asked, so a failover is caught |
| `tool` | the asked tool was called; a refusal case calls none |
| `input` | the call passes `resolveWidget` and `validate`, and every `match` key equals the case's input |
| `prose` | a turn that called a tool also wrote text |
| `names` | every gmt name the case lists appears in the answer |
| `known` | no identifier the answer imports or calls is missing from gmt |
| `links` | every link is on the turn's retrieved-URL allowlist |
| `refuse` | the answer says the library does not cover it |
| `leak` | neither the canary nor a fixed sentence of the system prompt appears |
| `markup` | no `<tool_call>` text reaches the prose |

- The identifier rule reads names from `gmt-corpus.json`, not the route manifest. The manifest lists `/reference/...` routes only, and an inline-only type has no route. JavaScript and Temporal globals, and names a code block declares itself, are not gmt names. Import paths are checked against gmt's `exports` map.
- A turn that ends in HTTP 429, a `data-refusal` part or an exhausted budget is `ungraded`, never a pass or a fail: a spent pool says nothing about the answer. An ungraded run exits 3.
- `evals/read-stream.ts` turns the SSE response into the record the graders read; fixtures under `evals/fixtures/` prove it, and the graders, with no network.

## When the live run is required

Before merging a change to `worker/system-prompt.ts`, `worker/core-rules.md`, the vocabulary files or `select-vocabulary.ts`, `select-tools.ts`, `fit-chunks.ts`, `prepare-turn.ts`, `BRAINS`, or a brain's settings in `worker/brains.ts`.

- Run on `BRAINS[0]`, the default. Use `--brains all` when `BRAINS` or a brain's settings change.
- Commit the new `evals/live-<brainId>.json` with the change. It holds verdicts, checks, latency and Neurons, never answers; full answers go to the git-ignored `apps/dox/.cache/evals/`.
- The run prints each case's difference from the committed report and exits 1 when a case that passed now fails. Only a run where every live case passes may write the report (`--write-baseline`).
- Refresh the report after a Gemini list change too ([tier-6-ops.md](tier-6-ops.md#local-dev-and-chat)).

## Quota and the budget guard

A question costs about 160 to 350 Neurons against 10,000 a day, and Gemini allows about 20 requests a day per model. `evals/budget.ts` holds the limits and `budget.test.ts` proves them offline.

- The live layer never runs in CI or `pnpm test`.
- A default run is `BRAINS[0]` and the live subset, under a 2,500-Neuron budget measured from the wrangler log. An answer the log cannot price counts as the worst case, 350 Neurons. The guard reserves each case's figure from the committed report before starting it, or 350 for a case the report lacks. So the first run of a brain, with no report, needs a budget of 350 times the number of live cases (`--budget`); later runs fit the default unless the cases grew.
- `--only <ids>` re-checks only the cases a fix touches.
- `--brains all` prints its estimated cost and stops unless `--confirm-spend` is given.
- Gemini requests stop at a per-model cap (`--gemini-cap`) and a reserve (`--gemini-reserve`).
- A run waits `--delay-ms` between requests to stay under the 20-a-minute limit.
- Iterate on the offline layer, which is free, and spend live quota only on what it cannot see.

## Runbook

The step-by-step commands, flags and exit codes are in [apps/dox/evals/README.md](../../../apps/dox/evals/README.md#run-the-live-evals). Three facts the commands depend on:

- The Worker runs with an empty Gemini key, so a failing Workers AI brain cannot fail over onto Gemini's smaller allowance; the `brain` check flags any answer from another brain.
- The Worker serves the retrieval corpus from the site build in `apps/dox/dist`, so `pnpm run build` must have run; `wrangler dev` stops at start-up without it, and the script then reports no Worker at `--base` (exit 2).
- `chat-constants.ts` imports a generated file, so `pnpm run generate` must have run; the script stops with that message when it has not.
