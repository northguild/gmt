# Tier 6: brains, budget and traps

Part of [built/index.md](index.md). Chat surface: [tier-6-chat.md](tier-6-chat.md). Operator steps: [tier-6-runbooks.md](tier-6-runbooks.md).

## Brains and budget

- `BRAINS` (`src/lib/chat-constants.ts`) is in preference order and `BRAINS[0]` is the default. Workers AI `cf-gemma-4-26b` and `cf-glm-4.7-flash` lead (badge 40 a day each); Gemini `gemini-3.5-flash-lite`, `gemini-3.6-flash` and `gemini-3.5-flash` follow (about 20 a day each).
- Allowances live in `BRAIN_PROVIDERS`. Gemini is per project per model and resets at midnight Pacific. Workers AI is 10,000 Neurons a day per account, shared by its brains, and resets at 00:00 UTC. Exhaustion fails rather than bills on the Free plan, so stay on Free.
- The ledger (`worker/usage.ts`, KV `DOX_USAGE`) is advisory: it drives the badge, the provider's error is the gate. Keys bucket by the provider's day. The visitor cap is on the UTC day (`VISITOR_CAP_TIME_ZONE` in `src/lib/pt-day.ts`). Writes are best-effort; visitors are hashed IPs.
- `VISITOR_DAILY_MAX` is 5. Recompute it whenever `BRAINS` changes.
- Failover (`openFirstWorkingBrain`, `worker/brains.ts`):
  - It waits for the first content part (`onChunk`), racing `result.warnings`, and unwraps `RetryError` and `NoOutputGeneratedError` before classifying.
  - `429` is `spent`; `404`/`400` (and Workers AI `403`) is `unavailable`; anything else rethrows. `maxRetries: 0`.
  - The reader's pick leads (`orderCandidates`), then registry order; known-out brains go last and are never pruned.
  - A slow brain is skipped with outcome `slow` (`BRAIN_START_TIMEOUT_MS`: Gemini 15 s, Workers AI 20 s). `BrainsTimedOutError` becomes a retryable `503` through `mapUpstreamError`.
  - Workers AI allocation exhaustion (`3036`, or the unmapped `4006`) retires every Workers AI brain. A capacity `429` (`3040`) is transient and marks nothing.
  - `isTransientOverload` (`503`, `529`) moves on with outcome `busy` and writes nothing. A `500` stops at the first brain.
- Thinking is off on every brain. Gemini `thinkingLevel` is `"low"`, passed as `providerOptions.google.thinkingConfig`; a brain that stops calling its widget under low moves to medium. Workers AI sends `enableThinking: false` as `chat_template_kwargs` (`worker/workers-ai-settings.ts`); `reasoning_effort` does not work. Confirm with `probe-brains.ts` after any change.
- Workers AI wiring: `workers-ai-provider@4` over the `AI` binding (`remote: true`); `worker/index.ts` offers only configured brains; `maxOutputTokens: 2048` per brain. Every answer logs a `dox-usage` line.
- Probe results: kept gemma-4-26b-a4b-it and glm-4.7-flash. Dropped llama-3.3-70b and mistral-small-3.1 (`workers-ai-provider@4.0.0` duplicates deltas; re-probe when fixed), gpt-oss-120b, qwen3.8-27b and nemotron-3-120b (about 600 Neurons a prompt) and paid-plan models (error `5035`).
- A local `wrangler dev` spends the Neurons of the logged-in account.

## Traps

- A `white-space: nowrap` rule over `<wbr>` passes Chromium-only PR CI and fails the weekly sweep, because Chromium breaks at `<wbr>` inside nowrap. Run layout gates with `--browsers webkit` too.
- `/gmt/api/brains` stays `private, no-store`.
- `DoxChat.ssr.test.tsx` catches `window` use during SSR.
- Dates in chat render after mount only (#418).
- Tailwind `dark:` must follow `data-theme`.
- `wrangler dev` overwrites `cf-connecting-ip`, so every local request is one visitor. Use the dev bypass.
- A `503 Your worker restarted mid-request` looks like a dead model. Cause: two `wrangler dev` instances, or a build without `@northguild/gmt`. `pgrep -cf "wrangler dev"` should print 1. If port 8787 is taken, pass `--port`.
- Static assets bypass the Worker, so `?key=` works only on `/gmt/api/*`.
- AI bindings always run remotely: local chat spends the real Workers AI allocation.
