# Story Group Summaries

**23 units of work across 7 tiers, mapped onto the same 13 GitHub issues (#130–#142) —
no new issues are created.** New work enters as a lettered sub-story on the issue it
naturally belongs to (`DOX-A3a`/`DOX-A3b`, `DOX-B2a`–`DOX-B2d`, …), following the
`J0a`/`J0b` sub-ID precedent already used in `context/roadmap/`. Each story ships
something visible. Tier 0 produces a real, deployed, searchable docs site; every tier
after it is additive on top of a site that already works. See [overview.md](overview.md)
§1 for why the ordering is the point, and §5 for the full tier table with issue numbers.

**Re-audited 2026-08-26.** Counts below are current as of that date; see overview.md §1
for the full list of what changed since the 2026-08-21 draft. Two reversals are worth
flagging up front because they invert the original plan's instincts: the globe is now a
**flagship feature**, not decoration (Tier 4), and the chatbot is **escalated** to a
widget-emitting surface, not demoted (Tier 6) — both by explicit user decision.

## Tier 0 — Ship the site (the MVP)

Three stories, order-locked. After `DOX-A3a`, `@northguild/gmt` has a documentation site
that anyone can search, link, and read, covering all 504 functions. Nothing in Tier 1
onward is required for that to be true.

- **DOX-A1. Workspace skeleton + first pages** — Create `apps/docs` as `@gmt/docs`
  (private, `type: module`), depending on `@northguild/gmt` via `workspace:*`. Astro
  `7.2.7` + `@astrojs/starlight` `0.41.9`, with `src/content.config.ts` using Starlight's
  `docsLoader()` + `docsSchema()`. Ship a real landing page plus two hand-written pages
  (Install, Core Rules), both lifted from `packages/gmt/README.md`, so the site has real
  content from the first commit rather than placeholder text. Wire the four easy-to-miss
  integration files — see overview.md §4, and note `oxlint.config.js` is `.js`, not
  `.ts`, and that `apps/docs` needs an explicit `project.json` because Nx will not infer
  targets for it. **Gate:** `apps/docs` must not extend `tsconfig.base.json`; use
  `astro/tsconfigs/strict`. **Check the local Node version before starting** — Astro 7
  needs `>=22.12.0` and a local shell can easily be older than `.nvmrc`'s `24`.
- **DOX-A2. Deploy** — A single Cloudflare Worker with an `assets` binding serves
  `apps/docs/dist`; no `main` is needed at this tier (`not_found_handling: "404-page"`
  is the whole config). Deploy via `cloudflare/wrangler-action` in a GitHub Actions
  workflow matching `ci.yml`'s existing conventions (`pnpm/action-setup@v4` at
  `10.32.1`, `actions/setup-node@v4` with `cache: pnpm`, `pnpm install
--frozen-lockfile`, Nx for the build), with `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` as repo secrets. Pagefind search comes free with the Starlight
  build. **Deliberately done second, before any bulk content**: every subsequent story
  is then immediately visible on a live URL, which is the fastest possible feedback loop
  and the thing the superseded plan most lacked. This is a **rewrite from GitHub Pages**
  — verified 2026-08-26 that Pages was never enabled on this repo, so there is nothing to
  migrate away from; see overview.md §2 "Hosting" for why one Cloudflare origin beats a
  Pages + Worker split even before the chat exists.
