/**
 * DOX-C2 (#138) — shared between the Worker (`worker/*`) and, from `DOX-C3a`
 * onward, the client. There is no model-selector UI yet, so "shared" only
 * has one consumer today; this is where that seam lives so UI and Worker
 * never drift once a second one exists.
 *
 * Values are starting points, not measured optima — same epistemic honesty
 * as DOX-C1's cache TTL. Retune with production traffic, not in advance.
 */

// DOX-C1 (#137) picked "gemini-2.5-flash", but a live call during DOX-C2's
// implementation (2026-09-09) found Google now rejects it for new API keys:
// "This model models/gemini-2.5-flash is no longer available to new users.
// Please update your code to use models/gemini-3.6-flash." Re-verified
// live, not assumed — see DOX-C.md's own warning that model availability
// "moves" and must be re-checked before committing.
export const ALLOWED_MODELS = ["gemini-3.6-flash"] as const;
export type AllowedModel = (typeof ALLOWED_MODELS)[number];

export const MAX_MESSAGES = 40;
export const MAX_MESSAGE_LENGTH = 4000;

export const RATE_LIMIT_MAX = 20;
export const RATE_LIMIT_WINDOW_SECONDS = 60;

export const IDLE_TIMEOUT_MS = 30_000;
