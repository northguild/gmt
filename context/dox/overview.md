# EPIC — Dox: the documentation site for `@burglekitt/gmt`

> This directory follows the same progressive-disclosure structure as
> `context/roadmap/`. Start at [index.md](index.md). This file (overview.md) holds
> context, architecture, integration constraints, and the visual design language;
> [story-groups.md](story-groups.md) holds the A–E build summary; [tracker.md](tracker.md)
> holds the issue/status table; `issues/DOX-A.md`–`issues/DOX-E.md` hold full per-story
> GitHub-issue-ready specs; [appendix-parked.md](appendix-parked.md) holds researched
> work that is deliberately unscheduled.
>
> **Supersedes the 2026-08-12 "AI documentation chat" draft**, which specified a
> single-screen, routeless chat console with a full-bleed reactive 3D scene, a bespoke
> design system built before any product UI, and a two-tier voice synthesis stack.
> That plan was not a documentation site: it had no URLs, nothing indexable, nothing
> linkable, and shipped nothing usable until roughly story 7 of 15. Its genuinely useful
> parts are preserved here and in [appendix-parked.md](appendix-parked.md); its
> sequencing is not. Every package version and API claim below was re-verified against
> the npm registry and the repo on **2026-08-21**.

## 1. Context and the ordering principle

`@burglekitt/gmt` exposes roughly **424 public functions** — `plain` (187), `zoned` (98),
`unix` (67), `utc` (66), `duration` (6) — plus 20 exported consts (16 of them `regex`
patterns) and ~14 exported option types. Today the only discovery path is
`packages/gmt/README.md`, whose "API Surface" section just links to GitHub tree URLs.

A library this size with no site is undiscoverable. Someone searching for
`addBusinessDays` finds nothing; someone who wants to send a colleague the DST rules has
nothing to link.

**The ordering principle for this epic: ship the boring, useful thing first.**

Story Group A produces a real, deployed, searchable, linkable docs site. Groups B–E are
each additive on top of a site that already works — live examples, then the chatbot,
then the visual identity, then the globe. No group blocks the site from existing, and
any group after A can be dropped or reordered without losing the docs.

This is a direct reversal of the superseded plan, which gated everything on a bespoke
design system and a chat runtime.

### The raw material is exceptional and almost entirely un-mined

This is why a docs site here is a **generation** problem, not an authoring problem:

| Source | Scale | Value |
| --- | --- | --- |
| JSDoc `@example` tags | **1,514 lines** across 430 files | Rigid, machine-parseable `fn(args) // result` format |
| JSDoc coverage | **425 / 434** public impl files (97.9%) | Description + bullets + `@param` + `@returns` on nearly everything |
| `packages/gmt/README.md` | 1,071 lines | ~930 of them runnable, annotated examples in 6 topical sections |
| `packages/gmt/skills/` | 18 `SKILL.md`, ~3,700 lines | Already structured as Core Patterns + severity-graded Common Mistakes |
| `skills/_artifacts/` | `domain_map.yaml`, `skill_tree.yaml` | A ready-made information architecture |
| `docs/dst-disambiguation.md` | 139 lines | Excellent long-form conceptual guide, currently orphaned |
| `src/` directory tree | namespace → module → function | Already a correct nav taxonomy |

### Verified findings that shaped this plan

- **The `@example` format is non-standard, and this drives the tooling choice.** Every
  example is a single inline line — `@example fnName(args) // result (optional
  parenthetical explanation)` — never a fenced code block. TypeDoc and any TSDoc-spec
  tool treat `@example` content as a code block and would mangle the `// result`
  pairing 1,514 times. **This is the single reason a custom generator beats TypeDoc
  here**, and it is the first thing to get right in story DOX-A3.
- **There are zero `@category`, `@see`, `{@link}`, `@throws`, and `@since` tags** in
  `src/`. Taxonomy and cross-linking cannot come from tags; they must come from the
  directory tree, which is fortunately already correct.
