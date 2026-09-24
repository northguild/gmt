import type { DoxToolName } from "./dox-tools";

/**
 * DOX-C2 (#138) — shared between the Worker (`worker/*`) and, from `DOX-C3a`
 * onward, the client. There is no model-selector UI yet, so "shared" only
 * has one consumer today; this is where that seam lives so UI and Worker
 * never drift once a second one exists.
 *
 * Values are starting points, not measured optima — same epistemic honesty
 * as DOX-C1's cache TTL. Retune with production traffic, not in advance.
 */

/**
 * Dox's brains, in preference order.
 *
 * This list is the free tier's escape hatch. Gemini's quota id is
 * `GenerateRequestsPerDayPerProjectPerModel-FreeTier` — the allowance is per
 * **model**, so every additional brain adds its own daily budget. One model
 * gives ~20 requests/day across all visitors, which is not a product; the nine
 * below give roughly ~165/day between them (eight at 20, one Pro at 5).
 *
 * **Every id here was probed with a real request on 2026-09-10**, not merely
 * read off the model list. That distinction mattered: the list returns models
 * this key cannot actually call. Each entry either answered, or answered 429
 * (`spent`) — which still proves the model exists and carries a free quota.
 *
 * What is still unverified is each model's *actual* daily allowance;
 * `dailyLimit` is a uniform 20 for Flash because that is what the free tier
 * granted the ones we measured. That remains safe, because:
 *
 *   - `dailyLimit` feeds the UI badge ONLY. It never gates a request — Google's
 *     429 is the only real gate, so a wrong number here misprints a digit and
 *     nothing more.
 *   - The chain self-prunes: a brain that answers 404/400 is marked unavailable
 *     for the rest of the day and skipped (see worker/brains.ts).
 *
 * That last point is not theoretical. DOX-C1 picked "gemini-2.5-flash" and a
 * live call during DOX-C2 (2026-09-09) found Google had withdrawn it for new
 * keys mid-story: "no longer available to new users. Please update your code to
 * use models/gemini-3.6-flash." A hardcoded list that assumes availability is
 * the bug; a chain that discovers it is the fix.
 *
 * ## What is deliberately NOT in this list
 *
 * Three candidates were dropped because a real probe on 2026-09-10 got 404/400
 * (`unavailable`) rather than an answer or a 429: `gemini-2.5-flash-lite`,
 * `gemini-2.5-pro`, and `gemini-2.5-flash` — the last confirming DOX-C2's
 * earlier finding that it is closed to new keys. Keeping any of them would
 * spend a doomed request a day to re-learn what we already know.
 *
 * Also excluded:
 *
 * - **The `-latest` aliases** (`gemini-flash-latest`, `gemini-flash-lite-latest`).
 *   They resolve to a model already in this list, and it is unknown whether the
 *   quota bucket follows the alias or the target. If it follows the target they
 *   add nothing while looking like they add 20/day — a badge that lies is worse
 *   than a shorter list. Worth testing one day; not worth guessing.
 * - **Image, TTS, native-audio, embedding, transcription, computer-use and
 *   robotics models.** Wrong shape for the job.
 *
 * One Pro model *is* included, unlike an earlier draft of this comment that
 * dismissed the whole tier: `gemini-3.1-pro-preview` answered 429 when probed,
 * which proves it exists and carries a free allowance. It sits last because
 * that allowance is much smaller than Flash's.
 *
 * Ordering is preference order: full Flash before Flash-Lite (better answers),
 * newest first within each tier, Pro last. `BRAINS[0]` is the default brain.
 *
 * **Re-probe when Google ships models.** This is a snapshot of one key's access
 * on one day, and this epic has already been bitten once by a model being
 * withdrawn mid-story. The chain self-prunes, so a stale entry degrades rather
 * than breaks — but a missing entry is 20 free requests a day left on the table.
 */
