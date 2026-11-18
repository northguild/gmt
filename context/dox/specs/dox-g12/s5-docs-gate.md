# Slice 5 · Docs, gate and first live run

[Index](./index.md) · Binding rules: [built/index.md § Rules](../../built/index.md#rules-that-bind-every-change),
[verification-and-risks.md](../../reference/verification-and-risks.md) · Needs: slices 1–4

## Goal

Every context file describes the evals as built, nothing still names the probe, `dox-tester`
runs the offline layer, and the first live run shows where the brains stand.

## `context/dox/built/tier-6-evals.md` (new)

Present tense, the decision and a one-line reason, no history. Sections:

- **What runs where.** The offline layer in `pnpm test` (corpus, `prepareTurn`, metrics, floors);
  the live layer by hand (`pnpm --filter @gmt/dox evals:live`).
- **Cases.** `evals/cases.ts`: kinds, the derived starters, the rewordings, how a chunk
  expectation resolves, the `live` subset. Add a case for every chat fault found from now on.
- **Floors.** Truncated to 3 decimals; below fails, above fails until `evals:baseline` raises
  it in the same PR; why it must run through Vitest.
- **Graders.** The check list, the identifier rule and why it reads the corpus, not the route
  manifest; ungraded runs.
- **When the live run is required.** Before merging a change to `worker/system-prompt.ts`,
  `worker/core-rules.md`, the vocabulary files or `select-vocabulary.ts`, `select-tools.ts`,
  `fit-chunks.ts`, `prepare-turn.ts`, `BRAINS`, or a brain's settings in `worker/brains.ts`. On
  `BRAINS[0]` by default; `--brains all` when `BRAINS` or a brain's settings change.
- **Quota and the budget guard.** 80 to 180 Neurons a question against 10,000 a day; Gemini
  allows about 20 requests a day per model. The live layer never runs in CI or `pnpm test`. A
  default run is `BRAINS[0]` and the live subset, under a 2,500-Neuron budget measured from the
  wrangler log; `--only` re-checks just the cases a fix touches; `--brains all` prints its cost
  and needs `--confirm-spend`; Gemini requests stop at a per-model cap and a reserve. Iterate on
  the offline layer, which is free, and spend live quota only on what it cannot see. A run waits
  `--delay-ms` between requests for the 20-a-minute limit.
- **Runbook.** The `wrangler dev` line from `tier-6-ops.md` (with `--var DOX_DEV_KEY:probe
  --var NORTHGUILD_GMT_GEMINI_API_KEY:` and the log redirect), then the `evals:live` line.
  Move the runbook here and leave `tier-6-ops.md` a one-line link.

Add the file to the `built/index.md` map, next to the other Tier 6 files.

## Probe references to replace

`rg -n probe-brains` must come back empty except under `.git`. Known sites:

- `context/dox/built/index.md:12`: "Only `pnpm dev`, `pnpm dev:chat`, `scripts/eval-live.ts` and
  real readers spend quota."
- `context/dox/built/tier-6-brains.md:18`: confirm a brain change with `eval-live.ts --brains <id>`.
- `context/dox/built/tier-6-ops.md:41` onward: the probe runbook becomes a link to
  [tier-6-evals.md § Runbook]. The Gemini-list refresh line says "then run `eval-live.ts` on the
  new ids".
- `context/dox/built/tier-6-chat.md:69`: the markup middleware line names the `markup` check.
- `.agents/dox-tester.md:94` and `context/dox/reference/verification-and-risks.md:65`
  ("Re-probe brains" becomes "re-run `eval-live.ts --brains all`").
- The two code comments are slice 4's.

Also correct `context/dox/overview.md`'s brain count: derive the wording from `BRAINS` (2
Workers AI brains, 3 Gemini brains today) and phrase it so it does not age, for example "a
Workers AI brain first, Gemini brains behind it", with no number.

## `dox-tester`'s gate

In `.agents/dox-tester.md`, Surface gates, **Chat:** list, add first:

- The offline evals pass: `pnpm --filter @gmt/dox exec vitest run evals/`. A changed floor in
  `evals/baseline.json` is explained in the PR, and a lowered floor is a finding.

Replace the live-checks line with: live checks spend real quota; when the diff touches a file
named in [tier-6-evals.md § When the live run is required], check that the PR carries a fresh
`evals/live-<brainId>.json` and that no case regressed. Run `evals:live` only on the owner's
word. Mirror both lines in `verification-and-risks.md`'s **Chat:** list. The frontmatter phrase
"chat grounding and citation integrity" stays; it now points at a real gate.

## `context/dox/specs/index.md`

The planning step adds the `dox-g12/` line under In progress; the finalizer deletes it at close.

## First live run (owner's word)

The builder stops after the docs and asks the main session to ask the owner. On his yes:

1. Warn him that his open `pnpm dox:dev` tools break while gmt rebuilds. Then build once, last:
   `pnpm --filter @northguild/gmt build`, then `pnpm --filter @gmt/dox build` (runs `generate`).
2. Start `wrangler dev` per the runbook, with the log redirect.
3. `pnpm --filter @gmt/dox evals:live -- --log <log>` on `BRAINS[0]`, the default budget. With no
   committed report yet, every case prints as new.
4. Report the pass count, each failing case with its checks, and the Neurons spent.

Failing cases go to [phase 6](./s3-fix-misses.md): fixed in this PR, re-checked with `--only`,
inside the story's live budget. Only when every live case passes is the report written with
`--write-baseline`. Stage nothing.

## Constraints

- Present tense in `built/`; no "this story", no dates, no fault narrative.
- The context files describe the current plan only; nothing in them cites this spec folder.
- Counts in docs are derived or omitted.

## Tests

No new tests. Run the full gates once, after phase 6: `pnpm dox:test`, `pnpm dox:lint`, `pnpm dox:check`,
`pnpm dox:docs-check`, `pnpm run validate`, then `dox-tester`.
