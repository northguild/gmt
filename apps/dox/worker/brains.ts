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
 * actually starts producing output. It waits for the model's first piece of
 * content (`onChunk`), racing `result.warnings`: a 429 or 404 rejects that
 * promise *before* any UI message stream has been opened, so the next brain
 * can be tried with the reader none the wiser. The walk returns as soon as
 * content arrives, so the answer streams to the reader as it is written.
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
  isStepCount,
  streamText,
  wrapLanguageModel,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";
import {
  BRAIN_START_TIMEOUT_MS,
  BRAINS,
  DEFAULT_BRAIN_ID,
  type Brain,
  type BrainProvider,
} from "../src/lib/chat-constants";
import type { BrainAttemptTrace } from "../src/lib/chat-types";
import { toolCallMarkupMiddleware } from "./tool-call-markup";
import type { BrainState, UsageSnapshot } from "./usage";

/** A model object, never a gateway id string: the walk wraps it in middleware. */
export type BrainModel = Exclude<LanguageModel, string>;

/**
 * One more step, with no tools, for a model that answered with a widget alone.
 *
 * The system prompt asks for prose first and the tool call after, and a
 * model that thinks before answering does that. Gemma 4 and GLM 4.7 with
 * thinking off — 2–5 s instead of 6–21 s — mostly reply with the tool call
 * and nothing else (in a probe, 4 widget answers of 8 had no text).
 * A widget beside silence is a worse answer than the paragraph it replaces,
 * so such a step is followed by one with every tool switched off, where the
 * only thing the model can do is write. The widget reaches the reader first
 * and the text follows it.
 *
 * Only that case gets a second step: one whose step 1 wrote text, or called
 * no tool, ends after step 1 as before. Step 2 runs after the stream has
 * opened, so it cannot fail over to another brain; if it fails, the reader
 * keeps the widget and sees the mapped error after it. It costs a second
 * read of the prompt, which is why it is limited to answers that need it.
 */
const WIDGET_THEN_PROSE = {
  stopWhen: [
    isStepCount(2),
    ({ steps }: { steps: ReadonlyArray<{ text: string }> }) =>
      (steps.at(-1)?.text.trim() ?? "") !== "",
  ],
  prepareStep: ({ stepNumber }: { stepNumber: number }) =>
    stepNumber === 0 ? undefined : { activeTools: [] as never[] },
};

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

  // A Workers AI 429 is only "spent" when it says the Neuron pool is gone.
  // Code 3040 ("no more data centers to forward the request to") is also a
  // 429, and it is a capacity blip on one model: `isTransientOverload` moves
  // the request on without retiring the brain for the day.
  if (
    error.statusCode === 429 &&
    !(isWorkersAIError(error) && !isWorkersAIAllocationExhausted(error))
  )
    return "spent";

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
 * The model is overloaded for this request, not out for the day: HTTP 503
 * ("This model is currently experiencing high demand", observed from Gemini on
 * 2026-09-24), 529 ("overloaded"), or a Workers AI 429 that is not the daily
 * allocation (3040, out of capacity).
 *
 * Separate from `brainStateFromError` because the answer is different on both
 * sides. It is worth the next brain *now* — the overload belongs to one model,
 * and with `maxRetries: 0` nothing else would move the request on — but it says
 * nothing about tomorrow, so it never reaches the ledger. A 500 is not in this
 * set: an error in the request itself would fail on every brain, and walking
 * them all would spend the day's budget on one broken question.
 */
export function isTransientOverload(rawError: unknown): boolean {
  const error = unwrapModelError(rawError);
  if (!APICallError.isInstance(error)) return false;
  if (error.statusCode === 503 || error.statusCode === 529) return true;
  return (
    error.statusCode === 429 &&
    isWorkersAIError(error) &&
    !isWorkersAIAllocationExhausted(error)
  );
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
  /** Every brain tried, in order, the answering one last. Feeds the
   * retrieval trace and the `dox-timing` log line, so a slow answer can be
   * told apart from a slow walk past spent brains. */
  attempts: BrainAttemptTrace[];
}

/**
 * The brains to try, in order: the reader's pick first (if they made one), then
 * the registry order, with anything the ledger already knows is out pushed to
 * the back rather than dropped.
 *
 * The reader's pick always leads, even when the ledger has it as out. The
 * progress line names each brain as it is asked, so a pick that was quietly
 * moved to the back read as Dox ignoring the selector ("Asking 3.6 Flash…"
 * under a badge that says GLM). A spent brain refuses in well under a second,
 * so honouring the pick costs one fast refusal, and the walk carries on.
 *
 * Known-bad brains are kept as a last resort on purpose. The ledger can be
 * stale, absent, or simply wrong about a model a provider has restored — and
 * refusing to answer because of a cached opinion would be worse than spending
 * one request to find out.
 */