export const BRAINS = [
  // Full Flash — best answers. Newest first.
  {
    id: "gemini-3.8-flash",
    label: "3.8 Flash",
    provider: "google",
    thinkingLevel: "low",
    dailyLimit: 20,
  },
  {
    id: "gemini-3.7-flash",
    label: "3.7 Flash",
    provider: "google",
    thinkingLevel: "low",
    dailyLimit: 20,
  },
  {
    id: "gemini-3.6-flash",
    label: "3.6 Flash",
    provider: "google",
    thinkingLevel: "low",
    dailyLimit: 20,
  },
  {
    id: "gemini-3.5-flash",
    label: "3.5 Flash",
    provider: "google",
    thinkingLevel: "low",
    dailyLimit: 20,
  },
  // Flash-Lite — faster and cheaper, still comfortably good enough for
  // documentation Q&A over retrieved chunks.
  {
    id: "gemini-3.5-flash-lite",
    label: "3.5 Flash-Lite",
    provider: "google",
    thinkingLevel: "low",
    dailyLimit: 20,
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "3.1 Flash-Lite",
    provider: "google",
    thinkingLevel: "low",
    dailyLimit: 20,
  },
  {
    id: "gemini-3.1-flash-lite-preview",
    label: "3.1 Lite Preview",
    provider: "google",
    thinkingLevel: "low",
    dailyLimit: 20,
  },
  {
    id: "gemini-3-flash-preview",
    label: "3 Flash Preview",
    provider: "google",
    thinkingLevel: "low",
    dailyLimit: 20,
  },
  // Pro, last resort. Confirmed real (it answered 429, not 404) but its free
  // allowance is far smaller than Flash's, so this limit is a conservative
  // guess. Reaching it means every Flash brain is spent, which is a good day.
  {
    id: "gemini-3.1-pro-preview",
    label: "3.1 Pro Preview",
    provider: "google",
    thinkingLevel: "low",
    dailyLimit: 5,
  },
  // Workers AI (DOX-C4, #240) — a second, independent free pool, tried only
  // once every Gemini brain is out or when a reader picks it explicitly. See
  // WORKERS_AI_DAILY_NEURONS for how its budget differs from Gemini's.
  //
  // One brain, chosen by live probe on 2026-09-11 (`scripts/probe-brains.ts`;
  // results in context/dox/built.md, "Brains and budget") from four
  // tool-capable candidates that run on the Workers Free plan:
  //
  //   - glm-4.7-flash — kept: 4/4 widget calls, refused the absent question,
  //     ~88 Neurons a question. Slow (6-24 s) and imperfect; a fallback, not
  //     a Gemini replacement.
  //   - qwen3-30b-a3b-fp8, llama-4-scout — dropped, and not for the model's
  //     sake: `workers-ai-provider` 4.0.0 reads text and tool calls from both
  //     `response` and `choices[0].delta` of the same chunk, so for these two
  //     every token arrives twice ("ToTo convert convert") and every tool
  //     call's arguments fail to parse. Where visible, both chose the right
  //     tool. Re-probe when the provider stops double-emitting.
  //   - gpt-oss-20b — dropped: 0/4 widget calls; it writes the call's JSON
  //     arguments as reply text instead, at ~224 Neurons a question.
  //
  // `reasoningEffort: null` asks for thinking off. With `low`, glm spent its
  // whole 2,048-token cap reasoning on one question and answered nothing; with
  // `null` it did not — though latency did not improve, so whether the model
  // fully honours it is unverified.
  //
  // `maxOutputTokens` is not optional here: Workers AI defaults `max_tokens` to
  // 256, which truncates a normal Dox answer mid-sentence. Gemini's default is
  // large enough that its entries leave it unset.
  {
    id: "cf-glm-4.7-flash",
    label: "GLM 4.7 Flash",
    provider: "workers-ai",
    model: "@cf/zai-org/glm-4.7-flash",
    reasoningEffort: null,
    maxOutputTokens: 2048,
    // 10,000 Neurons / ~88 measured per question ≈ 113, rounded down.
    dailyLimit: 100,
  },
] as const satisfies readonly Brain[];

/**
 * Where a brain runs.
 *
 * `google` needs `NORTHGUILD_GMT_GEMINI_API_KEY`; `workers-ai` needs the `AI`
 * binding in `wrangler.jsonc`. The Worker only offers brains whose provider is
 * configured, so a missing key or binding shrinks the list rather than failing
 * a request (see worker/index.ts).
 */