- **`packages/gmt` emits per-file `.d.ts` with JSDoc preserved**, but
  `declarationMap: false` — so there are no declaration maps for "view source" links.
  Link to GitHub source paths instead, which the generator knows anyway.
- **Astro 7 raises the Node floor.** `astro@7.2.4` requires `node >=22.12.0`; the repo
  root declares `engines: >=20 <25`. `.nvmrc` is `24` and CI runs Node 22 and 24, so CI
  is unaffected — but `apps/docs` must declare its own `engines`.
- **`@astrojs/starlight@0.41.7` peers on `astro ^7.0.2`** — verified compatible with
  `astro@7.2.4`.
- **Octane is real but is off the critical path.** `octane@0.1.43` (MIT, by Dominic
  Gannaway / trueadm), with `@octanejs/three@0.1.36`, `@octanejs/drei@0.0.9`, and
  `@octanejs/markdown@0.0.9` — all republished 2026-08-21. 43 releases in roughly eight
  weeks, with the adapters this epic would have depended on still at `0.0.x`. It is a
  moving pre-1.0 target with no benefit for a documentation site, and the superseded
  plan's own story DOX-A2 contained a gate admitting the `.tsrx` toolchain might fight the
  repo's `nodenext` setup. **Nothing in Groups A–E depends on it.** Revisit only as an
  optional island if it matures.
- **The superseded plan's counts were stale.** It cited 349 functions and ~999
  examples; the real figures are ~424 and 1,514. Story DOX-A3 derives its counts from source
  and asserts them in CI rather than hardcoding a snapshot, because
  `context/roadmap/` is actively adding functions.
- **There is no `systemKnowledge` Gemini setting.** Grounding is achieved with
  `systemInstruction` + retrieved context + an explicit refusal instruction. This is
  more reliable than a config flag would be, and it is the only mechanism available.

---

## 2. Architecture

```text
apps/docs/                  Astro 7 + @astrojs/starlight 0.41 — a real multi-page site
  ├── astro.config.mjs
  ├── project.json                    explicit Nx targets (see §4.3)
  ├── scripts/build-reference.ts      TS compiler API → generated MDX + gmt-corpus.json
  └── src/
      ├── content.config.ts           docsLoader() + docsSchema()
      ├── content/docs/
      │   ├── index.mdx               landing page
      │   ├── guides/                 hand-curated (README, skills, DST doc)
      │   └── reference/              GENERATED, gitignored — one page per function
      ├── components/                 Playground island, chat panel
      └── styles/                     token layer, then the HUD theme

workers/dox-proxy/          Cloudflare Worker — holds GEMINI_API_KEY, streams SSE
```

**Data flow.** One build step, three consumers. `build-reference.ts` walks
`packages/gmt/src` with the TypeScript compiler API and emits:

- **(a)** one MDX page per exported function into the Starlight content collection;
- **(b)** `gmt-corpus.json` — the same content as retrieval chunks, each carrying the URL
  of the page it came from;
- **(c)** a **route manifest** — the set of every URL (a) produced.

The site is built from (a). The chatbot retrieves from (b) and cites URLs from (a). The
client validates every link the model emits against (c), so a hallucinated citation
renders as plain text rather than a 404 — see "Citation integrity" below.

That shared artifact is the load-bearing idea. The superseded plan built a corpus for a
model only; here the corpus and the site are the same extraction, which means they
cannot drift and the chatbot's citations are guaranteed to resolve.

Widgets run the **real** library — `apps/docs` depends on `@burglekitt/gmt` via
`workspace:*`, so a playground's output is never simulated and can never drift from
shipped behavior.

### Decisions taken

