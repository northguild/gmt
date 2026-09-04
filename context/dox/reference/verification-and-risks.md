# Verification and risks — epic-level cross-cutting

> The per-story Definition of Done lives in each `issues/DOX-*.md`; this file is the
> **cross-cutting** list `dox-architect` checks on epic-level reviews. Load when picking
> up a story only if the DoD specifically references it.
>
> See also: [overview.md](../overview.md) for architecture and the tier table.

## Verification

- `pnpm run validate` (root: `pnpm -r --if-present run build && … lint && … typecheck && … test`)
  stays green, **including the existing 20-cell GMT timezone matrix** — Dox must not
  perturb `packages/gmt`. (nx was removed in commit `9a7063f`.)
- `pnpm --filter @gmt/dox build` produces a static site; `pnpm --filter @gmt/dox dev` serves it.
- **The generator spot-check (story DOX-A3a, the highest-leverage test in the epic):**
  compare the generated page for `startOfZoned` against
  `packages/gmt/src/zoned/calculate/startOfZoned.ts` line by line. It has the heaviest
  JSDoc in the codebase — an options object, multi-clause bullets, and five annotated
  examples with parenthetical explanations after the `// result`. If that page is right,
  the generator is right; if it is wrong, it is wrong 504 times. Additionally verify the
  two named parser edge cases directly: `getDstTransitions`'s multi-line result renders
  correctly, and `plain/calculate/weekOfYear.ts`'s two exports each get their own page.
- **The route manifest equals the generated page set, asserted in the same test suite as
  the generator.** A manifest that drifts from reality is worse than none — it would
  silently suppress valid links or admit dead ones, and by Tier 6 it is also DOX-A3b's and
  DOX-C3a's correctness boundary.
- Search `addBusinessDays` in the deployed Pagefind index and land on its page.
- The corpus-count Vitest test fails when a `gmt` function is added without
  re-extraction.
- **Keyboard-only pass with the mouse unplugged.** Starlight gives a good baseline; Tier 3
  is exactly what puts it at risk, so run this before and after DOX-D1. **Repeat it for
  every Tier 2, 4, and 5 widget** — a drag-based timeline, a globe, and a time scrubber are
  each a new surface the baseline pass does not cover for free.
- **Contrast audit against real rendered pages**, not flat swatches — including widget
  surfaces, not only prose.
- Tier 6 only, and the single most important behavioral test in the epic: a question with
  no corpus answer must be **refused, not improvised**. Separately, stub a response
  containing a plausible-but-nonexistent route and confirm it **renders as plain text**
  rather than a broken link — the route manifest makes this a property, not a hope.
- **Tier 6, `DOX-C0` (#171) — the byte-identical screenshot gate.** Introducing React and
  Tailwind must change no existing page. Run `design-system.md`'s screenshot diff across
  landing / a dense reference page / sidebar / search modal / mobile menu, in light and
  dark, desktop and mobile, with the chat island present but never opened. Any diff is a
  regression. Also grep the build output to confirm **Tailwind Preflight is absent**, and
  confirm in the network panel that a reference page loads **no React bundle**.
- **Tier 6, `DOX-C3b` — tool-call robustness.** The AI SDK parses streamed tool input,
  so there is no hand-rolled parser to break. Three gates: a tool call with a **valid
  shape but nonsense arguments** renders an error state rather than crashing; an
  **unknown tool name** is handled; and an **`output-error` part** is handled. Verify each
  directly, not by inference.
- **Tier 6, `DOX-C3a` — both surfaces, not one.** Every chat DoD item is checked on the
  every-page dock **and** on `/dox`, and `/dox` must render usefully with the DOX-E1 globe
  absent.

## Risks

- **Generator fidelity is the whole bet in Tier 0.** 504 pages are only as good as the
  parse — and, per §1, the hard part is signatures, options objects, and the 42 public
  types, not the `@example` line format. Mitigation: the TypeScript compiler API rather
  than regex, the `startOfZoned` byte-exact spot-check in DOX-A3a's Definition of Done, and
  count assertions in CI.
- **The exports map, not the `@example` format, is the thing most likely to be gotten
  wrong first.** §1 measured the `@example` parser at ~15 lines and one edge case; the
  real trap is instructing an island to deep-import a single function, which
  `packages/gmt/package.json` forbids outright (`"./plain/*/*": null`). Every Tier 2–6
  story that imports the library must use module-granularity barrels.
- **Namespace READMEs become redundant.** The six `src/*/README.md` files are flat
  function-name indexes with no signatures or examples; a generated site fully
  supersedes them. They ship in the npm tarball and `.agents/skills/update-readme`
  maintains them, so decide deliberately in DOX-A3a whether they stay as-is or become short
  stubs pointing at the site. Do not let them silently rot.
- **Tier 3 can undo Tier 0.** The most likely failure mode in this epic remains a
  screenshot that looks incredible over a UI nobody can read for ten minutes. The
  sequencing is the mitigation: the site is good and live, and Tier 2's widgets already
  work, before the chrome lands, so Tier 3 can be reverted without losing the docs or the
  interactivity. Judge it by reading a long reference page end to end, never by the
  screenshot.
- **`corner-shape` is not Baseline.** The chamfer is progressive enhancement; the
  `clip-path` fallback clips `box-shadow` and `outline`, so focus states must be
  verified in _both_ paths.
- **Globe geography data does not exist in the library.** `getTimeZones()` returns IANA
  identifiers, not coordinates. DOX-E1a must vendor tzdata's `zone1970.tab` (public
  domain, ~450 rows) with a provenance note and a refresh reminder — it is not a one-time
  import, tzdata itself releases several times a year.