export function orderCandidates(
  snapshot: UsageSnapshot,
  requestedId?: string,
  pool: readonly Brain[] = BRAINS,
): Brain[] {
  const healthy: Brain[] = [];
  const knownOut: Brain[] = [];

  const requested = requestedId
    ? pool.find((brain) => brain.id === requestedId)
    : undefined;

  const isHealthy = (brain: Brain) =>
    (snapshot.states[brain.id] ?? "ok") === "ok";

  for (const brain of pool) {
    if (brain.id === requested?.id) continue;
    (isHealthy(brain) ? healthy : knownOut).push(brain);
  }

  return requested
    ? [requested, ...healthy, ...knownOut]
    : [...healthy, ...knownOut];
}

/**
 * Thrown when no candidate started answering in time and none was busy.
 * Nothing was spent, so the reader is asked to try again rather than told the
 * day's allowance is gone.
 */
export class BrainsTimedOutError extends Error {
  override readonly name = "BrainsTimedOutError";
  constructor() {
    super("No brain started answering in time.");
  }
}

/** Stream parts that mean the model has begun its answer. An `error` part is
 *  not one: the SDK passes those to `onChunk` too. */
const ANSWER_STARTED_PARTS: ReadonlySet<string> = new Set([
  "text-delta",
  "reasoning-delta",
  "tool-input-start",
  "tool-call",
]);

/**
 * Start the first brain that answers.
 *
 * Returns `undefined` only when every candidate refused for a reason that says
 * the brain is out. When every remaining one was busy, the last overload is
 * thrown; when one was slow, `BrainsTimedOutError` is. An unrelated failure is
 * rethrown rather than silently costing the reader their whole candidate list.
 */
