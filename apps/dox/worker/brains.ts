/**
 * Choosing which brain answers.
 *
 * The free tier's allowance is per model, so Dox keeps several and moves
 * between them. This module owns that choice; `usage.ts` owns the bookkeeping
 * it reads from.
 *
 * ## Failover happens inside a single request
 *
 * `openFirstWorkingBrain` walks the candidates and returns the first that
 * actually starts producing output. The trick is `await result.warnings`: it
 * forces the upstream call and rejects on a 429 or 404 *before* any UI message
 * stream has been opened, so the next brain can be tried with the reader none
 * the wiser.
 *
 * An earlier design skipped this, on the reasoning that a pre-flight ledger
 * check made an in-request failure "a rare race". That was wrong twice over:
 * every brain reaches its limit on some unlucky request, so it is the normal
 * path, not a race — and when the ledger is unavailable there is no memory
 * between requests at all, so *every* request picks the same exhausted brain.
 * The ledger is an optimisation here, never the mechanism.
 *
 * ## Two kinds of allowance (DOX-C4)
 *
 * Gemini's allowance is per model, so one brain running out says nothing about
 * the next. Workers AI's is one pool of Neurons per account, so one `workers-ai`
 * brain reporting an exhausted allocation means every one of them is out — and
 * `openFirstWorkingBrain` retires them together instead of spending a doomed
 * request on each.
 */
