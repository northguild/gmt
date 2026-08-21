# Story Group Summaries

13 stories across five groups. **Each story ships something visible.** Group A produces
a real, deployed, searchable docs site; B–E are additive on top of a site that already
works. See [overview.md](overview.md) §1 for why the ordering is the point.

## Story Group A — Ship the site

The MVP. After A5, `@burglekitt/gmt` has a documentation site that anyone can search,
link, and read. Nothing in B–E is required for that to be true.

- **A1. Workspace skeleton + first pages** — Create `apps/docs` as `@gmt/docs` (private,
  `type: module`), depending on `@burglekitt/gmt` via `workspace:*`. Astro `7.2.4` +
  `@astrojs/starlight` `0.41.7`, with `src/content.config.ts` using Starlight's
  `docsLoader()` + `docsSchema()`. Ship a real landing page plus two hand-written pages
  (Install, Core Rules), both lifted from `packages/gmt/README.md`, so the site has real
  content from the first commit rather than placeholder text. Wire the four easy-to-miss
  integration files — see overview.md §4, and note `oxlint.config.js` is `.js`, not
  `.ts`, and that `apps/docs` needs an explicit `project.json` because Nx will not infer
  targets for it. **Gate:** `apps/docs` must not extend `tsconfig.base.json`; use
  `astro/tsconfigs/strict`.
- **A2. Deploy** — GitHub Actions → GitHub Pages, static build on push to `main`,
  matching `ci.yml`'s existing conventions (pnpm 10.32.1, Nx, Node matrix). Pagefind
  search comes free with the Starlight build. **Deliberately done second, before any
  bulk content**: every subsequent story is then immediately visible on a live URL, which
  is the fastest possible feedback loop and the thing the superseded plan most lacked.
- **A3. Reference generator** — The heart of the epic.
  `apps/docs/scripts/build-reference.ts` walks `packages/gmt/src/**/*.ts` with the
  **TypeScript compiler API** (not regex) and emits one MDX page per exported function
  into `src/content/docs/reference/<namespace>/<module>/`, plus a module index page per
  directory. The sidebar falls out for free via Starlight's
  `autogenerate: { directory: 'reference' }` — the `src/` tree is already a correct
  taxonomy. The same run emits two more artifacts — one extraction, three consumers:
  `gmt-corpus.json` (retrieval chunks, each carrying its page's URL, which Group C
  retrieves from) and a **route manifest** (every URL generated, which C3 uses to reject
  hallucinated links before they render). Generated MDX is gitignored and produced by a
  prebuild step, with a committed stub so tests run on a clean checkout. A Vitest test
  asserts function/example counts so corpus drift fails CI.
  **Critical finding:** the `@example` format here is a non-standard inline form —
  `@example fnName(args) // result (parenthetical)` — never a fenced block. This is
  precisely why TypeDoc is the wrong tool: it treats `@example` content as a code block
  and would mangle the call/result pairing 1,514 times. There are also zero `@category`,
  `@see`, and `{@link}` tags in `src/`, so nothing can be derived from tags. Get the
  example parser right first, against `startOfZoned.ts` (the heaviest JSDoc in the
  codebase), before generating anything at scale.
- **A4. Guides** — Hand-curated MDX under `src/content/docs/guides/`, ported from
  material that already exists rather than written from scratch: the ~930-line
  `packages/gmt/README.md` Quick Start split into topical guides (Plain arithmetic,
  Durations, Intervals, Zoned operations, Formatting), `docs/dst-disambiguation.md`
  moved in wholesale and finally given a home in the nav, and the 11 domain
  `packages/gmt/skills/*/SKILL.md` guides reshaped into task-oriented pages — their
  Core Patterns and severity-graded Common Mistakes sections map almost 1:1 onto guide
  structure. `packages/gmt/skills/_artifacts/domain_map.yaml` and `skill_tree.yaml` are
  a ready-made information architecture; use them for ordering rather than inventing one.
- **A5. Brand pass** — Palette, typography, and token layer only: the cheap 80% of
  identity. Starlight's `customCss` option plus its documented CSS custom properties —
  the cyber blue/green ramp on blue-tinted near-black, JetBrains Mono for body and code,
  a display face for headings, self-hosted subsets with no runtime CDN request. See
  overview.md §3's Color and Typography subsections, which are the spec for this story.
  Explicitly **not** glass, animated borders, or chamfer — those are Group D, applied
  later over pages that already work.

## Story Group B — Live examples

Interactivity that requires no API key, no server, and no model.

- **B1. `<Playground>` island** — An interactive component that runs the **real**
  `@burglekitt/gmt` in the browser: editable inputs, live output, never simulated.
  Because `apps/docs` depends on the package via `workspace:*`, output can never drift
  from shipped behavior. Sentinel-aware rendering is the point, not a detail: an
  invalid-input result (`""` / `null` / `false` / `[]`) renders as
  `⟨ NO SIGNAL — invalid input ⟩`, not a blank field. A blank box teaches nothing; the
  signal-lost state teaches GMT's sentinel contract. Hydrate `client:visible` and
  deep-import per function (`@burglekitt/gmt/plain/...`, already exposed by the exports
  map) so the island tree-shakes rather than pulling the whole surface plus
  `@js-temporal/polyfill` on every page.