| Area | Choice |
| --- | --- |
| Framework | **Astro `7.2.4` + `@astrojs/starlight` `0.41.7`** — routes, MDX, islands, static output |
| Search | **Pagefind**, built into the Starlight build. Static index, zero infra |
| Reference | **Generated** from JSDoc via the TS compiler API. **Not TypeDoc** — see §1 |
| Page granularity | **One page per function**, as date-fns and Luxon do — exact-match search titles, and a stable URL for the chatbot to cite |
| Nav | Starlight `autogenerate: { directory: 'reference' }` over the generated tree |
| Octane | **Not used.** Off the critical path entirely |
| Model | Gemini 2.5 Flash — free tier, good SSE streaming |
| Key custody | Cloudflare Worker (free tier 100k req/day). Key never reaches the client |
| Grounding | Retrieval over `gmt-corpus.json` + `systemInstruction` + refusal instruction |
| Chat role | **Answer + cite + link** to real doc pages. Not a replacement for the site |
| Hosting | GitHub Pages, static, from GitHub Actions |
| 3D | Landing-page hero only — not a full-bleed backdrop |
| Audio | Parked. See [appendix-parked.md](appendix-parked.md) |

**Use `pnpm` for all install and registry commands.**

### Reviewed prior art — the Worktree CLI docs site

`example-sibling-repo-docs.md` in this directory documents how a sibling
`@burglekitt/worktree` repo built its docs site and AI chat. It is a working system, and
it was reviewed in full on 2026-08-21. It is **an example, not a target** — its own
warning notes it lacks a real textarea, multiline chat, and copyable code blocks, and it
does not meet this project's design or functional needs.

What was taken from it, and what was deliberately not:

| From the sibling repo | Verdict |
| --- | --- |
| **Generated route allowlist + client-side `resolveHref()`** — a hallucinated link degrades to plain text rather than a 404 | **Adopted, and it upgraded the plan.** See §2 "Citation integrity" below |
| Pure, side-effect-free, unit-tested SSE line parser returning a discriminated union | **Adopted** into DOX-C2. "Do this from day one" is correct |
| Generated-file stub aliased in the test config, so tests run on a clean checkout with no build | **Adopted** into DOX-A3/DOX-C2 — our generated output is gitignored, so we have exactly this problem |
| Explicit worker validation pipeline (method, message count, content length, role and model allowlists, mapped upstream errors) | **Adopted** into DOX-C2 as a checklist |
| Dual timeouts: overall request cap plus a shorter _idle_ timeout that resets per chunk | **Adopted** into DOX-C3 — catches stalled streams without killing long answers |
| Error-vs-warning classification, with warnings excluded from history sent upstream | **Adopted** into DOX-C3 |
| SKILL.md placed _before_ reference material so the model learns vocabulary first | **Adopted** into DOX-C2 |
| Generated version map so the site can never show a stale version | **Adopted** as a small DOX-A1 addition |
| **Nextra 4 + Next.js 16 App Router** | **Rejected.** Astro + Starlight was chosen deliberately; Starlight gives sidebar, search, and the a11y baseline without hand-maintained `_meta.ts` at every level |
| **"The AI has no retrieval layer"** — whole corpus baked into one system prompt | **Rejected, using their own arithmetic.** Their §5 measures one package at ~29 KB and four at 80–150 KB "which you pay for on **every** request," and puts real retrieval at "past ~500 KB of docs." We have 424 functions and 1,514 examples — well past that line. DOX-C1 measures it rather than assuming |
| Package-scoped prompt bundles | **Rejected as primary**, retained as DOX-C1's documented fallback if retrieval underperforms |
| Tailwind v4, React Query, TanStack Form for the chat client | **Rejected.** Weight without payoff for one streaming panel; DOX-A5's token layer already covers styling |
| Auto-linking **bold** phrases that match page titles | **Rejected.** Turning prose the model did not intend as a link into a link is a correctness risk, not a nicety |

The deepest idea worth restating, because it is the same principle DOX-A3 already runs on:
**generate, don't maintain — one source of truth, two consumers.**

### Citation integrity — a structural guarantee, not a test

The prior art changed this plan in one concrete way, and it is worth calling out.

The original DOX-C3 spec asserted "every citation must resolve" as a **test**. A test samples;
it cannot cover what a model emits at runtime. The sibling repo does better: it derives a
route allowlist from the same filesystem scan that produces the pages, ships it to the
client, and runs **every** href the model emits through a resolver. A link that is not in
the allowlist renders as plain text instead of a broken link.