- **DOX-A3a. Reference generator** — The heart of the epic.
  `apps/docs/scripts/build-reference.ts` walks `packages/gmt/src/**/*.ts` with the
  **TypeScript compiler API** (not regex) and emits one MDX page per exported function
  into `src/content/docs/reference/<namespace>/<module>/`, plus a module index page per
  directory. The sidebar falls out for free via Starlight's
  `autogenerate: { directory: 'reference' }` — the `src/` tree is already a correct
  taxonomy. The same run emits three more artifacts — one extraction, four consumers:
  `gmt-corpus.json` (retrieval chunks and `llms-full.txt` source, each carrying its
  page's URL), a **route manifest** (every URL generated, consumed by a build-time link
  check here, by `DOX-A3b`'s AI surface, and defensively by `DOX-C3a` if Tier 6 is
  reached), and the parsed `{ call, result, note }` triples `DOX-B2a` seeds every
  playground from. Generated MDX is gitignored and produced by a prebuild step, with a
  committed stub so tests run on a clean checkout. A Vitest test asserts function/example
  counts so corpus drift fails CI.
  **The real risk here is not the `@example` line format** — measured on 2026-08-26,
  1,859 of 1,860 examples match one shape exactly and the parser is roughly fifteen
  lines. TypeDoc is still the wrong tool, but for a different reason: `src/` has zero
  `@category`, `@see`, and `@throws` tags, so there is no cross-link graph to extract at
  all, and it treats `@example` as a fenced block regardless. **The actual hard work is
  rendering the 42 public types and the options-object prose** — `startOfZoned`'s
  `@param options` is a single ~400-character line covering four keys, and turning that
  into a linked parameter table is what makes or breaks this story. Get the parser
  working first against `startOfZoned.ts` (the heaviest JSDoc in the codebase), including
  its five examples with parentheticals, before generating anything at scale. Handle two
  named edge cases deliberately: `getDstTransitions`'s one multi-line example, and
  `plain/calculate/weekOfYear.ts`, the only file exporting two functions.

## Tier 1 — Substance and foundations

Three stories. `DOX-A5` moves earlier than the original plan's Group A ordering because
every widget built from Tier 2 onward is styled from its tokens — building widgets
against unstyled Starlight first would mean restyling them twice.

- **DOX-A5. Brand pass** — Palette, typography, and token layer only: the cheap 80% of
  identity. Starlight's `customCss` option plus its documented CSS custom properties —
  the cyber blue/green ramp on blue-tinted near-black, JetBrains Mono for body and code,
  a display face for headings, self-hosted subsets with no runtime CDN request. See
  overview.md §3's Color and Typography subsections, which are the spec for this story.
  Explicitly **not** glass, animated borders, or chamfer — those are Tier 3, applied
  later over pages and widgets that already work.
- **DOX-A4a. Guides** — Hand-curated MDX under `src/content/docs/guides/`, ported from
  material that already exists rather than written from scratch: the README's Quick
  Start split into topical guides (Plain arithmetic, Durations, Intervals, Zoned
  operations, Formatting), `docs/dst-disambiguation.md` moved in wholesale and finally
  given a home in the nav, and the 11 domain `packages/gmt/skills/*/SKILL.md` guides
  reshaped into task-oriented pages — their Core Patterns sections map almost 1:1 onto
  guide structure. (Their Common Mistakes sections are reserved for `DOX-A4c` in Tier 5,
  not duplicated here.) `packages/gmt/skills/_artifacts/domain_map.yaml` and
  `skill_tree.yaml` are a ready-made information architecture; use them for ordering
  rather than inventing one.
- **DOX-A3b. AI surface (`llms.txt`).** New. Extends `DOX-A3a`'s corpus into `llms.txt` (a
  nav index), `llms-full.txt` (the full corpus as plain text), a raw `.md` route
  alongside every rendered page, and a "copy as markdown" affordance on each page.
  `starlight-llms-txt@0.11.0` exists as prior art; evaluate it against emitting directly
  from `DOX-A3a`'s already-parsed corpus, which is probably better here since re-deriving
  from rendered MDX would duplicate work the generator already did. This is what makes
  every model the reader already has open — not just a purpose-built chatbot — answer
  correctly about GMT, and it is a day of work sitting on data that already exists.

## Tier 2 — The widget platform

Six stories. This is the epic's differentiator: every one of 1,860 examples runs the
**real**, shipped library, live, in the browser, with no API key, no server, and no
model. No competing date-library documentation site does this at this scale.