export type BrainProvider = "google" | "workers-ai";

/**
 * What the ledger and the UI need to know about each provider: what to call it,
 * and whose midnight its daily allowance refills at.
 *
 * - **Gemini** resets requests-per-day at midnight Pacific (Google's rate limit
 *   docs).
 * - **Workers AI** resets its 10,000-Neuron allocation at 00:00 UTC — see
 *   `WORKERS_AI_DAILY_NEURONS`.
 *
 * The single source for both clocks: `worker/usage.ts` buckets a brain's ledger
 * keys by this zone's day, `/api/brains` sends each provider's next midnight,
 * and the chat renders those instants in the reader's own zone.
 */
export const BRAIN_PROVIDERS: Readonly<
  Record<BrainProvider, { label: string; resetTimeZone: string }>
> = {
  google: { label: "Gemini", resetTimeZone: "America/Los_Angeles" },
  "workers-ai": { label: "Workers AI", resetTimeZone: "UTC" },
};

export interface Brain {
  id: string;
  label: string;
  provider: BrainProvider;
  /** The provider's own model id, when it differs from `id`. Workers AI ids
   * (`@cf/zai-org/glm-4.7-flash`) carry `@` and `/`, which make poor ledger
   * keys and menu values, so those brains get a short `id` and put the real
   * name here. Gemini ids are already usable as-is and leave this unset. */
  model?: string;
  /** Output cap passed to `streamText`. Unset means the provider's default. */
  maxOutputTokens?: number;
  /** Workers AI reasoning budget for models that think before answering.
   * Thinking tokens are billed as output Neurons and add latency to a reply
   * the reader never sees. `null` turns thinking off where the model allows
   * it; unset leaves the model's default. */
  reasoningEffort?: "low" | "medium" | "high" | null;
  /** Gemini 3 thinking depth (`thinkingConfig.thinkingLevel`). Left unset,
   * Gemini 3 thinks dynamically over the whole 10–16k-token prompt before its
   * first token. `"low"` is meant to cut that pause while keeping the tool call
   * and the grounded answer — the timing trace (`dox-timing`) shows whether it
   * does. A brain that stops calling its widget under `"low"` moves to
   * `"medium"`.
   * Ignored for Workers AI brains, which use `reasoningEffort`. */
  thinkingLevel?: "minimal" | "low" | "medium" | "high";
  /** Advisory only — used to render "N left", never to refuse a request. */
  dailyLimit: number;
}

/**
 * Workers AI's free allocation: **10,000 Neurons per day, per account**, reset
 * at 00:00 UTC. Verified against Cloudflare's pricing page on 2026-09-11.
 *
 * Two properties make this unlike Gemini's allowance, and both shape the code:
 *
 * - **It is one pool, not one per model.** Every `workers-ai` brain draws from
 *   the same 10,000, so an allocation-exhausted error on one means all of them
 *   are out — `worker/brains.ts` retires the whole provider at once rather than
 *   spending a doomed request per model to rediscover it.
 * - **It is metered in Neurons, which scale with tokens, not requests.** Dox's
 *   system prompt measured 10-16k input tokens a question in the live probe
 *   (19 KB of SKILL.md vocabulary is the bulk of it), so glm-4.7-flash costs
 *   ~88 Neurons a question and the larger candidates 220-320. If more than one
 *   `workers-ai` brain is ever enabled, split `dailyLimit` across them so the
 *   badge's sum stays near what the pool actually buys, rather than each
 *   claiming the whole of it.
 *
 * On the Workers **Free** plan, exceeding this fails with an error — it cannot
 * bill. That is the property that keeps Dox 100% free, and it would stop being
 * true on the Workers Paid plan, where overage is charged per 1,000 Neurons.
 */
export const WORKERS_AI_DAILY_NEURONS = 10_000;

export type BrainId = (typeof BRAINS)[number]["id"];

/** The brain used when the reader has not picked one. */
export const DEFAULT_BRAIN_ID: BrainId = BRAINS[0].id;

export const BRAIN_IDS = BRAINS.map((brain) => brain.id) as [
  BrainId,
  ...BrainId[],
];