That is a structural guarantee rather than a hope, and it costs almost nothing here
because DOX-A3 already knows every route it generated. **DOX-A3 therefore emits a third artifact:
a route manifest.** DOX-C3 consumes it defensively. The test stays, but it is no longer the
only thing standing between a reader and a 404.

---

## 3. Visual design language

This section is unchanged in substance from the superseded plan — it was the strongest
part of it — but it is **demoted from a day-one gate to a Story Group DOX-D input**. DOX-A5
ships the cheap 80% (palette, typography, tokens) with the site; DOX-D1–DOX-D2 apply the
expensive chrome over pages that already work.

**Nothing may look like a default HTML control.** No stock `border-radius` buttons, no
system-chrome scrollbars, no browser-default focus rings, no unstyled `textarea`. The
reference is a videogame HUD, not a web app.

### The core tension — read this before styling anything

Game HUDs are built to be **glanced at**. Docs are built to be **read**: long
explanations, code, tables, teaching content. Most "cyber UI" attempts die here — they
set body copy in a display face, put scanlines over paragraphs, and add glow to text,
and the result is unusable after two minutes.

The rule: **maximal chrome, disciplined content surface.**

- Frames, panels, borders, corners, HUD furniture, meters, motion → go hard.
- Body copy, code, tables, widget values → high contrast, generous line-height, no
  overlay texture, no glow, no letter-spacing tricks.

The aesthetic lives in the _housing_; the content stays legible inside it.

### Reference direction

Primary reference is **Destiny 2 crossed with Deus Ex: Mankind Divided** — Destiny for
information hierarchy that survives motion and holds up in dense text, Deus Ex for the
angular gold-on-black chamfered geometry. Secondary texture cues from Alien: Isolation
(CRT phosphor) and NieR:Automata (restraint, negative space).

Deliberately _not_ Cyberpunk 2077's maximal glitch — it is the obvious reference and the
worst fit for a reading surface.

### Color — cyber blue/green (story DOX-A5)

Cool blue→green ramp on a blue-tinted near-black. Everything is a token; no literals in
component styles. In Starlight these map onto its documented CSS custom properties via
the `customCss` config option.

| Role | Value | Use |
| --- | --- | --- |
| Void | `#03080C` | Page base |
| Glass tint | `rgba(6, 20, 26, 0.35)` | Panel fill over `backdrop-filter` (DOX-D1) |
| Cyan (primary) | `#22D3EE` | Borders, active state, primary accent |
| Spring (secondary) | `#4ADE80` | Success, live values, ticking data |
| Teal (deep) | `#0E7490` | Idle borders, dividers, inactive chrome |
| Ice (body) | `#CFEAF2` | **Long-form body copy** |
| Signal-lost | `#F5A524` | Sentinel returns — the one warm colour in the system |

**Body copy is Ice, not cyan or green.** Saturated blue-green text at paragraph length
is fatiguing and rarely clears contrast. The blue/green identity is carried by borders,
headings, labels, HUD furniture, and _live values_ — the numbers, timestamps, and
offsets, which are exactly the elements that should glow. This keeps the palette
unmistakably cyber while the prose stays readable.

Tie the semantic palette to **GMT's sentinel contract** — on-theme _and_ functional.
Invalid input returning `""` / `null` / `false` / `[]` renders as a distinct "signal
lost" state (amber, degraded, bracketed) rather than a blank field. A user seeing an
empty output box learns nothing; a user seeing `⟨ NO SIGNAL — invalid input ⟩` learns
the sentinel contract. Amber is reserved exclusively for this — its rarity is what makes
it communicate. This is the rule that makes story DOX-B1's playground _teach_ rather than
just execute.

Body text must clear **7:1**, measured against real rendered pages, not flat swatches.
Glow is decoration, never a contrast mechanism.

### Typography (story DOX-A5)

Two faces, strictly separated:

- **Display** (headings, labels, HUD furniture, buttons): a technical/wide face —
  Chakra Petch, Michroma, or Orbitron. Uppercase, wide tracking. Never below ~13px.
- **Body + code**: JetBrains Mono. Comfortable size, ~1.6 line-height, normal tracking.

Long-form teaching content is **never** set in the display face. All Google Fonts —
self-host the subsets, no external CDN request at runtime.

### Panel construction — real glass (story DOX-D1)

Surfaces are layered, never a single `div` with a border:

1. `backdrop-filter: blur(24px) saturate(1.4) brightness(0.45)` — the **`brightness`
   component is not optional**. Blur alone does not make text legible; darkening the
   backdrop is what creates a stable contrast floor. This is the single technique that
   makes glass work.
2. A very low-alpha tinted fill on top (`rgba(6, 20, 26, 0.35)`) — cools the glass and
   guarantees a contrast floor if `backdrop-filter` is unsupported or disabled.
3. Hairline 1px border, gradient along one or two edges only (not all four).
4. Inner top highlight — a 1px inset light line; the thing that reads as "machined".
5. Corner brackets via pseudo-elements — L-shaped, two opposing corners, not all four.
6. Optional static grain overlay (SVG `feTurbulence` data URI, **never animated**).

Under `prefers-reduced-transparency`, drop to a near-opaque fill and skip the blur.

### Animated borders (story DOX-D1)

The signature motion element. Three techniques, in order of preference:

- **Rotating conic gradient** — register an angle with `@property --angle` (Baseline
  since Firefox 128 completed support in 2024), animate it, and use it as a
  `conic-gradient` border via `background-origin: border-box` + `mask-composite:
  exclude`. GPU-friendly.
- **SVG stroke trace** — an inset `rect` with animated `stroke-dashoffset`. Best when
  corners are chamfered, since the path can follow the bevel exactly.
- **Edge-gradient shimmer** — a translating linear-gradient masked to the border, for
  idle/ambient breathing.

Rules: animate **only** the focused/active/streaming panel — every panel pulsing at once
reads as broken, not alive. Idle panels get a static border. All of it stops under
`prefers-reduced-motion`.

### Chamfered corners (story DOX-D1)

Use `corner-shape: bevel` + `border-radius` where supported — `box-shadow`, `outline`,
`overflow` and `backdrop-filter` all follow the corner shape, which is exactly what
`clip-path` breaks.

**`corner-shape` is experimental and not Baseline.** Ship it as progressive enhancement
via `@supports`, with a `clip-path: polygon(…)` fallback — and note that under the
fallback, `box-shadow` and `outline` are clipped, so focus states must come from an
inset ring or a pseudo-element instead.

### Controls — the one hard engineering rule (story DOX-D1)

**Restyle native elements. Never rebuild them from `div`s.**

Keep real `<textarea>`, `<button>`, `<input type="range">`, `<select>`, and neutralize
them with `appearance: none`. Rebuilding as `div`s loses IME composition (breaks all CJK
input), autofill, mobile keyboard behavior, form semantics, and screen reader support —
and every one of those is invisible during development on a US-English desktop.

Starlight ships a good accessible baseline. Group D is what puts it at risk; the job
there is to restyle without regressing it.

Specifics:

- Composer: real `<textarea>` + `field-sizing: content` (Baseline since 2026-06-16 —
  Chrome 123, Firefox 152, Safari 26.2) to auto-grow, with a scroll-height JS fallback.
- Blocky terminal caret via `caret-color`, plus a bracket/underscore motif.
- Scrollbars: `scrollbar-width` + `scrollbar-color` (Baseline), `::-webkit-scrollbar`
  for finer control.
- **Focus must be more visible than default, never less.** `:focus-visible` gets an
  animated bracket or inset ring. Removing the outline without replacing it is the
  single fastest way to make this unusable by keyboard.

### Motion (story DOX-D2)

Boot sequence on first paint. Typewriter reveal for chat replies. Glitch/RGB-split only
on state _transitions_, never idle, never over text being read. Scanline sweep confined
to panel chrome. Chromatic aberration and bloom belong in the WebGL layer (story DOX-E1),
not as CSS `text-shadow` on copy, which destroys readability.