- **DOX-B1a. `<Playground>` island** — An interactive component that runs the **real**
  `@northguild/gmt` in the browser: editable inputs, live output, never simulated.
  Because `apps/docs` depends on the package via `workspace:*`, output can never drift
  from shipped behavior. Sentinel-aware rendering is the point, not a detail: an
  invalid-input result (`""` / `null` / `false` / `[]`) renders as
  `⟨ NO SIGNAL — invalid input ⟩`, not a blank field. A blank box teaches nothing; the
  signal-lost state teaches GMT's sentinel contract. Distinguish it from a legitimately
  empty result (an interval function correctly returning `[]`) — see overview.md §3
  "Widget chrome". Hydrate `client:visible` and **import at module granularity**
  (`@northguild/gmt/plain/calculate`) — **not** per-function, which
  `packages/gmt/package.json`'s `"./plain/*/*": null` forbids, and **not** at namespace
  level, which drags in the 2.98 MB polyfill via the namespace barrels' `export * from
"@js-temporal/polyfill"`. **Check whether native `Temporal` support is broad enough to
  drop the polyfill entirely** before committing to its bundle cost — this may already be
  free.
- **DOX-B2a. Auto-embed** — Extend `DOX-A3a`'s generator to mark up each `@example` so it
  renders as a runnable playground seeded with that example's own arguments. All 1,860
  examples become interactive with zero per-page authoring. This is the payoff for
  having done `DOX-A3a` with a real parser: the call/result split it already produces is
  exactly the seed data this story needs. Keep the static text as the non-JS fallback and
  in the Pagefind index — auto-embedding must not remove content from search.
- **DOX-B2b. DST Transition Inspector.** New. Pick an IANA zone and a year, call the
  already-exported `getDstTransitions`, and let the reader scrub the resulting gap or
  overlap while toggling `disambiguation` and `offset` live. This demonstrates the one
  genuinely counter-intuitive fact in the library — that `offset: "prefer"` makes
  `disambiguation` inert — which `startOfZoned`'s fifth example states in prose and
  nothing currently shows working. No model, no key, no server; this is exactly the
  widget `appendix-parked.md` §2 identified as buildable without a chatbot, promoted out
  of the appendix per that file's own instruction.
- **DOX-B2c. Interval algebra visualizer.** New. Drag two or more intervals on a
  timeline and watch intersection, union, difference, xor, abuts, and engulfs update
  live, over the **109 interval functions** (plain 53, zoned 19, unix 19, utc 18) —
  Allen's interval algebra, fully implemented and, until this story, entirely
  un-illustrated anywhere in the library's documentation.
- **DOX-B2d. Converter + format bench.** New. Zone-to-zone conversion via
  `convertZonedToZoned`, live `formatZonedToParts` and relative-time output, locale
  switching, and a regex tester over the 22 exported `regex` consts. Consolidates the
  "try it on my own input" surface that would otherwise be scattered across many
  individual reference pages.
- **DOX-B1b. Widget permalinks.** New. Every widget from this tier encodes its current
  state into the URL. Without this, a playground is a toy; with it, a playground is
  exactly as linkable as a reference page, which is the entire premise the site is built
  on (see overview.md §1).

## Tier 3 — HUD identity

Two stories. The expensive half of the aesthetic, applied as a CSS layer over pages —
and, by this tier, widgets — that already work. overview.md §3 is the spec for both
stories, including its "Widget chrome" subsection added for Tier 2's surfaces.

- **DOX-D1. Chrome** — The six-layer glass panel construction (with the non-optional
  `brightness()` component in `backdrop-filter` — blur alone does not make text
  legible), animated borders via a rotating conic gradient registered with
  `@property --angle`, and the `corner-shape: bevel` / `clip-path` chamfer utility with
  a focus ring verified in **both** paths. Every native control restyled via
  `appearance: none`, **never rebuilt as `div`s** — rebuilding loses IME composition
  (breaking all CJK input), autofill, mobile keyboard behavior, form semantics, and
  screen reader support, none of which is visible while developing on a US-English
  desktop. Starlight ships a good accessible baseline; this story's real job is to
  restyle without regressing it. Gated behind `prefers-reduced-motion`,
  `prefers-reduced-transparency`, and `prefers-contrast` from the start. **Depends on
  `DOX-A5` and Tier 2's widget panels** (`DOX-B2b`–`d`) as the natural glass surfaces —
  not on the chat panel, which does not exist yet at this point in the sequence.
- **DOX-D2. Motion** — Boot sequence on first paint, entry/exit via `@starting-style` +
  `transition-behavior: allow-discrete`, Popover API for tooltips, view transitions so
  elements morph rather than pop. Glitch/RGB-split only on state transitions — never
  idle, never over text being read. Only the active/focused panel animates; every panel
  pulsing at once reads as broken, not alive. **Ships the general debounced,
  interruptible reveal primitive**; `DOX-C3a` wires it to streaming chat replies later,
  in Tier 6 — this story must not block on Tier 6 to close.

## Tier 4 — The globe

Two stories. **Promoted from decoration to flagship by explicit user decision** — the
2026-08-21 draft scoped this as a droppable landing-page flourish; it is now a product
feature. All seven functions both stories need are already exported and verified
present: `getTimeZones`, `getZonedNow`, `getTimeZoneOffset`, `isInDaylightSaving`,
`hasDaylightSaving`, `getDstTransitions`, `convertZonedToZoned`.

- **DOX-E1a. Interactive globe.** Rewritten. Spin it, click a zone, and read its live
  local time, UTC offset, and DST state; render a day/night terminator computed from the
  current instant. Two open decisions this story must settle rather than inherit: **where
  zone coordinates come from** — nothing in the library maps an IANA identifier to
  lat/lon, so vendor tzdata's `zone1970.tab` (public domain, ~450 rows) with a
  provenance note and a refresh reminder, since tzdata itself releases several times a
  year — and **how to render it**. The 2026-08-21 draft assumed Three.js + React Three
  Fiber; for a globe that must be clickable and keyboard-navigable, an
  orthographic-projection canvas or SVG globe may be lighter and give hit-testing and
  focus order for free instead of inventing them against a WebGL scene. Prototype both
  before committing — the goal is the interaction, not the framework. `client:visible`,
  pause rendering when the tab is hidden, static fallback under
  `prefers-reduced-motion` or where WebGL is unavailable, and a full keyboard path
  (arrow-key zone stepping at minimum) from day one.
- **DOX-E1b. Multi-zone time scrubber.** New. Pin several zones, drag a time slider, and
  watch every pinned clock move together while DST boundaries visibly bite. This is the
  meeting-planner use case — the single most common real reason anyone reaches for a
  timezone library — and nothing in the epic currently demonstrates it as a coherent
  workflow rather than a set of individual function calls.

## Tier 5 — Real-world scenarios

Three stories, content-heavy, with a different skill profile from Tiers 2–4 — **this
tier may run in parallel with them once `DOX-B1a` exists**, since it does not compete for
the same component-building effort.

- **DOX-A4b. Scenario template + first three.** New. A fixed page shape: **the naive
  approach → a live widget showing it break → why → the gmt approach → the same widget
  working.** Teaching by demonstrated failure, not assertion. Candidate scenarios:
  recurring meetings across a DST boundary; storing a birthday (plain date vs. instant);
  "posted 3 hours ago"; booking availability windows; a flight crossing the date line;
  monthly billing without drift; the `Pacific/Chatham` +12:45 case the CI matrix already
  tests. Ship the template plus three of these.
- **DOX-A4c. Ported pitfalls.** New. Port the **63 severity-graded mistakes** (1
  CRITICAL, 23 HIGH, 39 MEDIUM) already written as wrong-vs-right code pairs across 11
  domain `SKILL.md` files into pitfall pages, each with live proof via Tier 2's
  playground, cross-linked from every reference page the mistake touches. This is
  **porting, not writing** — the content exists; the work is presentation and live
  verification.
- **DOX-A4d. Scenario index.** New. A mentor-voiced "start here" page driven by
  `packages/gmt/skills/_artifacts/domain_map.yaml`, answering "I have X and need Y"
  rather than "which function is named what" — the discovery problem 504 functions
  create that neither search nor a sidebar alone solves.

## Tier 6 — Ask Dox (the chatbot that mounts widgets)

Four stories. Now that the site has real pages, real URLs, and a full widget platform,
the chatbot's job is well-defined and its ambition is higher than the original plan's:
answer, **cite pages the reader can open, and mount a real widget** rather than print a
code block. It augments the docs; it does not replace them. **Escalated, not demoted, by
explicit user decision.**

- **DOX-C1. Retrieval index** — Extend `DOX-A3a`'s `gmt-corpus.json` into retrieval
  chunks: function signature + description + examples + its page URL, with guides
  chunked by heading. Keyword/BM25 first — with 504 functions and a strong, consistent
  naming convention it will carry surprisingly far, and it needs no embedding model and
  no vector store. Bias retrieval toward the namespace of the page the reader is on.
  **Measure the real corpus token size here** before committing to anything heavier.
  **Where the corpus lives at runtime is now resolved by the Tier 0 hosting decision**,
  not left open: the same-origin Worker fetches the corpus from the static site it is
  already serving, with no extra hop and no staleness coupling. **Re-open the model
  choice here.** Gemini 2.5 Flash was chosen for free-tier SSE streaming before widgets
  were central; `DOX-C3b` now requires streamed tool calls, which changes the calculus
  toward whichever provider has better streaming tool-use ergonomics.
- **DOX-C2. Worker proxy** — Same-origin `/api/chat` inside `apps/docs`'s Worker (see
  overview.md §2 "Hosting" — this is no longer a separate `workers/dox-proxy` deployment,
  which removes the CORS allowlist entirely). Key via `wrangler secret put
