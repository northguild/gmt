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
 * gives ~20 requests/day across all visitors, which is not a product; four
 * gives roughly four times that.
 *
 * **Only the first entry is verified.** `gemini-3.6-flash` is what Google's own
 * error told this key to use, and it has been observed working at 20 RPD. The
 * rest are candidates. That is deliberate and safe, because:
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
 */
export const BRAINS = [
  { id: "gemini-3.6-flash", label: "3.6 Flash", dailyLimit: 20 },
  { id: "gemini-3.1-flash-lite", label: "3.1 Flash-Lite", dailyLimit: 20 },
  { id: "gemini-3-flash-preview", label: "3 Flash Preview", dailyLimit: 20 },
  { id: "gemini-2.5-flash-lite", label: "2.5 Flash-Lite", dailyLimit: 20 },
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
 */
export const VISITOR_DAILY_MAX = 10;

export const MAX_MESSAGES = 40;
export const MAX_MESSAGE_LENGTH = 4000;

export const RATE_LIMIT_MAX = 20;
export const RATE_LIMIT_WINDOW_SECONDS = 60;

export const IDLE_TIMEOUT_MS = 30_000;