export async function openFirstWorkingBrain({
  candidates,
  resolveModel,
  instructions,
  messages,
  tools,
  onBrainOut,
  onAttempt,
  onMovedOn,
  startTimeoutMs = (brain) => BRAIN_START_TIMEOUT_MS[brain.provider],
}: {
  candidates: readonly Brain[];
  resolveModel: (brainId: string) => BrainModel;
  instructions: string;
  messages: ModelMessage[];
  /** DOX-C3b's widget tools. Passed to every attempt, so a brain that rejects
   *  the tool schema fails at exactly the same seam as one that 429s — before
   *  anything has been written to the reader. */
  tools?: ToolSet;
  onBrainOut: (brainId: string, state: Exclude<BrainState, "ok">) => void;
  /** Before each brain is asked. For the reader's progress line only. */
  onAttempt?: (brain: Brain) => void;
  /** After a brain refused and the walk moves on. For progress only; the
   *  ledger hears about `spent`/`unavailable` through `onBrainOut`. */
  onMovedOn?: (
    brain: Brain,
    outcome: "busy" | "slow" | "spent" | "unavailable",
  ) => void;
  /** How long a brain may take to start answering before the walk gives up
   *  on it. Per provider by default; tests shorten it. */
  startTimeoutMs?: (brain: Brain) => number;
}): Promise<BrainAttempt | undefined> {
  const exhaustedProviders = new Set<BrainProvider>();
  const attempts: BrainAttemptTrace[] = [];
  /* The last overload seen. If every brain was either out or busy, this is
     thrown rather than returning "spent": a reader who hit a busy minute has
     not used up anyone's allowance, and should be told to try again. */
  let lastOverload: unknown;
  /* Whether any brain was given up on for being slow. A slow brain has not
     spent anything either, so the walk must not end in "spent". */
  let sawSlow = false;

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
    const started = performance.now();
    onAttempt?.(brain);

    // A brain that never answers would otherwise hold the whole request:
    // `gemini-3.8-flash` was measured on 2026-10-27 sending nothing at all
    // for 60 s, twice, and the reader saw "Asking 3.8 Flash…" until the
    // chat's own stall timer gave up. The abort cancels the upstream call;
    // the race below is what actually moves the walk on, whatever the SDK
    // does with the abort.
    //
    // The deadline covers only the start of the answer. Once the first piece
    // of content arrives, the brain keeps going for as long as it needs: a
    // widget and then its prose can run well past the deadline.
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<"slow">((resolve) => {
      timer = setTimeout(() => {
        abort.abort();
        resolve("slow");
      }, startTimeoutMs(brain));
    });
    let markStarted: (() => void) | undefined;
    const answerStarted = new Promise<"started">((resolve) => {
      markStarted = () => resolve("started");
    });

    const result = streamText({
      // A tool call the model wrote as text becomes a real one, or is dropped.
      model: wrapLanguageModel({
        model: resolveModel(brain.id),
        middleware: toolCallMarkupMiddleware,
      }),
      abortSignal: abort.signal,
      instructions,
      messages,
      tools,
      // Workers AI defaults `max_tokens` to 256, which cuts a Dox answer off
      // mid-sentence; its brains carry an explicit cap. Unset for Gemini.
      maxOutputTokens: brain.maxOutputTokens,
      // Gemini 3 thinks before it answers; `thinkingLevel` bounds how long.
      // Set per brain in `chat-constants.ts`, so a brain that needs more
      // depth to keep calling its widget can have it on its own.
      providerOptions:
        brain.provider === "google" && brain.thinkingLevel
          ? {
              google: {
                thinkingConfig: { thinkingLevel: brain.thinkingLevel },
              },
            }
          : undefined,
      // One structured line per answered request, so real token counts — and
      // from them, real Neuron cost — can be read from `wrangler dev` or
      // Workers Logs instead of estimated. `scripts/probe-brains.ts` parses it.
      // Both steps' tokens, when the answer took two — see `stopWhen`.
      onFinish: ({ totalUsage }) => {
        console.log(
          "dox-usage",
          JSON.stringify({
            brain: brain.id,
            inputTokens: totalUsage.inputTokens,
            outputTokens: totalUsage.outputTokens,
          }),
        );
      },
      ...WIDGET_THEN_PROSE,
      onChunk: ({ chunk }) => {
        if (ANSWER_STARTED_PARTS.has(chunk.type)) markStarted?.();
      },
      onError: ({ error }) => {
        providerError = error;
      },
      // The SDK retries a 429 three times with exponential backoff by default,
      // starting at 2 s. That made sense with a single model, where waiting
      // was the only option. With failover it is harmful: a *daily* quota will
      // not refill for hours, so every retry only delays moving to a brain
      // that would have answered at once — and even one retry put a 2 s pause
      // in front of every failover. The next brain *is* the retry for a
      // transient blip, so none are kept here.
      maxRetries: 0,
    });

    try {
      // `answerStarted` resolves on the model's first piece of content.
      // `result.warnings` settles only when the whole answer is done, but it
      // rejects at once if the call failed — the seam that lets a 429 be
      // caught before anything has been written to the reader.
      const outcome = await Promise.race([
        result.warnings,
        answerStarted,
        timedOut,
      ]);
      clearTimeout(timer);
      if (outcome === "slow") {
        sawSlow = true;
        // The aborted call rejects later; nothing reads it again.
        result.warnings.then(undefined, () => undefined);
        attempts.push({
          brainId: brain.id,
          ms: Math.round(performance.now() - started),
          outcome: "slow",
        });
        console.error(`brain ${brain.id} did not start in time; trying the next`);
        onMovedOn?.(brain, "slow");
        continue;
      }
      attempts.push({
        brainId: brain.id,
        ms: Math.round(performance.now() - started),
        outcome: "answered",
      });
      return { brain, result, attempts };
    } catch (error) {
      clearTimeout(timer);
      // Prefer the provider's error over the SDK's contentless wrapper.
      const underlying = providerError ?? error;
      const state = brainStateFromError(underlying);
      if (!state && isTransientOverload(underlying)) {
        attempts.push({
          brainId: brain.id,
          ms: Math.round(performance.now() - started),
          outcome: "busy",
        });
        console.error(`brain ${brain.id} is busy; trying the next`, underlying);
        lastOverload = underlying;
        onMovedOn?.(brain, "busy");
        continue;
      }
      if (!state) throw underlying;

      attempts.push({
        brainId: brain.id,
        ms: Math.round(performance.now() - started),
        outcome: state,
      });
      console.error(
        `brain ${brain.id} is ${state}; trying the next`,
        underlying,
      );
      onBrainOut(brain.id, state);
      onMovedOn?.(brain, state);
      if (isWorkersAIAllocationExhausted(underlying)) {
        exhaustedProviders.add(brain.provider);
      }
    }
  }

  if (lastOverload !== undefined) throw lastOverload;
  if (sawSlow) throw new BrainsTimedOutError();
  return undefined;
}
