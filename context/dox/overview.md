# EPIC — Dox: the documentation site for `@northguild/gmt`

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
> sequencing is not.
>
> **Re-audited against the repo and the npm registry on 2026-08-26.** Every count in the
> 2026-08-21 draft had gone stale, one risk was pointed at the wrong thing, and the
> ambition ceiling was set below what this site is meant to be. The MVP got smaller and
> the ceiling got much higher. See §1's "What the 2026-08-26 audit changed".

## 1. Context and the ordering principle

`@northguild/gmt` exposes **504 public functions** — `plain` (223), `zoned` (119),
`unix` (75), `utc` (75), `duration` (12) — plus 22 exported `regex` consts and **42
public types** (18 in `src/types/`, 24 co-located with the functions that take them).
Today the only discovery path is `packages/gmt/README.md`, whose "API Surface" section
just links to GitHub tree URLs.

A library this size with no site is undiscoverable. Someone searching for
`addBusinessDays` finds nothing; someone who wants to send a colleague the DST rules has
nothing to link.

**The ordering principle for this epic: ship the boring, useful thing first.**

**Tier 0 — three stories — produces a real, deployed, searchable, linkable docs site.**
Everything after it is additive on top of a site that already works. No tier blocks the
site from existing, and any tier after Tier 0 can be dropped or reordered without losing
the docs.

This is a direct reversal of the superseded plan, which gated everything on a bespoke
design system and a chat runtime.

**But the ordering principle is not a ceiling.** Tier 0 is deliberately small so that the
ambition above it can be large: an interactive globe, a live widget on every one of the
1,860 examples, a mentor-voiced scenario layer, and a chat that answers by mounting real
widgets rather than printing code blocks. The goal is to beat every competing date-library
documentation site, and §5's tier table is sequenced so that goal is reachable
incrementally rather than all at once.

### The raw material is exceptional and almost entirely un-mined

This is why a docs site here is a **generation** problem, not an authoring problem:

| Source                       | Scale                                         | Value                                                                       |
| ---------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| JSDoc `@example` tags        | **1,860 lines** across 516 impl files         | Rigid, machine-parseable `fn(args) // result` format                        |
| JSDoc coverage               | **498 / 516** public impl files (96.5%)       | Description + bullets + `@param` + `@returns` on nearly everything          |
| `packages/gmt/README.md`     | 1,633 lines                                   | Most of them runnable, annotated examples in 6 topical sections             |
| `packages/gmt/skills/`       | 18 `SKILL.md`, **4,689 lines**                | Core Patterns + **63 severity-graded Common Mistakes**                      |
| `skills/_artifacts/`         | `domain_map.yaml`, `skill_tree.yaml`          | A ready-made information architecture, reviewed 2026-08-23                  |
| `docs/dst-disambiguation.md` | 139 lines                                     | Excellent long-form conceptual guide, currently orphaned                    |
| `src/` directory tree        | namespace → module → function                 | Already a correct nav taxonomy                                              |
| **Interval functions**       | **109** — plain 53, zoned 19, unix 19, utc 18 | Allen's interval algebra, fully implemented and **entirely un-illustrated** |

Two entries in that table are load-bearing for the ambition tier and are easy to skim
past:

- **The 63 severity-graded mistakes** (1 CRITICAL, 23 HIGH, 39 MEDIUM) across 11 domain
  `SKILL.md` files are already written as wrong-vs-right code pairs. The mentor/scenario
  layer (Tier 5) is therefore **not a writing project** — roughly 60% of it exists in
  exactly the shape a scenario page needs. The work is porting it and adding live proof.
- **The 109 interval functions** are the largest completely undocumented-by-example
  surface in the library. A dragged-timeline visualizer over them (Tier 2) is a thing no
  competing date library's docs site has.

### Verified findings that shaped this plan

- **The `@example` format is non-standard, but it is not the generator's risk — the
  missing tag graph is.** Every example is a single inline line —
  `@example fnName(args) // result (optional parenthetical explanation)` — never a fenced
  code block, so TypeDoc and any TSDoc-spec tool would mangle the call/result pairing.
  That still rules TypeDoc out. What it does **not** do is make the parser hard: measured
  across all 1,860 examples on 2026-08-26, **1,859 match that one shape exactly, zero
  contain a second `//`, and exactly one is multi-line** (`getDstTransitions`, whose
  array result continues on following `* //` lines). The parser is roughly fifteen lines
  and one edge case. See "The real generator risk" below for where DOX-A3a's attention
  actually belongs.