- **The globe's rendering approach must be recorded, not inherited.** `d3-geo`,
  `topojson-client` and `world-atlas` are already `apps/dox` dependencies, and
  `d3-geo`'s `geoOrthographic` gives a draggable globe with hit-testing and DOM focus
  order for free. Start from `d3-geo` and only reach for WebGL if it demonstrably cannot
  do what DOX-E1a asks; record the decision either way.
- **Widget bundle budget.** Tiers 2 and 5 put an island on nearly every page. Combined with
  the exports-map finding above, this is the epic's main performance risk. Hydrate
  `client:visible`, import at module granularity, and measure a heavy reference page
  before and after DOX-B2a.
- **Native `Temporal` may already make the polyfill unnecessary.** If browser support is
  broad enough by the time Tier 2 is built, widgets could use native `Temporal` and drop
  2.98 MB entirely. Verify at DOX-B1a rather than assuming either way — it is the single
  largest performance win available and it may already be free.
- **Accessibility of the ambition tier.** A spinning globe, a drag-based interval
  timeline, and a time scrubber are all mouse-shaped interactions. Each needs a keyboard
  path and a non-visual equivalent decided in its own story, not retrofitted — see §3's
  "Widget chrome" subsection.
- **Corpus size vs. free tier (Tier 6).** 504 functions plus 1,860 examples is too large
  to inject wholesale on every request. This is why DOX-C1 is retrieval rather than
  full-corpus injection — measure the real token size in DOX-C1 before committing to any
  heavier approach. The sibling repo (see "Reviewed prior art") puts the bake-vs-retrieve
  threshold at ~500 KB of docs; we are plausibly past it, but DOX-C1 measures rather than
  assumes.
- **Corpus staleness (Tier 6).** Hosting is a single same-origin Worker (see §2
  "Hosting"), so the Worker can fetch the corpus from the site it is already serving
  rather than baking it into its own bundle — which resolves this risk rather than
  merely mitigating it. If DOX-C1 nonetheless chooses to bake the corpus in, a docs-only
  change leaves the chatbot answering from stale content until the Worker is redeployed,
  and the CI trigger overlap must ship in the same story.
- **Model choice (Tier 6).** Behind the AI SDK the provider is one import and one model
  string, so this is **not a one-way door** and not a provider filter — any tool-capable
  provider works. Choose in DOX-C1 on cost, latency and quality. The residual risk is
  **validation**, not parsing: the AI SDK parses streamed tool input, but a well-formed
  tool input can still carry nonsense arguments, and the widget registry must be fixed
  and typed — never `eval`.
- **A second styling system enters the repo (Tier 6, `DOX-C0`).** Tailwind v4 emits
  `@layer`; the 20 GMT sheets are unlayered and therefore beat every Tailwind utility.
  `design-system.md` records the full collision list (`h1`–`h6`, `textarea`/`input`,
  `body`) and the four constraints — omit Preflight, import from the island entry, ship a
  `.gmt-ask` reset, bridge shadcn variables onto `--gmt-*`. The gate is the byte-identical
  screenshot diff. **This is the single riskiest assumption in Tier 6**; if it fails, the
  fallback is vendoring the 12 components and re-skinning them in GMT CSS, which forfeits
  the upgrade path.
- **React ships to a site that has never had it (Tier 6, `DOX-C0`).** The dock is on every
  page, so a careless `client:load` would put React in every page's critical path.
  Mitigation is structural: the launcher is a button, the chat core hydrates only on open,
  and the Tailwind sheet is imported from the island entry so Vite code-splits it. Verified
  in the network panel, not by reading config.
- **AI Elements upgrade drift (Tier 6).** Components are copied into the repo, so we own
  them — which means upstream fixes do not arrive on their own, and local re-theming makes
  re-running `add` a merge rather than an overwrite. Record which 12 components are
  installed and at what date. **Never run bare `npx ai-elements@latest`** — it installs all
  48, including `@xyflow/react` and the coding-agent set.
- **The Worker gains dependencies (Tier 6, `DOX-C2`).** The Worker bundles `ai` plus a
  provider. Measure the built bundle against the Workers size limit and record it, rather
  than assuming it fits.
- **Astro/Starlight churn.** Both move quickly and Starlight peers on an exact-ish Astro
  major, plus, as of `0.41.9`, a specific `@astrojs/markdown-remark` peer. Pin all three,
  upgrade deliberately, and keep the generator emitting plain MDX so only the site shell
  is coupled to the framework.
- **A Cloudflare account is a hard dependency for deployment, not only for chat.** The
  Tier 0 MVP cannot ship without one; confirm account access before starting DOX-A1.
- **Scope honesty.** 23 units of work across 14 issues. Tier 0 is three of them and is
  genuinely small — a few days, not weeks. Every tier after Tier 1 remains independently
  droppable without losing the docs, which is the property this epic depends on and which
  must be preserved as the tier structure evolves.