- **B2. Auto-embed** — Extend A3's generator to mark up each `@example` so it renders as
  a runnable playground seeded with that example's own arguments. All 1,514 examples
  become interactive with zero per-page authoring. This is the payoff for having done
  A3 with a real parser: the call/result split it already produces is exactly the
  seed data B2 needs.

## Story Group C — Ask Dox (the chatbot)

Now that the site has real pages and real URLs, the chatbot's job is well-defined:
answer, and **cite pages the reader can open**. It augments the docs; it does not
replace them.

- **C1. Retrieval index** — Extend A3's `gmt-corpus.json` into retrieval chunks:
  function signature + description + examples + its page URL, with guides chunked by
  heading. Keyword/BM25 first — with 424 functions and a strong, consistent naming
  convention it will carry surprisingly far, and it needs no embedding model and no
  vector store. Bias retrieval toward the namespace of the page the reader is on.
  **Measure the real corpus token size here** before committing to anything heavier;
  this is the story where the superseded plan's "corpus size vs. free tier" risk becomes
  a number instead of a worry. It also settles a question the plan previously left open:
  **where the corpus lives at runtime** — baked into the Worker bundle (fast, but a
  docs-only change makes the bot stale until redeploy), fetched by the Worker from the
  static site (always fresh, one extra hop), or retrieved client-side (which would make
  the refusal guarantee unenforceable). Pick and record it.
- **C2. Worker proxy** — `workers/dox-proxy` with `wrangler.toml`; key via
  `wrangler secret put GEMINI_API_KEY`. CORS locked to the deployed Pages origin plus
  localhost, unbuffered SSE passthrough. `systemInstruction` is assembled in a specific
  order — persona and scope, then linking rules listing only the routes retrieved for
  this question, then `SKILL.md` vocabulary *before* reference material, then GMT's core
  rules, then the retrieved chunks, then an explicit refusal instruction. That last part
  is how grounding is actually achieved; there is no `systemKnowledge` setting. The
  story also carries a full edge-validation checklist (method, message count, content
  length, role and model allowlists, mapped upstream errors, rate limiting with its
  per-isolate caveat stated honestly) and two testability rules worth following from day
  one: keep SSE parsing pure, and put the clock behind a helper so rate limits can be
  tested with faked time.
- **C3. Chat panel** — A dismissible panel on the docs site, built from A5's tokens.
  Streaming answers with **citations linking to real reference and guide URLs**. Stop
  button, error state, rate-limit state, using the sentinel/signal-lost treatment rather
  than a generic error box. The important mechanism here is **link hardening**: every
  href the model emits is checked against A3's route manifest, and anything not in it
  renders as plain text rather than a broken link. That makes "citations resolve" a
  runtime property instead of a test we sample. Also carries the streaming details that
  are painful to retrofit — dual overall/idle timeouts, error-vs-warning classification,
  and a cleaned history snapshot.

## Story Group D — HUD identity

The expensive half of the aesthetic, applied as a CSS layer over pages that already
work. overview.md §3 is the spec for both stories.

- **D1. Chrome** — The six-layer glass panel construction (with the non-optional
  `brightness()` component in `backdrop-filter` — blur alone does not make text
  legible), animated borders via a rotating conic gradient registered with
  `@property --angle`, and the `corner-shape: bevel` / `clip-path` chamfer utility with
  a focus ring verified in **both** paths. Every native control restyled via
  `appearance: none`, **never rebuilt as `div`s** — rebuilding loses IME composition
  (breaking all CJK input), autofill, mobile keyboard behavior, form semantics, and
  screen reader support, none of which is visible while developing on a US-English
  desktop. Starlight ships a good accessible baseline; this story's real job is to
  restyle without regressing it. Gated behind `prefers-reduced-motion`,
  `prefers-reduced-transparency`, and `prefers-contrast` from the start.
- **D2. Motion** — Boot sequence on first paint, entry/exit via `@starting-style` +
  `transition-behavior: allow-discrete`, Popover API for tooltips, view transitions so
  elements morph rather than pop. Typewriter reveal for chat replies. Glitch/RGB-split
  only on state transitions — never idle, never over text being read. Only the
  active/focused panel animates; every panel pulsing at once reads as broken, not alive.

## Story Group E — Globe

- **E1. Landing-page hero** — A wireframe globe with meridians, as a `client:visible`
  React Three Fiber island **on the homepage only**. Scoping it to a hero rather than a
  full-bleed backdrop is what removes the superseded plan's single largest performance
  liability: nothing has to stay legible over it, so there is no glass-over-live-WebGL
  budget to meet. It is also trivially removable if it does not earn its weight.

## Parked

Audio and voice, the generative-UI widget registry, and the full-bleed conversation-
reactive 3D scene are researched but deliberately unscheduled. They have no story IDs
and no place in the sequence. See [appendix-parked.md](appendix-parked.md) — read it
before proposing any of them, since it records findings (notably that `speechSynthesis`
output cannot be captured by any browser) that are expensive to re-derive.