- **There are zero `@category`, `@see`, `@throws`, and `@since` tags** in `src/`, and only
  9 `@link` occurrences. **There is effectively no cross-link graph in the source at all.**
  Taxonomy and cross-linking cannot come from tags; they must be synthesized from the
  directory tree (which is fortunately already correct) and from the type references in
  each signature.
- **The exports map forbids per-function imports, and namespace imports drag the
  polyfill.** `packages/gmt/package.json` sets `"./plain/*/*": null` (and the same for
  `zoned`/`unix`/`utc`), so the maximum import granularity is the **module** barrel,
  `@northguild/gmt/plain/calculate`. Separately, `src/index.ts`, `src/plain/index.ts` and
  `src/zoned/index.ts` each open with `export * from "@js-temporal/polyfill"`, so a
  **namespace**-level import (`@northguild/gmt/plain`) pulls the entire polyfill — 2.98 MB
  unpacked. Module barrels do not. **The rule for every island in Tiers 2–6: import at
  module granularity, never namespace granularity.** This corrects a "deep-import per
  function" instruction that appeared in the 2026-08-21 draft and cannot work.
- **`packages/gmt` emits per-file `.d.ts` with JSDoc preserved**, but
  `packages/gmt/tsconfig.build.json` sets `declarationMap: false` — so there are no
  declaration maps for "view source" links. Link to GitHub source paths instead, which the
  generator knows anyway.
- **Astro 7 raises the Node floor.** `astro@7.2.7` requires `node >=22.12.0`; the repo
  root declares `engines: >=20 <25`. `.nvmrc` is `24` and CI runs Node 22 and 24, so CI is
  unaffected — but `apps/dox` must declare its own `engines`, and **a local shell may
  well be on Node 20**, which is the first wall DOX-A1 hits. `nvm use` before starting.
- **`@astrojs/starlight@0.41.9` peers on `astro ^7.0.2` _and_
  `@astrojs/markdown-remark ^7.2.0`** — the second peer is easy to miss. Verified
  compatible with `astro@7.2.7`.
- **GitHub Pages is not enabled on this repo** — `gh api repos/northguild/gmt/pages`
  returns 404 as of 2026-08-26. This is moot under the Cloudflare hosting decision (§2),
  but it is why that decision costs nothing to take now: there was no existing Pages setup
  to migrate away from.
- **Octane is real but is off the critical path.** `octane@0.1.43` (MIT, by Dominic
  Gannaway / trueadm), with `@octanejs/three@0.1.36`, `@octanejs/drei@0.0.9`, and
  `@octanejs/markdown@0.0.9` — all republished 2026-08-21. 43 releases in roughly eight
  weeks, with the adapters this epic would have depended on still at `0.0.x`. It is a
  moving pre-1.0 target with no benefit for a documentation site, and the superseded
  plan's own story DOX-A2 contained a gate admitting the `.tsrx` toolchain might fight the
  repo's `nodenext` setup. **Nothing in any tier depends on it.** Revisit only as an
  optional island if it matures.
- **Counts drift, so derive them.** The superseded plan cited 349 functions and ~999
  examples; the 2026-08-21 draft cited 424 and 1,514; the real figures on 2026-08-26 are
  **504 and 1,860**. Note that `context/roadmap/` is now **complete** — all 54 stories Done
  through E7 at v1.14.0 — so the churn no longer comes from in-flight roadmap work. It
  comes from ordinary npm releases, which continue. DOX-A3a therefore still derives its
  counts from source and asserts them in CI rather than hardcoding a snapshot.
- **There is no `systemKnowledge` Gemini setting.** Grounding is achieved with
  `systemInstruction` + retrieved context + an explicit refusal instruction. This is
  more reliable than a config flag would be, and it is the only mechanism available.

### The real generator risk

Stated separately because the 2026-08-21 draft pointed this at the `@example` parser and
that is the wrong target. What will actually be hard in DOX-A3a:

- **Options objects.** `startOfZoned`'s `@param options` is a single ~400-character prose
  line describing four option keys, with embedded bold and backticks. Turning that into a
  real parameter table, with each option's type linked to its own page, is the
  high-value work — and there are 504 functions of it.
- **42 public types need pages of their own**, or every one of those 504 signatures
  renders as a wall of dead identifiers.
- **No "see also" exists to extract.** With the tag graph empty, every cross-link must be
  synthesized. This is the generator's real design problem, not its parsing problem.
- **`plain/calculate/weekOfYear.ts` exports two functions** — the only file in the library
  that does, so "one page per file" holds 503 times out of 504. Handle it deliberately
  rather than discovering it as a missing page.

### What the 2026-08-26 audit changed

Recorded so these are not re-litigated:

| Change                            | Why                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| All counts refreshed              | 424 → 504 functions, 1,514 → 1,860 examples, ~14 → 42 types                                          |
| Generator risk re-aimed           | `@example` parsing is trivial; signatures, options and the absent tag graph are not                  |
| `DOX-B1`'s import rule corrected  | The exports map forbids the per-function imports the draft specified                                 |
| Hosting → Cloudflare              | Removes CORS, a second pipeline, and DOX-C1's corpus-location question                               |
| MVP shrunk to three stories       | Guides and brand are additive on a working site — the plan's own principle, applied one level deeper |
| Globe promoted to flagship        | User decision. It is a product feature now, not decoration                                           |
| Chat escalated to widget-emitting | User decision. It un-parks `appendix-parked.md` §2                                                   |
| Scenario layer added              | User decision. 60% of the content already exists in `skills/`                                        |

---

## 2. Architecture

```text
apps/dox/                  Astro 7 + @astrojs/starlight 0.41 — a real multi-page site
  ├── astro.config.mjs
  ├── project.json                    explicit Nx targets (see §4.3)
  ├── wrangler.jsonc                  assets binding → dist/; /api/* once C exists
  ├── scripts/build-reference.ts      TS compiler API → generated MDX + corpus + manifest
  ├── worker/                         same deployment — holds the model API key (Tier 6)
  └── src/
      ├── content.config.ts           docsLoader() + docsSchema()
      ├── content/docs/
      │   ├── index.mdx               landing page (globe hero, Tier 4)
      │   ├── guides/                 hand-curated (README, skills, DST doc)
      │   ├── scenarios/              mentor layer — real-world tasks (Tier 5)
      │   └── reference/              GENERATED, gitignored — one page per function
      ├── components/                 Playground + purpose-built widgets, chat panel
      └── styles/                     token layer, then the HUD theme
```

**One deployment, not two.** A single Cloudflare Worker serves the built site through an
`assets` binding and — once Tier 6 exists — handles `/api/*` in the same isolate. Through
Tier 5 the Worker has no `main` at all: it is assets-only, with
`not_found_handling: "404-page"`. See "Hosting" below for why this matters more than it
looks.

**Data flow.** One build step, four consumers. `build-reference.ts` walks
`packages/gmt/src` with the TypeScript compiler API and emits:

- **(a)** one MDX page per exported function into the Starlight content collection;
- **(b)** `gmt-corpus.json` — the same content as retrieval chunks, each carrying the URL
  of the page it came from;
- **(c)** a **route manifest** — the set of every URL (a) produced;
- **(d)** the seed data for widgets — the parsed `{ call, result, note }` triple behind
  every one of the 1,860 examples.

The site is built from (a). `llms-full.txt` is built from (b), and so is retrieval if
Tier 6 lands. Every link is validated against (c) — at build time as a link check, and at
runtime against anything a model emits, so a hallucinated citation renders as plain text
rather than a 404 (see "Citation integrity" below). Tier 2's auto-embedded playgrounds are
seeded from (d).

That shared artifact is the load-bearing idea. The superseded plan built a corpus for a
model only; here the corpus, the site, the AI surface and the widget seeds are all the
same extraction, which means they cannot drift.

Widgets run the **real** library — `apps/dox` depends on `@northguild/gmt` via
`workspace:*`, so a playground's output is never simulated and can never drift from
shipped behavior.

