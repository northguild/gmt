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
  { id: "gemini-3.8-flash", label: "3.8 Flash", dailyLimit: 20 },
  { id: "gemini-3.7-flash", label: "3.7 Flash", dailyLimit: 20 },
  { id: "gemini-3.6-flash", label: "3.6 Flash", dailyLimit: 20 },
  { id: "gemini-3.5-flash", label: "3.5 Flash", dailyLimit: 20 },
  // Flash-Lite — faster and cheaper, still comfortably good enough for
  // documentation Q&A over retrieved chunks.
  { id: "gemini-3.5-flash-lite", label: "3.5 Flash-Lite", dailyLimit: 20 },
  { id: "gemini-3.1-flash-lite", label: "3.1 Flash-Lite", dailyLimit: 20 },
  {
    id: "gemini-3.1-flash-lite-preview",
    label: "3.1 Lite Preview",
    dailyLimit: 20,
  },
  { id: "gemini-3-flash-preview", label: "3 Flash Preview", dailyLimit: 20 },
  // Pro, last resort. Confirmed real (it answered 429, not 404) but its free
  // allowance is far smaller than Flash's, so this limit is a conservative
  // guess. Reaching it means every Flash brain is spent, which is a good day.
  { id: "gemini-3.1-pro-preview", label: "3.1 Pro Preview", dailyLimit: 5 },
] as const satisfies readonly Brain[];

export interface Brain {
  id: string;
  label: string;
  /** Advisory only — used to render "N left", never to refuse a request. */
  dailyLimit: number;
}

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
 * *everyone*, so a cap of 5 lets roughly 33 readers get a full turn before the
 * day is spent. A cap of 10 would halve that to 16, and five questions is
 * already more than a typical reader asks of a documentation bot in one
 * sitting.
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

export const IDLE_TIMEOUT_MS = 30_000;

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
 * **`widget` is intent, not a guarantee.** Tool choice belongs to the model, so
 * nothing here can force a call; these are phrased to match each tool's
 * `Call when` line (see `dox-tools.ts`) and to lead with the imperative, which
 * measurably raises the hit rate. They are not a substitute for the widgets'
 * own `/tools` pages, which mount deterministically.
 */
export const CHAT_STARTERS: readonly {
  readonly text: string;
  readonly widget: DoxToolName;
}[] = [
  {
    text: "Show me what time it is in Tokyo right now.",
    widget: "showGlobe",
  },
  {
    text: "Convert 2:30pm on 15 March 2024 in New York to Tokyo time.",
    widget: "showConverterBench",
  },
  {
    text: "Show me how a meeting from 9am to 11am overlaps one from 10am to noon on 15 March 2024 in London.",
    widget: "showIntervalVisualizer",
  },
  {
    text: "What happens to 1:30am on 3 November 2024 in New York?",
    widget: "showDstInspector",
  },
];
