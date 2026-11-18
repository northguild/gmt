# Dox chat evals

Tests for the Dox chat. A fixed set of questions, each with what a good answer needs, scored by
code. A change that makes the chat answer worse fails a check before it ships.

There are two layers:

| Layer | Tests | Runs | Costs |
| --- | --- | --- | --- |
| **Offline** | Our code before the model: search, the context cut, the skill pick, the tool offer | In `pnpm test`, every time | Nothing |
| **Live** | The model's answer: right tool and input, real function names, refusals, no leaks | By hand, before merging a chat change | Workers AI Neurons |

"Offline" means no model is called. It has nothing to do with the site working without a network.

The rules behind both layers (floors, graders, budgets) are in
[context/dox/built/tier-6-evals.md](../../../context/dox/built/tier-6-evals.md).

## Files

| File | What it holds |
| --- | --- |
| `cases.ts` | The questions. Each case says what a good answer needs: chunks, skill, tool, input, names, refusal |
| `cases.test.ts` | Checks the cases themselves: real functions, valid tool inputs, house rules |
| `offline.test.ts` | Runs every case through `worker/prepare-turn.ts` and compares the scores with `baseline.json` |
| `metrics.ts` | Turns case results into scores |
| `baseline.json` | The committed offline scores (floors) |
| `read-stream.ts`, `graders.ts` | Read a streamed live answer and grade it |
| `budget.ts` | The live run's spending limits |
| `report.ts` | The live report, its diff and how it is written |
| `fixtures/*.sse` | Recorded answers that prove the graders with no network |
| `live-<brainId>.json` | The committed live report for one brain: verdicts, latency, Neurons |
| `../scripts/eval-live.ts` | The live runner |

## Run the offline evals

From the repo root:

```bash
pnpm --filter @gmt/dox exec vitest run evals/
```

They also run in `pnpm dox:test` and CI. A score that moves either way fails and names the cases
that changed:

- **Lower:** something got worse. Fix the cause.
- **Higher:** something got better. Raise the floor in the same change:

  ```bash
  pnpm --filter @gmt/dox evals:baseline
  ```

## Run the live evals

### Before the first run

All from `apps/dox`:

1. Build gmt once in this checkout, if `packages/gmt/dist` is missing:
   `pnpm --filter @northguild/gmt build`. A build breaks the tools on any open `pnpm dox:dev` page
   until it finishes and the page is reloaded.
2. Build the site: `pnpm run build`. It takes a few minutes. The Worker serves the chat's search
   corpus from `apps/dox/dist`, and `wrangler dev` stops at start-up without it. Build again
   after changing docs or guides. A change under `worker/` needs no rebuild, because
   `wrangler dev` bundles the Worker from source.
3. Log in to Cloudflare and pick the NorthGuild account: `npx wrangler login`.

### Each run

**Terminal 1** starts the Worker. `tee` shows its output and also writes the log file, which the
eval reads to count Neurons. Wait for `Ready on http://localhost:8799`, then leave it running.

```bash
npx wrangler dev --port 8799 --var DOX_DEV_KEY:probe --var NORTHGUILD_GMT_GEMINI_API_KEY: \
  2>&1 | tee /tmp/dox-wrangler.log
```

The empty Gemini key stops a failed Workers AI answer from falling over onto Gemini's smaller
allowance.

**Terminal 2** runs the evals. To try one case first (at most 350 Neurons):

```bash
pnpm run evals:live --base http://localhost:8799/gmt --log /tmp/dox-wrangler.log --only starter-showGlobe
```

The whole live subset on the first brain in `BRAINS`:

```bash
pnpm run evals:live --base http://localhost:8799/gmt --log /tmp/dox-wrangler.log
```

The 12 cases cost about 2,200 to 2,400 Neurons. The run reserves 350 for each case before
starting it and stops before it would overspend, marking the cases it did not reach as ungraded.
So a full run needs a budget above the default of 2,500:

```bash
pnpm run evals:live --base http://localhost:8799/gmt --log /tmp/dox-wrangler.log --budget 2900
```

### Reading the result

Each case prints `pass`, `fail` with the check that failed, or `ungraded`, and its Neurons. The
run ends with the total and the difference from the committed `live-<brainId>.json`.

| Exit code | Meaning |
| --- | --- |
| 0 | Clean |
| 1 | A case that passed in the committed report now fails |
| 2 | Usage error or nothing to run against: a missing `--log`, `pnpm run generate` not run, or no Worker at `--base` |
| 3 | Some cases were ungraded: rate limit, spent quota or the run budget |

Full answers go to `apps/dox/.cache/evals/`, which git ignores.

### Useful flags

| Flag | Does |
| --- | --- |
| `--only <id,...>` | Re-run just these cases, after a fix |
| `--brains <id,...>` | Run other brains. `--brains all` prints its cost and stops unless you add `--confirm-spend` |
| `--budget <n>` | Neuron limit for this run (default 2,500) |
| `--write-baseline` | Write `live-<brainId>.json`. Only when every case passes, and commit it with the change |
| `--help` | Every flag. Spends nothing |

The runner refuses to run in CI.

## When the live run is required

Before merging a change to the system prompt, `worker/core-rules.md`, the vocabulary skills, tool
or skill selection, `fit-chunks.ts`, `prepare-turn.ts`, `BRAINS`, or a brain's settings. The full
list is in [tier-6-evals.md](../../../context/dox/built/tier-6-evals.md#when-the-live-run-is-required).

## What it costs

| | Allowance | One question |
| --- | --- | --- |
| Workers AI | 10,000 Neurons a day, shared with readers | 160 to 350 Neurons |
| Gemini | About 20 requests a day per model | 1 request |

Iterate on the offline layer, which is free. Spend live quota only on what it cannot see.

## Add a case

Add it to `cases.ts`, in the list for its kind. For every chat fault found, add a case with the
fix, so the fault stays caught. Then run the offline evals: `cases.test.ts` checks the new case,
and `offline.test.ts` shows whether its scores moved.