### Decisions taken

| Area               | Choice                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Framework          | **Astro `7.2.7` + `@astrojs/starlight` `0.41.9`** — routes, MDX, islands, static output                                 |
| Search             | **Pagefind**, built into the Starlight build. Static index, zero infra                                                  |
| Reference          | **Generated** from JSDoc via the TS compiler API. **Not TypeDoc** — see §1                                              |
| Page granularity   | **One page per function**, as date-fns and Luxon do — exact-match search titles, and a stable URL to cite               |
| Nav                | Starlight `autogenerate: { directory: 'reference' }` over the generated tree                                            |
| Import granularity | **Module barrels only** (`@northguild/gmt/plain/calculate`). Never namespace — see §1                                   |
| Octane             | **Not used.** Off the critical path entirely                                                                            |
| **Hosting**        | **Cloudflare Workers static assets.** One deployment serves the site and `/api/*`                                       |
| **AI surface**     | **`llms.txt` + `llms-full.txt` + per-page raw `.md`** (DOX-A3b), emitted from the same corpus                           |
| **Scenario layer** | **Real-world task pages** with live proof of failure (DOX-A4b–d), from the 63 graded `SKILL.md` mistakes                |
| **Widgets**        | **Live on every example**, plus purpose-built DST / interval / converter inspectors. State encodes to the URL           |
| **3D**             | **Interactive globe** — click a zone, read live time, offset and DST state. A product feature, not decoration           |
| Model              | Gemini 2.5 Flash was the 2026-08-21 choice. **Re-open in DOX-C1** — widgets mean tool calls, which changes the calculus |
| Key custody        | Same-origin Worker. Key never reaches the client                                                                        |
| Grounding          | Retrieval over `gmt-corpus.json` + `systemInstruction` + refusal instruction                                            |
| **Chat role**      | **Answer + cite + _mount a real widget_.** Augments the site; never replaces it                                         |
| Audio              | Parked. See [appendix-parked.md](appendix-parked.md)                                                                    |

### Hosting — why one origin, not two

The 2026-08-21 draft put the site on GitHub Pages and the chat on a separate Cloudflare
Worker. That split buys, for nothing: an explicit CORS allowlist, a `Vary: Origin` header,
two deploy pipelines, an origin-mismatch failure mode, and DOX-C1's open question of where
the corpus lives at runtime.

A single Worker with an `assets` binding removes all of it. `/api/chat` is same-origin, so
there is no CORS at all; there is one pipeline; and the Worker can fetch the corpus from
the very site it is serving, which resolves DOX-C1's option (b) with no extra hop and no
staleness coupling.

Verified 2026-08-26: **GitHub Pages was never enabled on this repo** (`gh api
repos/northguild/gmt/pages` → 404), so there is nothing to migrate away from. A Cloudflare
account is now a hard dependency for _deployment_, not merely for chat — that is the one
real cost of this decision and it is recorded in §7.

**Use `pnpm` for all install and registry commands.**

### Reviewed prior art — the Worktree CLI docs site

`example-sibling-repo-docs.md` in this directory documents how a sibling
`@northguild/worktree` repo built its docs site and AI chat. It is a working system, and
it was reviewed in full on 2026-08-21. It is **an example, not a target** — its own
warning notes it lacks a real textarea, multiline chat, and copyable code blocks, and it
does not meet this project's design or functional needs.

What was taken from it, and what was deliberately not:

| From the sibling repo                                                                                                          | Verdict                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Generated route allowlist + client-side `resolveHref()`** — a hallucinated link degrades to plain text rather than a 404     | **Adopted, and it upgraded the plan.** See §2 "Citation integrity" below                                                                                                                                                                                                                                     |
| Pure, side-effect-free, unit-tested SSE line parser returning a discriminated union                                            | **Adopted** into DOX-C2. "Do this from day one" is correct                                                                                                                                                                                                                                                   |
| Generated-file stub aliased in the test config, so tests run on a clean checkout with no build                                 | **Adopted** into DOX-A3a/DOX-C2 — our generated output is gitignored, so we have exactly this problem                                                                                                                                                                                                        |
| Explicit worker validation pipeline (method, message count, content length, role and model allowlists, mapped upstream errors) | **Adopted** into DOX-C2 as a checklist                                                                                                                                                                                                                                                                       |
| Dual timeouts: overall request cap plus a shorter _idle_ timeout that resets per chunk                                         | **Adopted** into DOX-C3a — catches stalled streams without killing long answers                                                                                                                                                                                                                              |
| Error-vs-warning classification, with warnings excluded from history sent upstream                                             | **Adopted** into DOX-C3a                                                                                                                                                                                                                                                                                     |
| SKILL.md placed _before_ reference material so the model learns vocabulary first                                               | **Adopted** into DOX-C2                                                                                                                                                                                                                                                                                      |
| Generated version map so the site can never show a stale version                                                               | **Adopted** as a small DOX-A1 addition                                                                                                                                                                                                                                                                       |
| **Nextra 4 + Next.js 16 App Router**                                                                                           | **Rejected.** Astro + Starlight was chosen deliberately; Starlight gives sidebar, search, and the a11y baseline without hand-maintained `_meta.ts` at every level                                                                                                                                            |
| **"The AI has no retrieval layer"** — whole corpus baked into one system prompt                                                | **Rejected, using their own arithmetic.** Their §5 measures one package at ~29 KB and four at 80–150 KB "which you pay for on **every** request," and puts real retrieval at "past ~500 KB of docs." We have 504 functions and 1,860 examples — well past that line. DOX-C1 measures it rather than assuming |
| Package-scoped prompt bundles                                                                                                  | **Rejected as primary**, retained as DOX-C1's documented fallback if retrieval underperforms                                                                                                                                                                                                                 |
| Tailwind v4, React Query, TanStack Form for the chat client                                                                    | **Rejected.** Weight without payoff for one streaming panel; DOX-A5's token layer already covers styling                                                                                                                                                                                                     |
| **Site and chat on separate origins** (their Pages + Worker split)                                                             | **Rejected.** We serve both from one Cloudflare Worker, which removes CORS, the second pipeline, and DOX-C1's corpus-location question outright — see "Hosting" above                                                                                                                                        |
| Auto-linking **bold** phrases that match page titles                                                                           | **Rejected.** Turning prose the model did not intend as a link into a link is a correctness risk, not a nicety                                                                                                                                                                                               |

The deepest idea worth restating, because it is the same principle DOX-A3a already runs on:
**generate, don't maintain — one source of truth, now four consumers** (pages, AI surface,
widget seeds, retrieval).

### Citation integrity — a structural guarantee, not a test

The prior art changed this plan in one concrete way, and it is worth calling out.

The original DOX-C3 spec asserted "every citation must resolve" as a **test**. A test samples;
it cannot cover what a model emits at runtime. The sibling repo does better: it derives a
route allowlist from the same filesystem scan that produces the pages, ships it to the
client, and runs **every** href the model emits through a resolver. A link that is not in
the allowlist renders as plain text instead of a broken link.

That is a structural guarantee rather than a hope, and it costs almost nothing here
because DOX-A3a already knows every route it generated. **DOX-A3a therefore emits a route
manifest as a third artifact.** The test stays, but it is no longer the only thing standing
between a reader and a 404.

**The manifest now has three consumers, not one**, which is why it earns its place in
Tier 0 even though the chat is in Tier 6:

- **DOX-A3a itself** — a build-time link check asserting the manifest exactly equals the set
  of pages generated. A manifest that has drifted from reality is worse than no manifest:
  it would silently suppress valid links and admit dead ones.
- **DOX-A3b** — `llms.txt` and every per-page raw `.md` route are emitted from the same URL
  set, so the AI surface cannot point at a page that does not exist.
- **DOX-C3a** — runtime hardening of anything a model emits, as originally specified.

Note the ordering consequence: because the manifest ships in Tier 0, none of the later
tiers has to reconstruct it, and Tier 6 can be dropped entirely without losing it.

---

## 3. Visual design language

This section is unchanged in substance from the superseded plan — it was the strongest
part of it — but it is **demoted from a day-one gate to a Tier 3 input**. DOX-A5, in Tier 1,
ships the cheap 80% (palette, typography, tokens) as soon as there is real content to
style; DOX-D1–DOX-D2, in Tier 3, apply the expensive chrome over pages — and, by then,
widgets — that already work.

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