import {
  APICallError,
  NoOutputGeneratedError,
  RetryError,
  streamText,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";
import {
  BRAINS,
  DEFAULT_BRAIN_ID,
  type Brain,
  type BrainProvider,
} from "../src/lib/chat-constants";
import type { BrainState, UsageSnapshot } from "./usage";

export interface BrainChoice {
  /** The brain to use, or `undefined` when every one is out. */
  brain?: Brain;
  /** True when nothing is left today — the caller renders the "come back after
   * midnight Pacific" state rather than an error. */
  exhausted: boolean;
}

/**
 * Pick a brain, honouring the reader's preference when it is still usable.
 *
 * A requested-but-spent brain silently falls through to the next healthy one
 * rather than refusing. The reader asked for a *better answer*, not for a
 * specific HTTP outcome; failing their request to honour a preference they
 * cannot see the cost of would be pedantic.
 *
 * `pool` is the brains this deployment can reach (see worker/index.ts's
 * `configuredBrains`); a requested brain outside it is treated as no request.
 */
export function chooseBrain(
  snapshot: UsageSnapshot,
  requestedId?: string,
  pool: readonly Brain[] = BRAINS,
): BrainChoice {
  const isUsable = (brain: Brain): boolean =>
    (snapshot.states[brain.id] ?? "ok") === "ok";

  const requested = requestedId
    ? pool.find((brain) => brain.id === requestedId)
    : undefined;
  if (requested && isUsable(requested))
    return { brain: requested, exhausted: false };

  const preferred = pool.find((brain) => brain.id === DEFAULT_BRAIN_ID);
  if (preferred && isUsable(preferred) && !requestedId) {
    return { brain: preferred, exhausted: false };
  }

  const next = pool.find(isUsable);
  return next ? { brain: next, exhausted: false } : { exhausted: true };
}

/**
 * What a failed model call says about that brain's availability.
 *
 * Returns `undefined` when the failure says nothing about the brain — a
 * malformed prompt or a transient 500 should not retire a model for the day.
 *
 * Unwrapping matters, and there are two layers of it. `streamText` retries
 * internally, so a failure that survives every attempt is wrapped in a
 * `RetryError`; and awaiting `result.warnings` on a call that produced nothing
 * rejects with a `NoOutputGeneratedError` wrapping *that*. Neither satisfies
 * `APICallError.isInstance`, so testing the raw error classifies a real quota
 * failure as "nothing to do with the brain" and breaks failover completely —
 * observed 2026-09-10, and the same trap that had already made
 * `mapUpstreamError` misreport this exact error.
 */
export function brainStateFromError(
  rawError: unknown,
): Exclude<BrainState, "ok"> | undefined {
  const error = unwrapModelError(rawError);

  if (!APICallError.isInstance(error)) return undefined;

  if (error.statusCode === 429) return "spent";

  // 404 is "no such model"; Google also answers 400 for a model this key may
  // not use. Either way the brain is not coming back today, so stop trying it.
  if (error.statusCode === 404 || error.statusCode === 400)
    return "unavailable";

  if (isWorkersAIError(error)) {
    // An exhausted allocation reported as `4006` arrives with NO status:
    // `workers-ai-provider` 4.0.0 maps the documented 3036 to 429 (caught
    // above) but has no entry for 4006. Left unclassified it would rethrow and
    // end the request instead of failing over.
    if (isWorkersAIAllocationExhausted(error)) return "spent";

    // A Workers AI 403 is about the model, not a credential — 5018/3041 "not
    // allowed to access this model", 5035 "requires a Workers Paid plan". A
    // Gemini 403 stays unclassified, because there it means a bad key.
    if (error.statusCode === 403) return "unavailable";
  }

  return undefined;
}

/**
 * Workers AI's daily-allocation failure, in both shapes it arrives in: code
 * 3036 (documented; the provider maps it to 429) and code 4006 (undocumented,
 * unmapped, and widely reported on Cloudflare's community forum as "you have
 * used up your daily free allocation of 10,000 neurons").
 */
const ALLOCATION_EXHAUSTED = /\b(3036|4006)\b|daily free allocation/i;

/**
 * True when a failure means the account's whole Neuron pool is gone for the
 * day, rather than one model being briefly unable to answer.
 *
 * The distinction is why this is separate from `brainStateFromError`: a 3040
 * "no more data centers" is also a 429, and retiring every Workers AI brain
 * for a capacity blip on one would throw away the rest of the day's pool.
 */
export function isWorkersAIAllocationExhausted(rawError: unknown): boolean {
  const error = unwrapModelError(rawError);
  if (!APICallError.isInstance(error) || !isWorkersAIError(error)) return false;

  const data = error.data as { workersAIErrorCode?: number } | undefined;
  return (
    data?.workersAIErrorCode === 3036 ||
    ALLOCATION_EXHAUSTED.test(error.message)
  );
}

/** `workers-ai-provider` stamps binding errors with a `workers-ai:` pseudo-URL
 * (`normalizeBindingError`), which is the only provider-neutral way to tell
 * them apart from Google's. */
function isWorkersAIError(error: APICallError): boolean {
  return error.url.startsWith("workers-ai:");
}

/** Remaining requests for the badge. Advisory — see usage.ts. */
export function remainingFor(brain: Brain, snapshot: UsageSnapshot): number {
  if ((snapshot.states[brain.id] ?? "ok") !== "ok") return 0;
  const used = snapshot.perBrain[brain.id] ?? 0;
  return Math.max(0, brain.dailyLimit - used);
}

/** Peel the SDK's wrappers off until the provider error underneath is visible.
 * Both layers are real, and both hide `APICallError` from `isInstance`. */
function unwrapModelError(error: unknown): unknown {
  let current = error;
  for (let depth = 0; depth < 4; depth++) {
    if (NoOutputGeneratedError.isInstance(current) && current.cause) {
      current = current.cause;
      continue;
    }
    if (RetryError.isInstance(current)) {
      current = current.lastError ?? current.errors.at(-1) ?? current;
      continue;
    }
    return current;
  }
  return current;
}

export interface BrainAttempt {
  brain: Brain;
  result: ReturnType<typeof streamText>;
}

/**
 * The brains to try, in order: the reader's pick first (if they made one), then
 * the registry order, with anything the ledger already knows is out pushed to
 * the back rather than dropped.
 *
 * Known-bad brains are kept as a last resort on purpose. The ledger can be
 * stale, absent, or simply wrong about a model Google has restored — and
 * refusing to answer because of a cached opinion would be worse than spending
 * one request to find out.
 */
export function orderCandidates(
  snapshot: UsageSnapshot,
  requestedId?: string,
  pool: readonly Brain[] = BRAINS,
): Brain[] {
  const healthy: Brain[] = [];
  const known0ut: Brain[] = [];

  const requested = requestedId
    ? pool.find((brain) => brain.id === requestedId)
    : undefined;

  const isHealthy = (brain: Brain) =>
    (snapshot.states[brain.id] ?? "ok") === "ok";

  for (const brain of pool) {
    if (brain.id === requested?.id) continue;
    (isHealthy(brain) ? healthy : known0ut).push(brain);
  }

  // A requested brain leads only if the ledger has nothing against it. If it is
  // already known to be out, it drops to the back with the rest: honouring the
  // preference is not worth making the reader wait for a call we are fairly
  // sure will fail. It stays in the list because the ledger can be stale.
  if (requested && isHealthy(requested)) {
    return [requested, ...healthy, ...known0ut];
  }
  return requested
    ? [...healthy, ...known0ut, requested]
    : [...healthy, ...known0ut];
}

/**
 * Start the first brain that answers.
 *
 * Returns `undefined` only when every candidate refused for a reason that says
 * the brain is out — an unrelated failure is rethrown rather than silently
 * costing the reader their whole candidate list.
 */
export async function openFirstWorkingBrain({
  candidates,
  resolveModel,
  instructions,
  messages,
  tools,
  onBrainOut,
}: {
  candidates: readonly Brain[];
  resolveModel: (brainId: string) => LanguageModel;
  instructions: string;
  messages: ModelMessage[];
  /** DOX-C3b's widget tools. Passed to every attempt, so a brain that rejects
   *  the tool schema fails at exactly the same seam as one that 429s — before
   *  anything has been written to the reader. */
  tools?: ToolSet;
  onBrainOut: (brainId: string, state: Exclude<BrainState, "ok">) => void;
}): Promise<BrainAttempt | undefined> {
  const exhaustedProviders = new Set<BrainProvider>();

  for (const brain of candidates) {
    // One Workers AI brain reporting an exhausted allocation means all of them
    // are out: the 10,000 Neurons are per account, not per model. Mark the
    // rest without spending a doomed request on each.
    if (exhaustedProviders.has(brain.provider)) {
      onBrainOut(brain.id, "spent");
      continue;
    }

    // `await result.warnings` rejects with a bare `NoOutputGeneratedError` that
    // carries NO cause — verified 2026-09-10 — so the provider's actual error
    // is unrecoverable from the rejection alone. `onError` is where the real
    // one surfaces, so it is captured here and classified after the await.
    let providerError: unknown;

    const result = streamText({
      model: resolveModel(brain.id),
      instructions,
      messages,
      tools,
      // Workers AI defaults `max_tokens` to 256, which cuts a Dox answer off
      // mid-sentence; its brains carry an explicit cap. Unset for Gemini.
      maxOutputTokens: brain.maxOutputTokens,
      // One structured line per answered request, so real token counts — and
      // from them, real Neuron cost — can be read from `wrangler dev` or
      // Workers Logs instead of estimated. `scripts/probe-brains.ts` parses it.
      onFinish: ({ usage }) => {
        console.log(
          "dox-usage",
          JSON.stringify({
            brain: brain.id,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          }),
        );
      },
      /* No `stopWhen`. The default is `isStepCount(1)`, which is exactly what
         is wanted: the tool's `execute` runs inside step 1 and the stream ends.
         Raising it would add a second upstream call *after* headers are already
         sent, where failover is no longer available and a failure reaches the
         reader mid-answer — against a five-questions-per-visitor budget. */
      onError: ({ error }) => {
        providerError = error;
      },
      // The SDK retries a 429 three times with exponential backoff by default.
      // That made sense with a single model, where waiting was the only option.
      // With failover it is harmful: a *daily* quota will not refill for hours,
      // so the backoff only delays moving to a brain that would have answered
      // immediately. One retry is kept for a genuinely transient blip.
      maxRetries: 1,
    });

    try {
      // Resolves once the model call has returned its opening metadata, and
      // rejects if that call failed — the seam that lets a 429 be caught before
      // anything has been written to the reader.
      await result.warnings;
      return { brain, result };
    } catch (error) {
      // Prefer the provider's error over the SDK's contentless wrapper.
      const underlying = providerError ?? error;
      const state = brainStateFromError(underlying);
      if (!state) throw underlying;

      console.error(
        `brain ${brain.id} is ${state}; trying the next`,
        underlying,
      );
      onBrainOut(brain.id, state);
      if (isWorkersAIAllocationExhausted(underlying)) {
        exhaustedProviders.add(brain.provider);
      }
    }
  }

  return undefined;
}