GEMINI_API_KEY` (or the chosen provider's equivalent). Unbuffered SSE passthrough.
  `systemInstruction` is assembled in a specific order — persona and scope, then linking
  rules listing only the routes retrieved for this question, then `SKILL.md` vocabulary
  _before_ reference material, then GMT's core rules, then the retrieved chunks, then an
  explicit refusal instruction. That last part is how grounding is actually achieved;
  there is no `systemKnowledge` setting. The story also carries a full edge-validation
  checklist (method, message count, content length, role and model allowlists, mapped
  upstream errors, rate limiting with its per-isolate caveat stated honestly) and two
  testability rules worth following from day one: keep SSE parsing pure, and put the
  clock behind a helper so rate limits can be tested with faked time.
- **DOX-C3a. Chat panel** — A dismissible panel on the docs site, built from `DOX-A5`'s
  tokens. Streaming answers with **citations linking to real reference and guide URLs**.
  Stop button, error state, rate-limit state, using the sentinel/signal-lost treatment
  rather than a generic error box. The important mechanism here is **link hardening**:
  every href the model emits is checked against `DOX-A3a`'s route manifest, and anything
  not in it renders as plain text rather than a broken link. That makes "citations
  resolve" a runtime property instead of a test we sample. Also carries the streaming
  details that are painful to retrofit — dual overall/idle timeouts, error-vs-warning
  classification, and a cleaned history snapshot — and wires `DOX-D2`'s reveal primitive
  to streamed replies.
- **DOX-C3b. Widget registry.** New. The model answers a free-form question by
  **mounting one of Tier 2's real widgets** — the DST inspector, the interval
  visualizer, the converter bench, a generic playground — rather than printing a code
  block. This un-parks `appendix-parked.md` §2 by explicit user decision, and it is
  cheap now in a way it was not when parked: Tier 2 already built every widget, so this
  is a typed registry plus tool declarations, not a widget-building project. Two
  appendix findings carry forward verbatim: **streamed tool-call arguments are partial
  JSON, invalid by definition** until the call completes, so never `JSON.parse` a raw
  chunk, and the parser must tolerate a malformed _terminal_ object, not only a
  truncated one; and **the registry is fixed and typed — never `eval`.**

## Parked

Audio and voice, and the full-bleed conversation-reactive 3D scene, remain researched
but deliberately unscheduled. They have no story IDs and no place in the sequence. See
[appendix-parked.md](appendix-parked.md) — read it before proposing either, since it
records findings (notably that `speechSynthesis` output cannot be captured by any
browser) that are expensive to re-derive. The generative-UI widget registry that used to
be parked here has been promoted to `DOX-C3b` above.