| Role               | Value                   | Use                                                  |
| ------------------ | ----------------------- | ---------------------------------------------------- |
| Void               | `#03080C`               | Page base                                            |
| Glass tint         | `rgba(6, 20, 26, 0.35)` | Panel fill over `backdrop-filter` (DOX-D1)           |
| Cyan (primary)     | `#22D3EE`               | Borders, active state, primary accent                |
| Spring (secondary) | `#4ADE80`               | Success, live values, ticking data                   |
| Teal (deep)        | `#0E7490`               | Idle borders, dividers, inactive chrome              |
| Ice (body)         | `#CFEAF2`               | **Long-form body copy**                              |
| Signal-lost        | `#F5A524`               | Sentinel returns — the one warm colour in the system |

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
it communicate. This is the rule that makes story DOX-B1a's playground _teach_ rather than
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

### Widget chrome (Tiers 2–5)

The 2026-08-21 draft's §3 covered panels, borders, controls and motion — everything a
chat console needs. It did not cover the surfaces this plan now builds on top of them:
timelines, scrubbers, draggable interval bars, and a globe. They obey the same split, but
the line between _housing_ and _content_ falls in a less obvious place.

**In a data widget, the plotted values are content, not chrome.** A dragged interval bar,
a DST transition marker, a clock face reading — these are the thing being read. They get
the same discipline as body copy: high contrast, no overlay texture, no glow that carries
meaning. The axis, the frame, the grid, the handles and the labels are housing and can go
as hard as any panel.

- **Live values glow; static values do not.** §3's Color section already reserves the
  blue/green identity for _live_ values — ticking clocks, offsets, computed results. That
  rule is what keeps a widget legible: the reader's eye is drawn to what changed. If every
  number glows, nothing does.
- **Sentinel treatment is mandatory in every widget, not just DOX-B1a's playground.** An
  interval function returning `[]`, a converter returning `""`, a zone lookup returning
  `false` — each renders as the signal-lost state. This is the rule that makes the widgets
  _teach_ rather than merely execute, and it must not be dropped as widgets multiply.
- **Distinguish the sentinel from a legitimately empty result.** `intervalIntersectionZoned`
  returning `[]` for two intervals that genuinely do not overlap is a _correct answer_, not
  invalid input. Rendering it as `⟨ NO SIGNAL ⟩` would teach the wrong lesson outright.
  Where the two are ambiguous, the widget must say which it is.
- **Never animate a value the reader is trying to read.** Transitions between states are
  fine; a value that is still settling while being read is not. This is the widget
  equivalent of §3's "never glitch over text being read."
- **Drag is never the only affordance.** Every draggable handle needs a keyboard path and a
  typed-input equivalent — see §7's accessibility risk. A timeline that can only be
  operated by dragging is unusable by a meaningful fraction of readers and is invisible as
  a problem during development.

### Motion (story DOX-D2)

Boot sequence on first paint. Glitch/RGB-split only on state _transitions_, never idle,
never over text being read. Scanline sweep confined to panel chrome. Chromatic aberration
and bloom belong in the WebGL layer (story DOX-E1a), not as CSS `text-shadow` on copy,
which destroys readability.

**Typewriter reveal for chat replies is a Tier 6 item, not a Tier 3 one.** DOX-D2 lands
before the chat exists in this sequence (Tier 3 vs Tier 6), so it ships the general
mechanism — a debounced, interruptible reveal primitive — and DOX-C3a wires it to streaming
replies when that tier is reached. DOX-D2 must not block on Tier 6 to close.

All of it gated behind `prefers-reduced-motion`, `prefers-reduced-transparency`, and
`prefers-contrast`.

### Performance notes

The superseded plan's largest performance liability was glass panels over a
continuously-rendering full-bleed WebGL scene, reacting to conversation state. That
specific failure mode is avoided here for a different reason than in the 2026-08-21 draft:
the globe is interactive (Tier 4, story DOX-E1a) but still lives on the landing page, not
behind every glass panel, so nothing in Tier 3's chrome has to stay legible over live
WebGL. Promoting the globe from decoration to a real feature did not reintroduce that
budget — it is still one canvas on one page. What remains:

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