export function findBrain(id: string): Brain | undefined {
  return BRAINS.find((brain) => brain.id === id);
}

/**
 * What a single visitor may spend per Pacific day.
 *
 * Not a security boundary — it is keyed on a hashed IP, which a determined
 * person can change. It exists so one enthusiastic reader cannot drain a pool
 * that is shared by everybody, which on the free tier is a real and easy
 * accident rather than an attack.
 *
 * Sized against the shared pool rather than picked for feel. Eight Flash brains
 * at 20 requests each, plus one smaller Pro one, is ~165 per day for
 * *everyone*; the Workers AI pool (DOX-C4) adds ~110 more, from a live probe of
 * glm-4.7-flash at ~88 Neurons a question. Against ~275 a cap of 5 lets roughly
 * 55 readers get a full turn before the day is spent. Left at 5 until real
 * traffic confirms that figure — a cap raised on a twenty-question probe is the
 * drift this comment warns about. Five questions is already more than a typical
 * reader asks of a documentation bot in one sitting.
 *
 * Recompute this whenever BRAINS changes — the two numbers drift apart silently
 * otherwise, and the cap is the only thing standing between one reader and
 * everybody else's day.
 *
 * Retune with real traffic — this is arithmetic against an unknown audience,
 * not a measured optimum.
 */
export const VISITOR_DAILY_MAX = 5;

export const MAX_MESSAGES = 40;
export const MAX_MESSAGE_LENGTH = 4000;

export const RATE_LIMIT_MAX = 20;
export const RATE_LIMIT_WINDOW_SECONDS = 60;

/** Silence allowed between chunks once an answer is streaming. */
export const IDLE_TIMEOUT_MS = 30_000;

/**
 * How long the chat waits for the *first* output before calling a request
 * stalled. Longer than `IDLE_TIMEOUT_MS` because nothing can arrive yet: the
 * Worker fails over past spent brains before it sends a byte, and the Workers
 * AI fallback measured 6-24 s to first output.
 */
export const FIRST_OUTPUT_TIMEOUT_MS = 90_000;

/**
 * Corpus scale, as shown to the reader on the empty chat screen.
 *
 * **Generated, not hand-typed** — `scripts/build-corpus-counts.ts` derives these
 * from the same builders that assemble the Worker's corpus, and `generate` runs
 * before `test`, `check` and `build`.
 *
 * They were hardcoded until 2026-09-11, because deriving them where they are
 * shown would drag the 536 KB generated corpus into the chat island's bundle
 * for the sake of three numbers. That trade was right; maintaining them by hand
 * was not. The guard test fired on three separate merges as the library grew —
 * 591/755, then 597/761, then 618/782 — each time demanding a manual edit that
 * no human judgement informed. Re-exported here so every consumer keeps one
 * import site, and the bundle still carries three integers rather than a corpus.
 *
 * `src/generated/` is gitignored, so these are rebuilt rather than committed —
 * there is no stale file to go out of date. `corpus-summary.test.ts` checks the
 * generated figures against a freshly built corpus, which guards the one seam
 * left: the generator discovers guides with `fs`, the corpus with Vite's glob.
 */
export {
  CORPUS_CHUNK_COUNT,
  CORPUS_FUNCTION_COUNT,
  CORPUS_GUIDE_COUNT,
  CORPUS_REFERENCE_COUNT,
} from "~/generated/corpus-counts";

import {
  CORPUS_CHUNK_COUNT as CHUNKS,
  CORPUS_FUNCTION_COUNT as FUNCTIONS,
  CORPUS_GUIDE_COUNT as GUIDES,
} from "~/generated/corpus-counts";

export const CORPUS_SUMMARY = `${FUNCTIONS} functions · ${GUIDES} guide sections · ${CHUNKS} chunks indexed`;

