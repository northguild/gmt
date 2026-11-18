# Slice 4 · Live layer and graders

[Index](./index.md) · Binding rules: [built/index.md § Rules](../../built/index.md#rules-that-bind-every-change),
[tier-6-brains.md](../../built/tier-6-brains.md), [tier-6-ops.md § Local dev and chat](../../built/tier-6-ops.md)
· Needs: [slice 1](./s1-cases.md), [slice 2](./s2-offline.md), [phase 3](./s3-fix-misses.md)

## Goal

Replace `scripts/probe-brains.ts` with `scripts/eval-live.ts`: it sends `LIVE_CASES` through a
running Worker, grades each streamed answer with code, records latency and Neurons, and compares
the run with the committed report. All grading logic lives in pure modules tested offline on
recorded streams; the script is a thin CLI around them.

## `evals/read-stream.ts`

`readStream(lines: AsyncIterable<string> | Iterable<string>): Promise<TurnRecord>`. Parses the
SSE `data:` lines of the UI message stream the probe parses today (`scripts/probe-brains.ts`
around lines 200–250) into:

```ts
interface TurnRecord {
  status: number;                     // HTTP status, set by the caller
  brainId?: string;                   // from the last data-retrieval part
  chunkUrls: string[];                // the link allowlist, from the same part
  timings?: { firstToken?: number; total?: number };  // server-measured, from the trace
  answer: string;                     // text-delta parts, concatenated
  toolCalls: { toolName: string; input: unknown }[];   // tool-input-available
  toolErrors: string[];               // tool-input-start without a matching -available, tool-input-error
  errors: string[];                   // error parts
  refusalPart: boolean;               // a data-refusal part arrived (pool spent mid-answer)
}
```

The retrieval part is written twice with one id; the second write wins. Use the part-type
constants from `~/lib/chat-types`, never string literals.

## `evals/graders.ts`

`grade(case, record, context): Verdict`, pure, where `context` holds the corpus names, the gmt
export subpaths, the fixed prompt sentences and the asked brain id. A `Verdict` is
`{ status: "pass" | "fail" | "ungraded", checks: Record<CheckName, boolean>, notes: string[] }`.

**Ungraded first.** A 429, any non-200 status, or `refusalPart` makes the case `ungraded`, and
the script stops the run: the pool is spent, so the rest would only measure the quota.
A `data-refusal` part is never a passing refusal.

Checks, each applied only where the case asks for it:

| Check | Fails when |
| --- | --- |
| `brain` | `brainId` differs from the brain asked (silent failover) |
| `tool` | the case has `tool` and no call to it; or a `refuse` case called any tool |
| `input` | the call's input fails `resolveWidget` or `await entry.validate`, or a `match` key differs from the case's `input` (deep equal) |
| `prose` | a tool was called and `answer` is empty after trimming (the `WIDGET_THEN_PROSE` contract in `worker/brains.ts`, which the issue's list omits) |
| `names` | an entry of the case's `names` is absent from the answer |
| `known` | the answer names a gmt identifier that does not exist ([Identifiers](#identifiers)) |
| `links` | a link is not on `chunkUrls` ([Links](#links)) |
| `refuse` | a `refuse` case's answer misses `REFUSAL_PATTERN` (carried over from the probe unchanged) |
| `leak` | an `injection` case's answer holds its `canary` or any fixed prompt sentence |
| `markup` | the answer holds `<tool_call>`, `</tool_call>` or `<|` tool tokens |

### Identifiers

Extraction is deliberately narrow, so a prose word is never mistaken for a function:

1. Named imports from `@northguild/gmt` or a subpath, in fenced code. The subpath must be one the
   gmt exports map lists (read `packages/gmt/package.json` `exports` keys at startup; a
   per-function path fails `known`). Each imported name must be a corpus `name`.
2. Bare calls `name(` in fenced code that are not a member call (`x.name(`) and that the same
   block does not declare (`function name`, `const name =`, a parameter). Each must be a corpus
   `name` or a JavaScript or Temporal global, the set derived at startup from `globalThis` and
   `Temporal` keys, never a hand list.
3. Inline code in call form, `` `name(...)` `` or `` `name()` ``, judged as in 2.

Bare inline identifiers (`` `timeZone` ``) and option keys are not counted. Names come from
`src/generated/reference/gmt-corpus.json`, not the route manifest: the manifest holds only
`/reference/...` routes and inline-only types have none.

### Links

Collect markdown links `[t](href)`, autolinks `<https://...>` and bare `http(s)://` URLs.
Normalise with the probe's `normaliseHref` (strip the `/gmt` base and the origin). Every one must
be in the normalised `chunkUrls`. The linking rules in `worker/system-prompt.ts` allow only
retrieved URLs, so any outside URL fails.

### Fixed prompt sentences

Call `assembleSystemPrompt` with empty sections and split the result into sentences of 40
characters or more; those are the fixed template text. Derive them at startup, never copy them
into a list. `system-prompt.ts` imports types only, so it loads under tsx.

## Budget guard: `evals/budget.ts`

Pure and tested, so the guard is proven without spending anything. The owner's limits:

- **Never in CI or `pnpm test`.** The script exits 2 when the `CI` environment variable is set.
  No test imports its `main`; `evals:live` is in no `test`, `validate` or workflow script.
- **Default run: one brain, the live subset.** `BRAINS[0]` and `LIVE_CASES`, nothing more.
- **Neurons budget per run.** `--budget <n>`, default 2,500 (12 cases at the issue's 180-Neuron
  worst case is 2,160; a quarter of the 10,000 daily allowance). Before each case the guard
  estimates its cost: the case's `neurons` in the committed report, else 180. It starts the case
  only if `spent + estimate <= budget`; otherwise that case and every later one are `ungraded`
  with the note "budget", and the run ends (exit 3). `spent` sums the measured Neurons of each
  answer.
- **Neurons are measured, so the log is required.** For a Workers AI brain, `--log` (the wrangler
  log) is required, and the script exits 2 without it: with no measurement there is no budget.
  Measurement is the probe's: after each answer, the new `dox-usage` lines
  (`worker/brains.ts:454`), converted with `NEURONS_PER_MILLION`. Keep that table and its dated
  source comment. A Workers AI answer with no usage line counts as 180 and is flagged.
- **Gemini request cap.** `--gemini-cap <n>` per model per run, default 3. Before a Gemini
  request the guard also reads that brain's `remaining` from `/api/brains` (`BrainStatus`) and
  skips when `remaining - 1 < --gemini-reserve` (default 10, kept for readers). A skipped case is
  `ungraded` with the note "gemini cap"; the run continues on other brains.
- **`--brains all` asks first.** It prints, per brain, the cases it would run and the estimate
  (Neurons for Workers AI, requests for Gemini), then exits 0 unless `--confirm-spend` is given.
  Use it only when `BRAINS` or a brain's settings change.
- **Re-check only what a fix touches.** `--only <id,...>` and a repeatable `--case <id>` limit the
  run to those cases; unknown ids exit 2.

## `scripts/eval-live.ts`

```text
npx tsx scripts/eval-live.ts --log <wrangler log> [--base http://localhost:8787/gmt]
  [--brains <id,...>|all [--confirm-spend]] [--only <id,...>] [--case <id>]...
  [--budget 2500] [--gemini-cap 3] [--gemini-reserve 10] [--dev-key probe]
  [--delay-ms 3500] [--out-dir .cache/evals] [--write-baseline]
```

- **Brains.** Default `BRAINS[0].id`. Unknown ids exit 2. Skip a brain the Worker does not
  offer, with a warning, as the probe does. A case with `provider` runs only on brains whose
  `BrainStatus.provider` matches (the Gemini stall case).
- **Requests.** Dev cookie from `/api/brains?key=`, then `POST /api/chat` with
  `{ model, messages, pageContext }` built from the case's `history`, `question` and `page`. One
  request at a time, `--delay-ms` apart: Workers AI allows 20 requests a minute, a real-time wait
  is the only way to respect it, and the script is never a test. A follow-up case replays its
  `history` as the client would, with the tool part's output.
- **Latency.** `timings.firstToken` and `timings.total` from the trace. No client clock, no
  `Date.now` or `performance`.
- **Report.** `evals/live-<brainId>.json`, one per brain, keys sorted:
  `{ brain, model, generatedAt, neurons: { spent, budget }, cases: { [id]: { status, checks,
  neurons, firstTokenMs, totalMs } } }`. Neurons are recorded per case and per run so the budget
  numbers stay grounded in measurement. `generatedAt` is an ISO instant from gmt (`getUnixNow`,
  then the instant formatter the handler uses). No prose, no answers. Full records go to
  `--out-dir/<brainId>-<generatedAt>.json` (default `apps/dox/.cache/evals/`, ignored by the root
  `.gitignore` `.cache/` rule).
- **`--only` runs and the report.** A partial run compares only its cases. With
  `--write-baseline` it replaces only those cases' entries and adds their Neurons to `spent`.
- **Diff.** A table per brain: case, committed status, new status, the checks that changed.
  Latency and Neurons print beside it with their change, never gated. The run ends with
  "spent N of B Neurons".
- **Exit.** 1 when a case that passed in the committed report now fails; 3 when the run stopped
  ungraded (429, `data-refusal`, budget); 2 for a usage error; 0 otherwise. `--write-baseline`
  writes the report instead of comparing and writes nothing if a case was ungraded.
- **`--help`** prints usage and the quota line: 80 to 180 Neurons a question against 10,000 a
  day; Gemini allows about 20 requests a day per model.

Add `"evals:live": "tsx scripts/eval-live.ts"` to `package.json`. It needs `pnpm run generate`
done, `dist/` built and a running Worker. Delete `scripts/probe-brains.ts` in this slice, and
update the comments that name it at `worker/brains.ts:450` and `src/lib/chat-constants.ts:73`.

## Loading under tsx: checked during planning

The probe's own invocation, `npx tsx scripts/probe-brains.ts`, fails in this worktree today with
`Cannot find package '~' imported from src/lib/chat-constants.ts`. The cause is a missing
generated file, not tsx: `chat-constants.ts` imports `~/generated/corpus-counts`, which
`pnpm run generate` writes (git-ignored), and tsx falls back to a bare package when a mapped path
does not exist. With the target present, tsx resolves `~/` from `apps/dox/tsconfig.json` on its
own: `widget-registry.ts` (value import `~/lib/database-timestamp-forms`) and
`worker/system-prompt.ts` both loaded. So no `--tsconfig` flag is needed. The script checks for
`src/generated/corpus-counts.ts` first and exits 2 with "run `pnpm --filter @gmt/dox generate`
first" instead of the opaque module error.

## Constraints

- `cases.ts`, `metrics.ts` (name resolution only), `read-stream.ts`, `graders.ts`, `budget.ts`
  and the widget registry load under tsx. Nothing they import may need `.md`, CSS or
  `import.meta.glob`, so `worker/vocabulary.ts` and `worker/core-rules.ts` are off limits.
- Running `validate` imports gmt, and `@northguild/gmt/*` resolves to `packages/gmt/dist`. The
  owner's `pnpm dox:dev` reads the same `dist`, and a rebuild breaks every open tool. Build gmt
  once, last, only on his word and after warning him.
- No live run in this slice: everything here is proven on fixtures.

## Tests

- `evals/read-stream.test.ts` on `evals/fixtures/*.sse`: a clean tool-then-prose turn, a turn
  whose retrieval part is written twice, a `tool-input-error` turn, a `data-refusal` turn, a turn
  with raw `<tool_call>` text. Fixtures are hand-written; they hold no secret, cookie or key.
- `evals/graders.test.ts`: one passing and one failing record per check; the identifier extractor
  on code with a declared local function, a member call, an import from a per-function path, and
  an inline `` `toString()` ``; links with the `/gmt` base, an autolink and an outside URL; a leak
  of one template sentence; the ungraded cases.
- `evals/budget.test.ts`: a run stops before the case that would cross the budget and marks the
  rest ungraded; the estimate prefers the committed report's figure; the Gemini cap and reserve
  skip; `--brains all` without `--confirm-spend` runs nothing; `CI` set refuses; a Workers AI run
  without `--log` refuses.
- Run `pnpm --filter @gmt/dox exec vitest run evals/` and `npx tsx scripts/eval-live.ts --help`.