`apps/` does not exist and is not a workspace glob. Confirmed unchanged on 2026-08-26.

1. **`pnpm-workspace.yaml`** — add `- 'apps/*'`
2. **root `package.json`** — the `"workspaces"` array duplicates the glob; add `apps/*`
   there too
3. **`oxlint.config.js`** — note the **`.js` extension**; the superseded plan said
   `oxlint.config.ts`, which does not exist. `files.include` currently lists
   `packages/**`, `docs/**`, `context/**`, `scripts/**`; add `apps/**`. Also add
   `apps/dox/dist`, `apps/dox/.astro`, and the generated reference directory to
   `files.ignore` — generated MDX and `.astro` files should not be linted.
4. **`apps/dox/project.json`** — **required, unlike `packages/*`.** Nx infers
   `build`/`typecheck` from `@nx/js/typescript` keyed on the presence of
   `tsconfig.build.json`, which an Astro app will not have. Declare `build`, `dev`, and
   `typecheck` explicitly, with `dependsOn: ["^build"]` so `@northguild/gmt` is built
   before the docs site consumes it.

Two more constraints:

- **`apps/dox` must not extend `tsconfig.base.json`.** The base sets
  `composite: true`, `emitDeclarationOnly: true`, `module: nodenext`, and
  `customConditions: ["@northguild/source"]` — all wrong for an Astro app. Extend
  `astro/tsconfigs/strict` instead.
- **Import `@northguild/gmt` from its built `dist`, not from source.** The
  `@northguild/source` custom condition exists, but matching it would require
  configuring Vite's `resolve.conditions`; letting Nx build the package first is fewer
  moving parts. **Import at module granularity** (`@northguild/gmt/plain/calculate`),
  **never at namespace granularity** (`@northguild/gmt/plain`) and never per-function —
  see §1: the exports map sets `"./plain/*/*": null`, and the namespace barrels re-export
  the 2.98 MB polyfill.