/**
 * The pills on the empty chat screen.
 *
 * Two jobs, and the second one is why this is structured data rather than a
 * list of strings. They have to be **real questions the corpus answers** — a
 * suggestion that gets refused is worse than no suggestion at all — and they
 * are the only place a reader discovers that Dox can render live widgets at
 * all. A reader who never asks a widget-shaped question never learns the
 * panel exists.
 *
 * So there is one per enabled widget, and `chat-starters.test.ts` asserts that
 * mapping is total: adding a tool to `ENABLED_TOOL_NAMES` without giving it a
 * starter fails the suite. That is the same parity contract
 * `widget-registry.test.ts` enforces between the tools and the registry, for
 * the same reason — a widget nobody can discover may as well not ship.
 *
 * **The widget opens on the click, not on the model.** Tool choice belongs to
 * the model and nothing here can force a call, so a pill used to show its
 * widget only if the model happened to call the tool — after the whole round
 * trip, and sometimes not at all. A pill is the reader asking for that widget
 * by name, so `args` seeds it at once (`DoxChat` → `onWidget`) while the
 * question is still in flight. The model's own call, if one comes, replaces it
 * unless its arguments are the same. `args` must describe exactly what `text`
 * asks; `chat-starters.test.ts` runs each through its tool's schema and the
 * registry's `validate`. The texts are still phrased to match each tool's
 * `Call when` line (see `dox-tools.ts`), so the answer and the widget agree.
 */
export const CHAT_STARTERS: readonly {
  readonly text: string;
  readonly widget: DoxToolName;
  /** The tool input this question describes. Plain data, checked by test. */
  readonly args: Readonly<Record<string, unknown>>;
}[] = [
  {
    text: "Show me what time it is in Tokyo right now.",
    widget: "showGlobe",
    args: { zone: "Asia/Tokyo" },
  },
  {
    text: "Convert 2:30pm on 15 March 2024 in New York to Tokyo time.",
    widget: "showConverterBench",
    // New York is on EDT (-04:00) from 10 March 2024.
    args: {
      value: "2024-03-15T14:30:00-04:00[America/New_York]",
      from: "America/New_York",
      to: "Asia/Tokyo",
    },
  },
  {
    text: "Show me how a meeting from 9am to 11am overlaps one from 10am to noon on 15 March 2024 in London.",
    widget: "showIntervalVisualizer",
    // London is on GMT (+00:00) until 31 March 2024.
    args: {
      aStart: "2024-03-15T09:00:00+00:00[Europe/London]",
      aEnd: "2024-03-15T11:00:00+00:00[Europe/London]",
      bStart: "2024-03-15T10:00:00+00:00[Europe/London]",
      bEnd: "2024-03-15T12:00:00+00:00[Europe/London]",
    },
  },
  {
    text: "What happens to 1:30am on 3 November 2024 in New York?",
    widget: "showDstInspector",
    // 3 November 2024 is New York's fall-back day: 1:30am happens twice.
    args: { zone: "America/New_York", year: 2024, preset: "overlap" },
  },
  {
    text: "How many days is a container at a New York terminal from 23:00 on 15 June 2024 to 01:00 the next morning?",
    widget: "showDwellLedger",
    // Wall times, read in `zone` by the widget.
    args: {
      entry: "2024-06-15T23:00",
      exit: "2024-06-16T01:00",
      zone: "America/New_York",
    },
  },
  {
    text: "Discharged in New York on Friday afternoon, three free days, out Tuesday morning: what is chargeable?",
    widget: "showFreeTimeLedger",
    // Friday 14 June 2024, 15:00 to Tuesday 18 June, 09:00, wall times in
    // `zone`. The question names no start-day or basis convention, so the
    // seed takes the widget's first preset's: the event day, calendar days.
    args: {
      clockStart: "2024-06-14T15:00",
      clockEnd: "2024-06-18T09:00",
      freeDays: 3,
      firstDay: "eventDay",
      basis: "calendar",
      chargeBasis: "calendar",
      zone: "America/New_York",
    },
  },
];

/** The rail call a starter pill makes on click: a stable id per starter, so a
 * second click on the same pill does not remount an identical widget. */
export function starterWidgetCall(starter: (typeof CHAT_STARTERS)[number]): {
  toolCallId: string;
  toolName: DoxToolName;
  input: Readonly<Record<string, unknown>>;
} {
  return {
    toolCallId: `starter-${starter.widget}`,
    toolName: starter.widget,
    input: starter.args,
  };
}
