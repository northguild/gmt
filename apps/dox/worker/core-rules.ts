// Astro's own ambient types declare `*.md` imports as `AstroComponentFactory`
// (its content-collection machinery); Wrangler's Text module rule (see
// wrangler.jsonc "rules") makes this resolve to a plain string at Worker
// runtime instead. `astro check` still types this import Astro's way since
// worker/ shares the app's tsconfig, so the cast below routes around that —
// not a real type error.
import coreRules from "./core-rules.md";

/**
 * DOX-C2 (#138) — the four core rules (string-first API, Temporal-only
 * internals, plain/zoned separation, no-throw helpers) and the sentinel
 * fallbacks, as the chat's system prompt carries them.
 *
 * The text lives in `worker/core-rules.md`, owned by this Worker and read by
 * nothing else, so no other document's wording can change the chat's prompt.
 * `core-rules.test.ts` pins the text and the four rule names. The site's own
 * page for the same rules is `src/content/docs/core-rules.mdx`; keep the two in
 * step by hand.
 */
export const CORE_RULES_CONTENT: string = (
  coreRules as unknown as string
).trim();