Node `>=22.12` (Astro 7's floor — declare it on `apps/dox`), pnpm `10.32.1`. **Check the
local shell before starting `DOX-A1`** — `.nvmrc` is `24`, but a shell can easily be on an
older Node that predates Astro 7's floor; `nvm use` first.

**CI classification note.** `.github/workflows/ci.yml`'s `determine-affected` job
classifies changes by grepping `^packages/gmt/`. Anything under `apps/**` lands in
`non_gmt_changed` and runs the `tests` job, not the `gmt-matrix` job — confirm that is the
intended routing for `apps/dox` changes in `DOX-A1` rather than leaving it accidental.

---

## 5. Work breakdown

**23 units of work across 7 tiers, mapped onto the original 13 GitHub issues — no new
issues are created.** New work enters as a lettered sub-story on the issue it naturally
belongs to (`DOX-A3a`/`DOX-A3b`, `DOX-B2a`–`DOX-B2d`, …), the same pattern
`context/roadmap/` already used for `J0a`/`J0b`. Sub-story IDs are for planning
legibility only; GitHub still tracks work at the issue level.

- [story-groups.md](story-groups.md) — narrative summary of each story
- [tracker.md](tracker.md) — issue/status table, build order, 23 rows over 13 issues
- `issues/DOX-A.md` … `issues/DOX-E.md` — full GitHub-issue-ready spec per story
- [appendix-parked.md](appendix-parked.md) — unscheduled work

| Tier | Covers                                                                                                                  | Ships                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 0    | `DOX-A1`, `DOX-A2`, `DOX-A3a` — skeleton, Cloudflare deploy, reference generator                                        | **The MVP: a live, searchable docs site**            |
| 1    | `DOX-A5` tokens, `DOX-A4a` guides, `DOX-A3b` `llms.txt`/raw markdown                                                    | Substance, and an AI-readable surface                |
| 2    | `DOX-B1a`/`b` playground + permalinks, `DOX-B2a`–`d` auto-embed + DST inspector + interval visualizer + converter bench | **The widget platform** — every example runnable     |
| 3    | `DOX-D1`, `DOX-D2` — glass, borders, chamfer, motion                                                                    | The HUD identity                                     |
| 4    | `DOX-E1a`/`b` — interactive globe, multi-zone scrubber                                                                  | **The flagship** — a product feature, not a flourish |
| 5    | `DOX-A4b`–`d` — scenario template, ported pitfalls, mentor index                                                        | The real-world teaching layer                        |
| 6    | `DOX-C1`–`DOX-C3a`/`b` — retrieval, Worker, chat panel, widget registry                                                 | **The chat that mounts widgets**                     |

**Tier 0 is order-locked and is the only hard sequencing constraint.** `DOX-A1` → `DOX-A2`
→ `DOX-A3a` must land in that order so every later tier is visible on a live site. **Tier 1
onward may be reordered**, and **Tier 5 (scenarios) may run in parallel with Tiers 2–4**
once `DOX-B1a` exists, since its content-writing skill profile does not compete with the
component work in Tiers 2–4. Each story is independently verifiable; do not start the next
sub-story on an issue until the current one's Definition of Done passes.

**Four issues now span more than one tier** as a direct consequence of folding 23 units of
work into 13 issues: `#132` (`DOX-A3`, Tier 0 + 1), `#133` (`DOX-A4`, Tier 1 + 5), `#135`
and `#136` (`DOX-B1`/`DOX-B2`, both Tier 2 but `DOX-B1b` lands after `DOX-B2a`–`d`). **An
issue closes when its last sub-story lands, not its first** — see `tracker.md`.

Unlike `context/roadmap/`, these stories do **not** publish to npm — `apps/dox` is
private. No changesets are needed unless a story also modifies `packages/gmt`.

---

## 6. Verification

- `pnpm nx run-many -t lint test typecheck build` stays green, **including the existing
  20-cell GMT timezone matrix** — Dox must not perturb `packages/gmt`.
- `pnpm nx run docs:build` produces a static site; `pnpm nx run docs:dev` serves it.
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
  DOX-C3b additionally requires: a stubbed streamed tool call with a malformed _terminal_
  JSON object must not crash the client.

## 7. Risks

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
- **The globe's rendering approach is not settled.** Three.js + React Three Fiber is the
  assumed stack, but a globe that must be clickable and keyboard-navigable may be better
  served by an orthographic-projection canvas or SVG — lighter, and hit-testing and focus
  order are native rather than invented. DOX-E1a prototypes both before committing.
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
- **Corpus staleness (Tier 6).** Because hosting is now a single same-origin Worker (see
  §2 "Hosting"), the Worker can fetch the corpus from the site it is already serving
  rather than baking it into its own bundle — which resolves this risk rather than
  merely mitigating it. If DOX-C1 nonetheless chooses to bake the corpus in, a docs-only
  change leaves the chatbot answering from stale content until the Worker is redeployed,
  and the CI trigger overlap must ship in the same story.
- **Model choice was made before widgets were central.** Gemini 2.5 Flash was picked for
  free-tier SSE streaming in the 2026-08-21 draft. DOX-C3b now requires the model to emit
  streamed tool calls, which changes the calculus toward whichever provider has the
  better streaming tool-use ergonomics. Re-evaluate in DOX-C1 rather than inheriting the
  choice, and carry forward the two `appendix-parked.md` §2 findings regardless of which
  model is chosen: streamed tool-call arguments are partial JSON, invalid by definition
  until the call completes, and the parser must tolerate a malformed terminal object, not
  only a truncated one; and the widget registry must be fixed and typed — never `eval`.
- **Astro/Starlight churn.** Both move quickly and Starlight peers on an exact-ish Astro
  major, plus, as of `0.41.9`, a specific `@astrojs/markdown-remark` peer. Pin all three,
  upgrade deliberately, and keep the generator emitting plain MDX so only the site shell
  is coupled to the framework.
- **A Cloudflare account is now a hard dependency for deployment, not only for chat.**
  The Tier 0 MVP cannot ship without one. This was previously a Tier 6-only dependency;
  confirm account access before starting DOX-A1.
- **Scope honesty.** 13 stories became 23 units of work. Tier 0 is three of them and is
  genuinely small — a few days, not weeks. Every tier after Tier 1 remains independently
  droppable without losing the docs, which is the property this epic depends on and which
  must be preserved as the tier structure evolves.