All of it gated behind `prefers-reduced-motion`, `prefers-reduced-transparency`, and
`prefers-contrast`.

### Performance notes

The superseded plan's largest performance liability — glass panels over a
continuously-rendering full-bleed WebGL scene — **no longer exists**, because the globe
is scoped to the landing-page hero (story DOX-E1) and nothing needs to stay legible over it.
What remains:

- Cap blurred surfaces. Each `backdrop-filter` element re-samples what is behind it
  every frame. Avoid nested glass-within-glass.
- Never animate the grain overlay per-frame.
- Animate only the active panel's border — a performance rule as much as an aesthetic
  one.
- `will-change` only on elements actively animating, removed afterwards.
- Hydrate islands `client:visible`, never `client:load`. The playground pulls
  `@js-temporal/polyfill`, which is not small.

---

## 4. Workspace integration (do first — four files, easy to miss)

`apps/` does not exist and is not a workspace glob.

1. **`pnpm-workspace.yaml`** — add `- 'apps/*'`
2. **root `package.json`** — the `"workspaces"` array duplicates the glob; add `apps/*`
   there too
3. **`oxlint.config.js`** — note the **`.js` extension**; the superseded plan said
   `oxlint.config.ts`, which does not exist. `files.include` currently lists
   `packages/**`, `docs/**`, `context/**`, `scripts/**`; add `apps/**`. Also add
   `apps/docs/dist`, `apps/docs/.astro`, and the generated reference directory to
   `files.ignore` — generated MDX and `.astro` files should not be linted.
4. **`apps/docs/project.json`** — **required, unlike `packages/*`.** Nx infers
   `build`/`typecheck` from `@nx/js/typescript` keyed on the presence of
   `tsconfig.build.json`, which an Astro app will not have. Declare `build`, `dev`, and
   `typecheck` explicitly, with `dependsOn: ["^build"]` so `@burglekitt/gmt` is built
   before the docs site consumes it.

Two more constraints:

- **`apps/docs` must not extend `tsconfig.base.json`.** The base sets
  `composite: true`, `emitDeclarationOnly: true`, `module: nodenext`, and
  `customConditions: ["@burglekitt/source"]` — all wrong for an Astro app. Extend
  `astro/tsconfigs/strict` instead.
- **Import `@burglekitt/gmt` from its built `dist`, not from source.** The
  `@burglekitt/source` custom condition exists, but matching it would require
  configuring Vite's `resolve.conditions`; letting Nx build the package first is fewer
  moving parts. Deep-import per function (`@burglekitt/gmt/plain/...`, already exposed
  by the exports map) so islands tree-shake.

