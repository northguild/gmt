# Verification and risks — epic-wide

> Load for reviews. What each tier ships is in [built.md](../built.md).

## Checks that apply to any Dox change

- `pnpm run validate` (root) is green, **including the 20-cell GMT timezone matrix** — Dox must
  not perturb `packages/gmt`. From `apps/dox`: `pnpm test`, `pnpm check`, `pnpm lint`.
- **Generator:** the generated `startOfZoned` page matches
  `packages/gmt/src/zoned/calculate/startOfZoned.ts` line by line (options table, all five
  examples). `getDstTransitions`'s multi-line example renders; `weekOfYear.ts`'s two exports get
  two pages. The route manifest equals the generated page set. The count test fails when a
  function is added without re-extraction.
- **Search:** `addBusinessDays` in the deployed Pagefind index lands on its page (Pagefind does
  not run in dev).
- **Keyboard-only pass** with the mouse unplugged, on pages and on every widget touched.
- **Contrast** measured on real rendered pages, widget surfaces included: body text ≥ 7:1.
- **Visual gates** after any CSS or widget-markup change: `visual:diff` and
  `scripts/html-diff.mjs` (see [design-system.md](design-system.md)).
- **Chat:**
  - An out-of-corpus question is **refused, not improvised**.
  - A hallucinated route renders as **plain text**, never a broken link.
  - Nonsense tool arguments, an unknown tool name and an `output-error` part each render an
    error state without crashing.
  - An exhausted brain fails over inside the request, and `/api/brains` counts move.
  - A reference page loads **no React bundle** (network panel).
  - Tailwind Preflight is absent from the build.
  - No model key appears in `dist/` or in any `/api/chat` response.
- **Bundle:** the Worker stays under Cloudflare's 3 MB compressed limit
  (`wrangler deploy --dry-run`).

## Live risks

- **The exports map.** Import `@northguild/gmt` at module granularity only. Per-function paths
  are forbidden, and namespace barrels re-export the 2.98 MB polyfill.
- **Merging to `main` deploys.** `deploy-dox.yml` has no path filter and no manual trigger.
- **Free-tier quotas move.** Gemini withdraws models from new keys without notice, and Workers
  AI's allocation is per account. Re-probe brains after provider releases (runbook in
  `built.md`).
- **Stay on the Workers Free plan.** There an exhausted Workers AI allocation fails; on Workers
  Paid it bills, and nothing in code can see which plan is active.
- **AI Elements are vendored.** Upstream fixes do not arrive on their own, and a re-sync is a
  merge. `prompt-input.tsx` carries a local change (reset deferred to success) that must survive
  it. Never run bare `npx ai-elements@latest` — it installs all 48 components.
- **Tailwind leaking out of the island.** Any new unlayered GMT selector that matches chat
  markup joins the collision list in `design-system.md`.
- **Astro/Starlight churn.** Pin Astro, Starlight and its markdown peer; re-check
  `src/virtual-starlight.d.ts` on every Starlight upgrade.
- **Zone data ages.** The globe's coordinates come from tzdata, which releases several times a
  year.
- **Mouse-shaped widgets.** A globe, a draggable timeline and a scrubber each need a keyboard
  path and a typed-input equivalent — decided when built, not retrofitted.
- **A Cloudflare account is a hard dependency** for deployment, not only for the chat.