Node `>=22.12` (Astro 7's floor — declare it on `apps/docs`), pnpm `10.32.1`.

---

## 5. Work breakdown

13 stories across five Story Groups (A–E), following the same progressive-disclosure
pattern as `context/roadmap/`:

- [story-groups.md](story-groups.md) — narrative summary of each story
- [tracker.md](tracker.md) — issue/status table, build order
- `issues/DOX-A.md` … `issues/DOX-E.md` — full GitHub-issue-ready spec per story
- [appendix-parked.md](appendix-parked.md) — unscheduled work

| Group | Covers | Ships |
| --- | --- | --- |
| DOX-A | Skeleton, deploy, reference generator, guides, brand pass | **A working docs site** |
| DOX-B | Live `<Playground>` island, auto-embedded into every example | Interactivity |
| DOX-C | Retrieval index, Worker proxy, "Ask Dox" chat panel with citations | The chatbot |
| DOX-D | Glass/chrome, motion | The HUD identity |
| DOX-E | Landing-page hero globe | The flourish |

Each story is independently verifiable; do not start the next until the current one's
Definition of Done passes. **Group DOX-A must complete first**, and DOX-A1–DOX-A2 specifically
should land before anything else so every subsequent story is visible on a live site.

Unlike `context/roadmap/`, these stories do **not** publish to npm — `apps/docs` is
private. No changesets are needed unless a story also modifies `packages/gmt`.

---

## 6. Verification

- `pnpm nx run-many -t lint test typecheck build` stays green, **including the existing
  20-cell GMT timezone matrix** — Dox must not perturb `packages/gmt`.
- `pnpm nx run docs:build` produces a static site; `pnpm nx run docs:dev` serves it.
- **The generator spot-check (story DOX-A3, the highest-leverage test in the epic):**
  compare the generated page for `startOfZoned` against
  `packages/gmt/src/zoned/calculate/startOfZoned.ts` line by line. It has the heaviest
  JSDoc in the codebase — an options object, multi-clause bullets, and five annotated
  examples with parenthetical explanations after the `// result`. If that page is right,
  the generator is right; if it is wrong, it is wrong 424 times.
- Search `addBusinessDays` in the deployed Pagefind index and land on its page.
- The corpus-count Vitest test fails when a `gmt` function is added without
  re-extraction.
- **Keyboard-only pass with the mouse unplugged.** Starlight gives a good baseline;
  Group DOX-D is exactly what puts it at risk, so run this before and after DOX-D1.
- **Contrast audit against real rendered pages**, not flat swatches.
- Group C only, and the single most important behavioral test in the epic: a question
  with no corpus answer must be **refused, not improvised**. Separately, stub a response
  containing a plausible-but-nonexistent route and confirm it **renders as plain text**
  rather than a broken link — the route manifest makes this a property, not a hope.

## 7. Risks

- **Generator fidelity is the whole bet in Group A.** 424 pages are only as good as the
  parse. Mitigation: the TypeScript compiler API rather than regex, the `startOfZoned`
  byte-exact spot-check in DOX-A3's Definition of Done, and count assertions in CI.
- **The non-standard `@example` format** is the specific thing a naive implementation
  will get wrong, and it will get it wrong 1,514 times. Handle it first, against the
  hardest file, before generating anything at scale.
- **Namespace READMEs become redundant.** The six `src/*/README.md` files are flat
  function-name indexes with no signatures or examples; a generated site fully
  supersedes them. They ship in the npm tarball and `.agents/skills/update-readme`
  maintains them, so decide deliberately in DOX-A3 whether they stay as-is or become short
  stubs pointing at the site. Do not let them silently rot.
- **Group D can undo Group A.** The most likely failure mode in this epic remains a
  screenshot that looks incredible over a UI nobody can read for ten minutes. The
  sequencing is the mitigation: the site is good and live before the chrome lands, so
  D can be reverted without losing the docs. Judge it by reading a long reference page
  end to end, never by the screenshot.
- **`corner-shape` is not Baseline.** The chamfer is progressive enhancement; the
  `clip-path` fallback clips `box-shadow` and `outline`, so focus states must be
  verified in _both_ paths.
- **Corpus size vs. free tier (Group C).** 424 functions plus 1,514 examples is too
  large to inject wholesale on every request. This is why DOX-C1 is retrieval rather than
  full-corpus injection — measure the real token size in DOX-C1 before committing to any
  heavier approach. The sibling repo (see "Reviewed prior art") puts the bake-vs-retrieve
  threshold at ~500 KB of docs; we are plausibly past it, but DOX-C1 measures rather than
  assumes.
- **Corpus staleness (Group DOX-C).** If DOX-C1 chooses to bake the corpus into the Worker
  bundle, a docs-only change leaves the chatbot answering from stale content until the
  Worker is redeployed. The sibling repo calls this its single most important CI change,
  and it is the kind of failure that is invisible until someone notices the bot citing a
  page that changed. Whichever runtime location DOX-C1 picks, the CI consequence ships in
  the same story.
- **Astro/Starlight churn.** Both move quickly and Starlight peers on an exact-ish Astro
  major. Pin both, upgrade deliberately, and keep the generator emitting plain MDX so
  only the site shell is coupled to the framework.
