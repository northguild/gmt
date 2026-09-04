# Issues #171, #137–#139 — Ask Dox (the chatbot that mounts widgets)

**Re-audited 2026-08-26 and escalated, not demoted, by explicit user decision** — the
chatbot is now Tier 6, the epic's final tier, and its ambition is higher than the
2026-08-21 draft's: answer, cite, and **mount a real Tier 2 widget** rather than print a
code block.

**Rewritten again 2026-09-03: the chat is built on [AI Elements](https://elements.ai-sdk.dev/)
and the AI SDK, not hand-rolled.** AI Elements is a shadcn registry — its source is
**copied into the repo**, so we own and re-theme every component; it is not a runtime
framework dependency. Adopting it deletes three subsystems the 2026-08-26 spec would have
had us write by hand (a pure SSE line parser, a hand-rolled streaming client, and a
partial-JSON parser for streamed tool calls) and satisfies several Definition-of-Done items
directly. It also adds a foundation story, `DOX-C0`, and a second UI surface. See
"What the 2026-09-03 audit changed" below.

**Five stories across four issues.** `DOX-C0` is **its own new GitHub issue** — the one
place this epic breaks its "no new issues" rule, and deliberately: the React + Tailwind +
AI Elements foundation is infrastructure, not chat, it is the only Tier 6 story that
touches every existing page's build, and it is the only one that can be reviewed and
merged before any chat behavior exists. Everything after it is unchanged: `DOX-C1` is #137,
`DOX-C2` is #138, and `DOX-C3` (#139) splits into `DOX-C3a` (shells + link hardening) and
`DOX-C3b` (widget registry).

| Story                                     | Issue | Tier | Blocks           |
| ----------------------------------------- | ----- | ---- | ---------------- |
| `DOX-C0` — React + AI Elements foundation | #171  | 6    | everything below |
| `DOX-C1` — retrieval index                | #137  | 6    | `DOX-C2`         |
| `DOX-C2` — Worker `/api/chat`             | #138  | 6    | `DOX-C3a`        |
| `DOX-C3a` — dock + `/dox` route           | #139  | 6    | `DOX-C3b`        |
| `DOX-C3b` — widget registry               | #139  | 6    | —                |

Because Tiers 0–5 already produced real pages, real URLs, and a full widget platform,
the bot's job is well-defined: answer from the corpus, cite pages the reader can open
and verify, and mount the widget that actually answers the question instead of describing
it in prose. It augments the docs; it does not replace them.

---

## What the 2026-09-03 audit changed

Verified by fetching `https://elements.ai-sdk.dev/api/registry/*.json` on 2026-09-03 —
48 components; current versions `ai@7.0.91`, `@ai-sdk/react@4.0.94`, `streamdown@2.6.0`,
`@astrojs/react@6.0.5` (which itself depends on `vite@^8`, matching Astro 7).

### What the library buys — each line maps to a DoD item we already committed to

| Capability                                                                        | Why it matters here                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MessageResponse` **is Streamdown**                                               | Handles incomplete markdown mid-stream; ships shiki code blocks **with a built-in copy button** (`DOX-C3a`'s non-negotiable); exposes `[data-streamdown="link"\|"code-block"\|"table"…]` attributes so **the reading surface is themed in plain GMT CSS with no Tailwind at all**; ships `rehype-harden` (`allowedLinkPrefixes` / `defaultOrigin`) plus a `components.a` override — the exact seam for the route-manifest resolver |
| `PromptInputTextarea` wraps a **real `<textarea>`** (shadcn `InputGroupTextarea`) | Satisfies `reference/visual-design.md` §Controls, the epic's _"one hard engineering rule"_: restyle native elements, never rebuild them from `div`s                                                                                                                                                                                                                                                                                |
| AI SDK typed `tool-<name>` message parts                                          | `part.input` arrives **already partial-parsed** across `input-streaming` → `input-available` → `output-available` → `output-error`. **This deletes `DOX-C3b`'s hand-rolled partial-JSON parser.**                                                                                                                                                                                                                                  |
| `useChat` + `toUIMessageStreamResponse()`                                         | **Deletes `DOX-C2`'s pure SSE parser** and **`DOX-C3a`'s hand-rolled stream client**; makes the provider swappable behind one import, which de-risks `DOX-C1`'s re-opened model decision                                                                                                                                                                                                                                           |
| `conversation` (`use-stick-to-bottom`)                                            | Stick-to-bottom-unless-scrolled-up is fiddly and not worth hand-rolling                                                                                                                                                                                                                                                                                                                                                            |
| shadcn primitives are Radix-backed                                                | Focus trap, roving tabindex, dismiss semantics — the a11y baseline `DOX-C3a`'s keyboard-only DoD demands                                                                                                                                                                                                                                                                                                                           |

### What it costs — recorded decisions this reverses

Three decisions elsewhere in the epic are **reversed, not quietly contradicted**. Each has
been edited at its source; they are listed here so a reader of this file alone knows:

1. **`overview.md`'s prior-art table rejected "Tailwind v4, React Query, TanStack Form for
   the chat client."** Tailwind v4 comes back, **scoped to the chat island only**. React
   Query and TanStack Form stay rejected — `useChat` covers both.
2. **`reference/design-system.md` rule 5 forbade introducing `@layer`.** Tailwind v4 emits
   `@layer theme, base, components, utilities`. `DOX-C0` carries the scoping strategy and
   the re-QA gate.
3. **This file's `DOX-C3a` said "not a takeover, not a separate route, not the homepage."**
   The `/dox` route reverses the middle clause by explicit user request. **The spirit
   stands and is restated in `DOX-C3a`:** the docs are the product, the dock augments them,
   and no reader is ever forced through the chat to reach an answer.

Also dying: `DOX-C2`'s _"zero npm dependencies is achievable and worth aiming for."_ The
Worker now bundles `ai` plus a provider. That goal is replaced by a **measured budget**,
not deleted.

### Two findings that change scope beyond the library choice

**`reveal-primitive.ts` cannot do what it was promised to do.**
`reference/visual-design.md` states that `DOX-D2` ships "a debounced, interruptible reveal
primitive" that `DOX-C3a` wires to streaming replies. The shipped implementation
(`apps/dox/src/lib/reveal-primitive.ts`) is a scroll-triggered `IntersectionObserver` that
toggles `.revealed` on `.gmt-reveal`. It accepts no text, has no chunk API, and is a
module-level singleton, so it cannot be instantiated per message; its `debounceTimer` is
declared and cleared but never set. **Streamdown now owns progressive text rendering, so do
not build a typewriter API.** The primitive is re-scoped to panel chrome and mounted
widgets — its actual behavior — and the streaming-text wiring is dropped from `DOX-C3a`.
(`reveal-primitive.ts` was later removed entirely in `hotfix/gmt-dox-transitions`; the
conclusion is unchanged — do not build a typewriter API for replies.)

**The Tier 2 widgets are not independently mountable.**
`DstInspector.astro`, `IntervalVisualizer.astro` and `ConverterBench.astro` hydrate via a
page-bound inline `<script>` that queries the DOM on load. A React registry cannot mount
those. **The needed pattern already exists in the repo**: `initTimezoneMap(host, clockPanel)`
in `apps/dox/src/lib/timezone-map.ts` is exactly the right shape. `DOX-C3b` therefore gains
an explicit first step — extract each widget's script body into a `mount(root)` export.

### Components to install — 12, not `all`

`conversation`, `message`, `prompt-input`, `suggestion`, `task`, `tool`, `artifact`,
`reasoning`, `sources`, `inline-citation`, `code-block`, `shimmer`.

**Deliberately not installed.** `canvas` / `node` / `edge` / `panel` / `toolbar` /
`controls` pull in `@xyflow/react`, a node-graph editor with no use here. The coding-agent
set is irrelevant to a documentation bot: `agent`, `plan`, `queue`, `terminal`,
`test-results`, `stack-trace`, `commit`, `file-tree`, `environment-variables`,
`package-info`, `sandbox`, `checkpoint`. Also skipped: `web-preview`, `open-in-chat`,
`jsx-preview`, `attachments`, `audio-player`, `mic-selector`, `speech-input`,
`transcription`, `voice-selector`, `model-selector`, `persona`, `confirmation`,
`schema-display`, `snippet`, `image`, `chain-of-thought`, `context`.

**Never run bare `npx ai-elements@latest`** — it installs all 48. Always
`npx ai-elements@latest add <name>`.

---

## Prior art

A sibling `@northguild/worktree` repo has a working version of the chat portion of this,
documented in `context/dox/reference/prior-art/worktree-cli-snapshot-2026-08-21.md`. Several of its mechanisms are
adopted below and attributed inline. Read `context/dox/overview.md` §2 "Reviewed prior
art" for the full take/reject list before starting any story here — in particular, **do
not adopt its central idea** (baking the whole corpus into one system prompt with no
retrieval). Its own numbers rule that out at our scale, and `DOX-C1` exists to measure
exactly that.

Note that the 2026-09-03 rewrite **supersedes several of its adopted mechanisms** — its SSE
line parser, its hand-rolled streaming client, and its abort handling are all now the AI
SDK's job. What survives from it is the part that is genuinely ours: the route allowlist
and `resolveHref()` idea, the Worker validation pipeline, the SKILL.md-before-reference
prompt ordering, and the error-vs-warning classification.

## Definition of done — binding for every story in this file

- The model API key never reaches the client. Verify against a **production** build,
  not a dev build.
- Out-of-corpus questions are **refused, not improvised**.
- **A link the model emits either resolves or is not a link.** Never a 404.
- Validate at the edge, not in the browser. Every limit and allowlist lives in the
  Worker; the client is untrusted.
- **The docs work with the chat deleted.** Removing the island must leave every page in
  Tiers 0–5 fully intact — the same independence property `DOX-E1` carries.

---

### Issue #171 — DOX-C0 (new issue — foundation)

**GitHub Issue:** #171 — see tracker.md

**This is the one new GitHub issue in the Dox epic.** Every other unit of work folds into

# 130–#142 as a lettered sub-story; this one does not, because it is a standalone

infrastructure change with its own reviewable Definition of Done and no chat behavior in
it at all. It is a **single-story issue** — it closes when `DOX-C0` lands, unlike #132,

# 133, #136 and #139

**It blocks every other Tier 6 story.** Nothing in `DOX-C1`–`DOX-C3b` can start until this
is merged and the screenshot gate is green.

**It touches no existing page's content, only its build.** That is the whole risk, and the
Definition of Done is written to catch it: every existing page must render
byte-identically afterwards.

#### DOX-C0 — React + AI Elements foundation

**GitHub Issue:** #171 — see tracker.md\_

**Title:**

```
DOX-C0 Add the React + Tailwind + AI Elements foundation, scoped to the chat island
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 6, item DOX-C0.
New in the 2026-09-03 rewrite, and the only story in this epic that gets its own GitHub
issue rather than folding into #130–#142.
Depends on DOX-A5 (tokens) and DOX-D1/DOX-D2 (the glass primitives and motion the chat
chrome composes from). **Blocks every other Tier 6 story** — DOX-C1, DOX-C2, DOX-C3a and
DOX-C3b all assume this has landed.

## Gap
`apps/dox` has no React, no Tailwind, and no JSX configuration of any kind. AI Elements
requires React 19 and Tailwind CSS 4. Every later Tier 6 story assumes this exists, and
none of them is the right place to build it: it is not retrieval, not the Worker, and
not the panel.

This story exists so that exactly one story owns the risk of introducing a second
styling system into a site whose entire theme is hand-written, unlayered CSS.

## Scope

### Toolchain
- `@astrojs/react` + React 19 + `react-dom`, registered as an Astro integration.
- `@tailwindcss/vite`, `ai`, `@ai-sdk/react`, the provider chosen in DOX-C1, and the 12
  AI Elements components listed in this file's header. Use `pnpm`.
- Set `jsx: "react-jsx"` and `jsxImportSource` in `apps/dox/tsconfig.json`. It is
  currently inherited as `"preserve"` from `astro/tsconfigs/strict`, and no React types
  are configured anywhere in the repo.

### The `@/` vs `~/` alias decision — settle it here, once
Every AI Elements source file imports `@/lib/utils` and `@/components/ui/*`. **This repo
has no `@/*` alias.** Its convention is `"~/*": ["src/*"]` (`apps/dox/tsconfig.json`),
and that alias is TS-only — Astro resolves it by reading tsconfig paths, while
`astro.config.mjs` aliases only `@northguild/gmt` on the Vite side.

Two workable options; pick one and record it:
(a) configure `components.json` aliases to `~/` and post-process the copied files, or
(b) add `@/*` alongside `~/*` in tsconfig **and** in the Vite `resolve.alias` block.

Option (b) is the smaller diff and keeps `npx ai-elements@latest add <name>` working
unmodified on every future component. Option (a) keeps one convention in the repo. Do
not leave both half-done.

### Tailwind scoping — the mechanically riskiest part of this story
**Omit Preflight.** Tailwind's global reset targets `*`, `html`, `body` and headings; it
must never reach the docs site. Import the layers individually — this is the documented
v4 opt-out (verified against the Tailwind v4 docs 2026-09-03):

    @layer theme, base, components, utilities;
    @import "tailwindcss/theme.css" layer(theme);
    /* preflight.css deliberately NOT imported */
    @import "tailwindcss/utilities.css" layer(utilities);

**Import that sheet from the React island's entry module, never from
`starlight({ customCss })`.** Vite then code-splits it into the island's own CSS chunk, so
it does not load on a page that never opens the chat.

**Know which way the cascade falls.** Tailwind utilities live in `@layer utilities`; the
GMT sheets are unlayered, and unlayered always beats layered. So **every GMT rule wins
against every Tailwind utility.** The collision set is small and was grep-verified on
2026-09-03 — only three groups of global element selectors exist in the GMT sheets:

    h1–h6                gmt-shell.css      (font-family, letter-spacing)
    textarea, input      gmt-controls.css   (the composer and every AI Elements input)
    body                 gmt-shell.css      (not applicable inside the panel)

Ship a scoped `.gmt-ask` reset for the two that apply. Record the list in
`reference/design-system.md` so it is re-checked on future changes rather than
re-derived.

### Theme bridge
Map shadcn's CSS variables (`--background`, `--foreground`, `--primary`, `--muted`,
`--border`, `--ring`, …) onto the existing `--gmt-*` tokens so the chat inherits the HUD
palette and light/dark for free. **Do not write `[data-theme="light"]` blocks** — that is
`design-system.md` rule 1. If a value must differ between themes, add a theme-role token
in `gmt-tokens.css`.

### Streamdown skin
Style the reading surface in a new `gmt-ask.css` using `[data-streamdown="…"]`
selectors — headings, links, inline code, code blocks, tables, blockquotes. **No Tailwind
touches the reading surface.** Add the file to `customCss` in astro.config.mjs and to
the stylesheet-stack table in `design-system.md`.

### Test wiring
`apps/dox/vitest.config.ts` is `environment: "node"` with no `setupFiles`, no plugins and
no `resolve.alias`. React component tests need `jsdom` (per-file `@vitest-environment`
docblocks are enough, and are cheaper than switching the whole project). The `~` alias is
not wired into Vitest at all, which is why existing tests reach generated files by
absolute path — wire it, or keep using absolute paths deliberately rather than by
accident.

## Before starting
Read `reference/design-system.md` in full. Rules 1 (no `[data-theme="light"]` color
blocks), 2 (no color literals), 3 (widgets compose primitives) and 4 (respect the
`customCss` order) all apply to this story, and rule 5 is the one being amended.

## Definition of done
- **The byte-identical screenshot gate from `design-system.md` passes** on the landing
  page, a dense reference page, the sidebar, the search modal and the mobile menu, in
  light and dark, desktop and mobile — with the island present but never opened. Any
  diff is a regression: this story changes no existing page.
- Grep the built output to confirm **Tailwind Preflight is absent**.
- A reference page's initial payload contains **no React bundle** — verify in the network
  panel, not by inspecting the config.
- `pnpm --filter @gmt/dox check`, `lint`, `test` and `build` all pass; the monorepo gate
  (`lint test typecheck build`, including the 20-cell GMT timezone matrix) stays green.
- A trivial AI Elements component renders inside the GMT theme with correct palette in
  both light and dark, with no `[data-theme="light"]` rule added to achieve it.
- The chosen alias option is implemented consistently — no file imports `@/…` if (a) was
  chosen, and both tsconfig and Vite resolve it if (b) was.
```

---

### Issue #137 — DOX-C1

**GitHub Issue:** #137 — see tracker.md

This issue carries one sub-story, `DOX-C1` (retrieval index), and closes when it lands.
The foundation story that was briefly proposed against #137 is now its own issue — see
`DOX-C0` above.

#### DOX-C1 — Retrieval index

**GitHub Issue:** #137 — see tracker.md\_

**Title:**

```
DOX-C1 Build retrieval chunks and lookup over gmt-corpus.json
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 6, item DOX-C1.
Depends on DOX-A3a (which emits `gmt-corpus.json` and the route manifest), DOX-A4a
(guides to chunk), and DOX-C0 (the provider package this story's model decision selects).

## Gap
504 functions and 1,860 examples is far too large to inject wholesale into every
request's system prompt. The 2026-08-21 draft listed "corpus size vs. free tier"
as an open risk with a hand-wave mitigation. This story turns that risk into a
measurement and a mechanism.

## The "before starting" check is already satisfied — verified 2026-09-03
DOX-A3a emits all of it. Do not reconstruct any of these:

    src/generated/reference/gmt-corpus.json     253 KB, raw JSON
    src/generated/reference/corpus.ts           export const corpus: CorpusEntry[]
    src/generated/reference/route-manifest.ts   export const referenceRoutes: RouteManifest

Types live in `apps/dox/src/reference-types.ts` (`CorpusEntry` carries `url`, `name`,
`namespace`, `module`, `kind`, `signature`, `description`, `sourcePath`; `RouteManifest`
is a `Set<string>`). All are gitignored and produced by `pnpm run generate`.

**`referenceRoutes` currently has no runtime consumer — only tests import it**
(`scripts/llms.test.ts`, `scripts/reference-corpus.test.ts`). `DOX-C3a` is its first.
Note also that its emitted type is a mutable `Set<string>` while the generator's header
comment claims `ReadonlySet<string>`; tighten it here or in DOX-A3a rather than working
around it.

## The corpus-location question is resolved, not open
Settled by the Tier 0 hosting decision (overview.md §2 "Hosting"): the site and the chat
both live behind one Cloudflare Worker, so the Worker fetches the corpus from the static
site it is already serving — with no extra deployment coupling and no staleness risk from
baking the corpus into the Worker bundle. Confirm the fetch path and cache behavior work
before moving to `DOX-C2`.

## Why we are not copying the sibling repo's no-retrieval approach
`reference/prior-art/worktree-cli-snapshot-2026-08-21.md` §5 calls "the AI has no retrieval layer" its single most
important idea — the entire documentation set compiled into a system prompt at build
time. It is cheap, deterministic, and debuggable, and at their scale it is the right
call.

It is the wrong call here, by their own arithmetic: they measure one package at ~29 KB
of prompt and estimate four packages at 80–150 KB, "which you pay for on **every**
request," and they place real retrieval at "past ~500 KB of docs." We have 504 functions
and 1,860 examples in a single package — comfortably past that threshold before any
guides are added.

**Measure it in this story rather than assuming either way.** If the full corpus turns
out to be small enough to bake, that is a real finding and this story should say so.

## Scope
- Extend DOX-A3a's `gmt-corpus.json` into retrieval chunks: per function, the signature
  + description + examples + **the URL of its generated page**; guides chunked by
  heading with their own URLs.
- **Keyword/BM25 first.** With 504 functions and a rigid naming convention
  (`add*`/`diff*`/`startOf*`/`is*`/`format*`, namespace prefixes), lexical retrieval
  will carry surprisingly far. It needs no embedding model, no vector store, no
  additional service, and it runs in the Worker. Do not reach for embeddings until
  keyword retrieval has been shown to fail on real questions.
- Retrieve roughly 10–20 chunks per question.
- **Namespace scoping from page context.** Adapted from the sibling repo's package-scope
  idea (§5 option A), which does not map directly — we ship one package — but the shape
  does: a question asked from `/reference/zoned/...` should bias retrieval toward
  `zoned`. Make it a bias, not a filter, so a cross-namespace question still works.
- **Measure and record in this issue:** total corpus tokens, per-chunk tokens, and
  tokens for a typical retrieved set. Every later decision about caching, model choice,
  and free-tier viability depends on these, and right now they are unknown.

## The model decision is now "pick an AI SDK provider" — a much smaller door
The 2026-08-21 draft chose Gemini 2.5 Flash on free-tier SSE-streaming grounds, before
widgets were part of the plan, and the 2026-08-26 rewrite re-opened it because
`DOX-C3b` needs streamed tool calls.

**The 2026-09-03 rewrite shrinks this decision.** Behind the AI SDK the provider is one
import and one model string, so this is no longer a one-way door, and the
streamed-tool-call requirement is satisfied by any tool-capable provider rather than
acting as a provider filter. Choose on cost, latency and quality; record the choice here
so `DOX-C2` and `DOX-C3b` do not each re-litigate it.

Live inputs, carried from `appendix-parked.md` §2:
- A Google AI Studio key already sits in `apps/dox/.env` as `NORTHGUILD_GMT_GEMINI_API_KEY`
  (gitignored, untracked). **Do not default to Gemini merely because the key exists.**
- Cloudflare Workers AI is a natural candidate — same origin, no separate key custody.
- `@ai-sdk/anthropic` is a candidate and was not considered in either earlier draft.
- The user also asked whether "Tanstack AI" fits better; evaluate it against the AI SDK
  now that the corpus and retrieval shape are known, and record the comparison.

## Token measurement without the `context` component
AI Elements' `context` component (which wraps `tokenlens`) is **deliberately not
installed** — see this file's header. The token-measurement DoD line below still stands;
measure in the Worker and record the numbers in this issue.

## Definition of done
- Retrieval returns sensible chunks for a spread of real questions: a direct lookup
  ("what does formatDate do"), a task ("convert UTC to Tokyo"), a concept ("what happens
  during a DST gap"), and a near-miss ("addBusinessDay" singular).
- Every chunk carries a URL that resolves.
- Corpus token measurements are recorded in this issue.
- The same-origin corpus-fetch path is implemented and its caching behavior recorded.
- The provider and model are chosen and recorded, with the reasoning.
- A question with no good match returns few or no chunks rather than 20 bad ones — the
  refusal path in DOX-C2 depends on this being honest.
```

---

### Issue #138 — DOX-C2

**GitHub Issue:** #138 — see tracker.md

#### DOX-C2 — Worker proxy

**GitHub Issue:** #138 — see tracker.md\_

**Title:**

```
DOX-C2 Add /api/chat to the docs Worker: grounded AI SDK stream with key custody
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 6, item DOX-C2.
Depends on DOX-C1 (retrieval + provider choice) and DOX-C0 (the `ai` package and the
shared provider dependency).

## Gap
The site is static through Tier 5 and has no backend. A model API key cannot ship to
the browser.

## Same-origin, not a separate Worker (2026-08-26 decision, unchanged)
The 2026-08-21 draft specified `workers/dox-proxy` as its own Cloudflare Worker
deployment, which required an explicit CORS allowlist and a second pipeline. **This
story instead adds `main` and `/api/chat` to the same Worker `DOX-A2` already deployed**
(overview.md §2 "Hosting") — the `assets` binding keeps serving the static site, and a
`fetch` handler now also serves `/api/*` from the same isolate, same origin, same
deployment. **CORS is not needed at all**: there is only one origin.

`apps/dox/wrangler.jsonc` currently has no `main` and no `worker/` directory — both are
created by this story.

## The transport is the AI SDK's UI Message Stream (2026-09-03 rewrite)
The 2026-08-26 spec specified an unbuffered raw SSE passthrough
(`new Response(upstream.body, ...)`) plus a hand-written, unit-tested SSE line parser on
the client. **Both are replaced by `streamText(...).toUIMessageStreamResponse()`**, which
`useChat` speaks natively.

What this deletes, and what replaces it:

| Deleted | Replaced by |
| --- | --- |
| The pure, side-effect-free SSE line parser returning a discriminated union, and its unit tests | Nothing — the wire format is no longer ours. **Test request validation and system-prompt assembly instead.** |
| Raw `Response(upstream.body)` passthrough and the "do not buffer" warning | `toUIMessageStreamResponse()`, which streams by construction |
| The `assistant` → `model` role conversion seam | Absorbed by the provider package. Note it as absorbed, not dropped — the client still speaks one generic format, and the provider is still the swap point. |
| "Zero npm dependencies is achievable and worth aiming for" | A **measured** Worker bundle budget — record the built size against the Workers size limit. The concern was right; the target was wrong. |

**Everything else in this story survives unchanged.** The validation pipeline in
particular is not the SDK's job and must still be written.

## Scope
- Add `main` to `apps/dox/wrangler.jsonc` and route `/api/chat` inside the Worker's
  `fetch` handler, falling back to `env.ASSETS.fetch(request)` for everything else. Key
  set via `wrangler secret put` (name depends on the provider chosen in `DOX-C1`) — never
  in the repo, never in a committed env file.
- System prompt assembled in this order, which matters:
  1. **Persona and scope** — answer only from the supplied context; say so when out of
     scope.
  2. **Linking rules** — an explicit allowlist of the routes retrieved for this
     question. Never invent routes; never link to GitHub anchors or SKILL.md headings.
     The sibling repo's §5 observation is worth heeding: *a model shown 20 valid routes
     hallucinates far less than one shown 120.*
  3. **Vocabulary** — the relevant `packages/gmt/skills/*/SKILL.md` content, placed
     **before** reference material so the model learns the library's terminology before
     reading signatures. Adopted from the sibling repo's §5.
  4. **GMT's core rules** from `packages/gmt/README.md` §Core Rules — ISO strings in and
     out, never `Date`, sentinel returns, invalid input never throws.
  5. **The DOX-C1 chunks** retrieved for this question, each labelled with its page URL.
  6. **`DOX-C3b`'s widget registry as AI SDK `tools`** — typed tool definitions passed to
     `streamText`, replacing the 2026-08-26 spec's raw "tool declarations".
  7. An **explicit refusal instruction** for out-of-corpus questions.

### Validation pipeline — adopted from the sibling repo's §6, unchanged
Enumerate these explicitly rather than trusting the upstream to reject bad input:

    method !== POST      → 405
    rate limit exceeded  → 429 + Retry-After
    missing API key      → 500
    malformed JSON       → 400
    messages not array   → 400
    too many messages    → 400
    bad role or shape    → 400  (roles restricted to user|assistant)
    content over cap     → 400
    model not allowed    → 400  (allowlist SHARED with client, one constants module)
    → streamText(...).toUIMessageStreamResponse()
       upstream error    → mapped, human-readable error JSON

Note the `OPTIONS` preflight branch from the 2026-08-21 draft is dropped: same-origin
requests do not trigger CORS preflight, so there is nothing to answer.

- **Share the model allowlist with the client from one module** so UI and Worker cannot
  drift.
- **Map upstream errors to user-facing strings**, distinguishing a daily quota 429 from a
  per-minute one — they need different advice ("come back tomorrow" vs "wait a moment").
  Never forward a raw upstream payload.
- **Rate limiting**, with the honest caveat recorded: an in-memory
  `Map<clientIp, {count, resetAt}>` is **per isolate, not global**. It blunts casual
  abuse; it does not stop a determined attacker. Sweep expired entries and reject rather
  than growing unbounded. If real global limits are needed later, the upgrade paths are
  Cloudflare WAF/Rate Limiting rules, Turnstile, or a Durable Object. Do not describe
  this as "rate limited" without the caveat.

### Testability — do this from day one
- **Put the clock behind a helper** (`getUnixNow()`) so rate-limit tests can fake time.
- Use DOX-A3a's committed stub for the generated corpus/manifest modules so Worker tests
  run on a clean checkout with no build step.
- Test **prompt assembly as a pure function** — given retrieved chunks and a page
  context, assert the seven sections appear in order and the route allowlist contains
  exactly the retrieved URLs. This is the thing that most affects answer quality, and it
  is trivially unit-testable now that the wire format is not ours.

## Before starting
**There is no config flag in any provider that restricts a model to a supplied corpus.**
Grounding is achieved by system prompt + context injection + an explicit refusal
instruction, or it is not achieved. Do not go looking for a flag; this was already
verified.

Re-check current rate limits and model availability for whichever provider `DOX-C1` chose
before committing — this moves, and the epic's cost assumptions rest on it.

Read `.github/workflows/ci.yml` for repo conventions before adding any workflow step. If
DOX-C1's runtime-location decision changes (i.e. the corpus ends up baked into the
Worker bundle after all rather than fetched same-origin), the Worker's deploy trigger
must also fire on docs and `skills/` changes, or the bot silently goes stale — the
sibling repo names this its single most important CI change.

Consider a script bridging `.env.local` → `worker/.dev.vars` so `wrangler dev` picks the
key up without a manual step, with committed `.example` counterparts. Small, and it
removes a recurring papercut. Note `apps/dox/.env` already holds
`NORTHGUILD_GMT_GEMINI_API_KEY`.

## Definition of done
- A question with a corpus answer streams a correct, grounded response into `useChat`.
- A question with no corpus answer is **refused**, not improvised. Test with something
  plausible-but-absent (e.g. "how do I parse a cron expression with gmt") rather than
  something obviously off-topic — the plausible case is where grounding actually fails.
- Every branch of the validation pipeline has a test.
- Rate limiting is tested including per-IP independence, with a faked clock.
- **System-prompt assembly is unit-tested** — section order, and the route allowlist
  matching the retrieved set exactly.
- Grep the deployed production assets for the key and confirm it is absent.
- The built Worker bundle size is measured and recorded against the Workers size limit.
- Worker tests pass on a clean checkout with no prior build.
```

---

### Issue #139 — DOX-C3

**GitHub Issue:** #139 — see tracker.md

`DOX-C3` spans two sub-stories, both Tier 6: `DOX-C3a` (the two shells + link hardening)
and `DOX-C3b` (widget registry). The issue stays open until `DOX-C3b` also lands.

#### DOX-C3a — Chat core, the dock, and the /dox route

**GitHub Issue:** #139 — see tracker.md\_

**Title:**

```
DOX-C3a Add the Ask Dox dock and the /dox route over one shared chat core
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 6, item DOX-C3a.
Depends on DOX-C0 (React + AI Elements), DOX-C2 (the endpoint), DOX-A3a (route
manifest), and DOX-A5 (tokens). Soft dependency on DOX-E1 — the /dox widget rail hosts
the globe, but must render usefully without it.

## Gap
No chat UI exists through Tier 5. This story is where the epic's original ambition
lands — on top of a docs site and a widget platform, not instead of either.

## Two surfaces over one core (2026-09-03 rewrite)
The 2026-08-26 spec said "not a takeover, **not a separate route**, not the homepage."
**The user has explicitly asked for a dedicated route**, so the middle clause is
reversed. The rest stands, and is the constraint this story is built against:

> The docs are the product. The dock augments them. No reader is ever forced through the
> chat to reach an answer, and deleting the chat leaves every page in Tiers 0–5 intact.

Build **one** `<AskDox>` React island and mount it in two hosts.

### Host 1 — the every-page draggable dock
- Mounted by overriding Starlight's **`PageFrame`** component (verified overridable in
  Starlight 0.41.9; it wraps every page, `splash` included). Add it to the `components`
  map in `astro.config.mjs` alongside the existing `ThemeProvider` / `Hero` /
  `SocialIcons` overrides.
- **AI Elements has no draggable modal — the shell is ours.** Build it from the existing
  `.gmt-glass*` / `.gmt-brackets` primitives in `gmt-primitives.css`; do not introduce a
  new panel treatment.
- **`reference/visual-design.md` has no dialog/modal/overlay spec at all.** This story
  writes one, into that file, before building: drag handle, resize, dock/undock,
  focus trap, Escape to dismiss, focus return on close, `prefers-reduced-motion`,
  `prefers-reduced-transparency`, and the existing "no nested glass-within-glass" and
  "cap blurred surfaces" performance rules.
- Hydrates `client:idle`. **The chat core itself does not hydrate until the dock is
  opened** — the launcher is a button, not a chat.

### Host 2 — the /dox route
- A full-height page at `/dox`, built with `<StarlightPage frontmatter={{ template:
  'splash' }}>` so the header, search and theme select stay consistent while the sidebar
  and table of contents drop away. (A plain `src/pages/dox.astro` would not receive
  Starlight's `customCss` and would have to re-import the whole stylesheet stack.)
- Left: the chat core. Right: a **widget rail** carrying the Tier 2 widgets and — via
  `DOX-E1` — the spinnable globe with global clocks. The rail is what makes this route
  worth having over the dock.
- Hydrates `client:load`.
- Link it from the site header or sidebar, not from a modal-only entry point.

## Scope
- Streaming answers via `useChat` + `DefaultChatTransport({ api: '/api/chat' })`,
  rendered with `Conversation` / `ConversationContent` / `ConversationScrollButton`,
  `Message` / `MessageContent` / `MessageResponse`, and `PromptInput*`.
- Seed the retrieval scope from the current page (see DOX-C1), but never silently
  rewrite what the user typed.
- Error and rate-limit states using DOX-A5's Signal-lost treatment rather than a generic
  error box — consistent with how the rest of the site communicates failure.
- **A visible retrieval trace** using `Task` / `Tool` — "searched 504 functions → 12
  chunks", with the chunk titles. This makes grounding legible instead of asserted, and
  it directly exercises DOX-C1's honest-refusal path: a question that retrieves nothing
  should _look_ like it retrieved nothing.

### Link hardening — the most valuable thing taken from the prior art
Unchanged in intent; better in mechanism. **Two layers:**

1. `rehype-harden` with `allowedLinkPrefixes` and `defaultOrigin`, passed to Streamdown's
   `rehypePlugins`. Defense in depth at the origin level.
2. **A `components.a` override on `MessageResponse` is the authority.** Run every href
   through a resolver checked against DOX-A3a's `referenceRoutes` manifest. This matters
   because Streamdown's `defaultOrigin` **rewrites** an unknown link — our requirement is
   that it **degrades to plain text**, which only the component override can do.

| Link the model produced | Outcome |
| --- | --- |
| Relative path in the route manifest | Rendered as a real link |
| Full production URL on our own origin | Origin stripped, re-checked as a relative path |
| Relative path **not** in the manifest | Rendered as **plain text** — no link |
| GitHub anchor or SKILL.md heading | Rendered as **plain text** — no link |
| Other external URL | Only if the origin is allowlisted and the protocol is `https`, `http`, or `mailto` |
| Unparseable, or `javascript:` / `data:` | Dropped |

**The net effect: a hallucinated link degrades to plain text instead of a 404.** A broken
citation is worse than no citation — it makes the site look wrong when it is right.

Do **not** adopt the sibling repo's companion idea of auto-linking bold phrases that
match page titles. Turning prose the model did not intend as a link into a link is a
correctness risk dressed as a nicety.

### Streaming client details — what the SDK owns and what is still ours

**Deleted, because `useChat` owns them:** the `AbortController` per request and
abort-on-new-send; the overall ~120 s request cap; optimistic append of the user message
and an empty assistant placeholder; and the incomplete-markdown problem (Streamdown).

**Still ours, and easy to lose:**
- **The ~30 s idle timeout**, reset on every chunk. The SDK does not provide this, and it
  is the thing that catches a stalled-but-open stream without killing a legitimately long
  answer. Clear the handle in a `finally` so no timer dangles.
- **Error-vs-warning classification.** A rate limit, a validation rejection, or a user
  cancellation is a *warning*: rendered differently from a crash, and **excluded from the
  history sent upstream**. The UI can be forgiving without corrupting model context.
- **Cleaning the history snapshot** sent upstream: filter out error/warning messages and
  empty or still-streaming assistant messages.
- If chat history is persisted, two real traps from the prior art: cache the parsed
  snapshot by its raw string (otherwise `JSON.parse` returns a fresh reference every call
  and you get an infinite render loop), and dispatch a `StorageEvent` manually on write
  (the native event only fires in _other_ tabs). Also sanitize any message still marked
  streaming from a closed tab on load.
- A visible badge when the panel is pointed at a local Worker. Cheap, and it stops
  "why is the AI stale?" confusion.

### Two things this story no longer does
- **No typewriter reveal on streamed text.** `reference/visual-design.md` promised that
  `DOX-D2`'s reveal primitive would be wired here. That primitive
  (`apps/dox/src/lib/reveal-primitive.ts`) was a scroll `IntersectionObserver` with no
  text API, and Streamdown renders progressively anyway; it was then removed outright in
  `hotfix/gmt-dox-transitions`. Either way there is nothing to wire to reply text — do
  not build a text-reveal API. If a scroll-reveal for chrome is wanted later, rebuild to
  the shape in visual-design.md §Motion.
- **`Sources` and `InlineCitation` are installed but not wired in this story.** Link
  hardening inside the prose is the shipping citation mechanism. This is a recorded
  decision, not an oversight; pick them up later if readers ask for a citation list.

## Before starting
Read `reference/visual-design.md` §Controls before building the composer. It is the
epic's one hard engineering rule: restyle native elements, never rebuild them from
`div`s. **AI Elements already satisfies it** — `PromptInputTextarea` wraps shadcn's
`InputGroupTextarea`, which is a real `<textarea>` — so the rule here is *do not replace
it*. Rebuilding it loses IME composition (which breaks all CJK input), autofill, mobile
keyboard behavior and screen reader support, none of which is visible while developing
on a US-English desktop.

The sibling repo's own warning lists "no textarea, no multiline chat, no copiable blocks"
as its known weaknesses. All three come free here: the real textarea above, multiline
input, and Streamdown's shiki code blocks with a built-in copy button.

Resist installing AI Elements components beyond the 12 listed in this file's header, and
resist re-adding React Query or TanStack Form — `useChat` covers both, and that rejection
still stands.

## Definition of done
- Asking "how do I convert a UTC timestamp to Tokyo time" returns a correct, grounded,
  streaming answer citing `convertZonedToZoned`'s page, and that link opens it.
- **A deliberately induced hallucinated link renders as plain text, not a broken link.**
  Test this directly — stub a response containing `/reference/plain/calculate/notAReal`
  and confirm it degrades. This is the story's most important test.
- The same answer renders identically in the dock and on `/dox`.
- Multiline input works; Enter/Shift+Enter behavior is deliberate and documented.
- Code blocks in answers are copyable.
- Stop halts the stream mid-token.
- A stalled stream (no chunks, connection open) is caught by the idle timeout.
- A rate-limit response renders as a warning, not a crash, and does not enter history.
- The retrieval trace shows zero chunks for an out-of-corpus question, and the answer
  refuses.
- Keyboard-only: open the dock, type, submit, stop, dismiss, and return focus sensibly —
  all without a mouse. Repeat on `/dox`.
- The dock is draggable by keyboard as well as pointer, or has a documented keyboard
  equivalent (e.g. dock-position cycling).
- **No chat bundle is hydrated on a reference page until the dock is opened** — verify in
  the network panel.
- `/dox` renders and is usable with the DOX-E1 globe absent.
```

---

#### DOX-C3b — Widget registry

**GitHub Issue:** #139 — see tracker.md\_ (folds into the same issue as `DOX-C3a`)

**Title:**

```
DOX-C3b Let Ask Dox answer by mounting a real Tier 2 widget
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 6, item DOX-C3b.
Promoted out of `appendix-parked.md` §1 by explicit user request.
Depends on DOX-C3a and every Tier 2 widget (`DOX-B1a`, `DOX-B2a`–`d`). Soft dependency
on DOX-E1a for the globe entry.

## Gap
Without this, the chat can only describe a widget in prose ("try changing
`disambiguation` to `earlier`"). With Tier 2's widgets already built, the model can
instead answer a free-form question by mounting the actual DST inspector, interval
visualizer, converter bench, globe, or generic playground, live, in the panel.

## Why this is cheap now
This idea was parked in the 2026-08-21 draft because building both a widget system and a
generative-UI layer in one story was a lot of simultaneous machinery. **That is no longer
true.** Tier 2 already built every widget this story mounts, and the AI SDK already parses
streamed tool arguments. This story is a typed registry plus tool definitions over things
that already exist and already work.

## Step 1 — make the widgets mountable (do this first)
**The Tier 2 widgets cannot currently be mounted by anything.** `DstInspector.astro`,
`IntervalVisualizer.astro` and `ConverterBench.astro` each hydrate via a page-bound inline
`<script>` that queries the document on load. There is no exported entry point.

The pattern to copy already exists in the repo: `initTimezoneMap(host, clockPanel)` in
`apps/dox/src/lib/timezone-map.ts` takes its host element as an argument.

For each widget, extract the inline `<script>` body into `lib/<widget>-mount.ts` exporting
`mount(root: HTMLElement): void`, leaving the `.astro` file's script as a single call.
This is a pure refactor of existing, working code and must not change any Tier 2 page —
verify with the screenshot gate.

## Two findings carried forward — one survives, one is obsolete

**Survives, verbatim: the registry is fixed and typed. Never `eval`.** Registry entries
`import()` a mount module lazily and call `mount(ref.current)`. No dynamic code, no
string-to-code path, no network fetch of markup.

**Obsolete as of 2026-09-03: the partial-JSON parser.** The original finding was that
streamed tool-call arguments are partial JSON and must never be raw-`JSON.parse`d, and
that some providers do not guarantee valid JSON even at the final chunk. **The AI SDK now
does this parsing for us** — `tool-<name>` message parts carry an already-parsed
`part.input` across `input-streaming` → `input-available` → `output-available` →
`output-error`. Do not write a partial-JSON parser. The residual risk moves from _parsing_
to _validation_: a parsed object can still be missing fields or carry a nonsense zone.

## Scope
- A fixed, typed widget registry mapping a tool name to one of Tier 2's real components:
  a generic `showPlayground({ fn, args })` plus purpose-built entries for the DST
  inspector (`DOX-B2b`), the interval visualizer (`DOX-B2c`), the converter/format
  bench (`DOX-B2d`), and **`showGlobe({ zones })`** for `DOX-E1`'s globe and clocks.
- Register these as AI SDK `tools` with zod schemas, passed to `streamText` in the Worker
  (`DOX-C2` system-prompt section 6).
- **Validate every tool input at the mount boundary**, not only at the schema. An IANA
  zone the model invented must render an error state, not throw.
- Render the mounted widget inside `Artifact` in the `/dox` widget rail, and inline in
  the dock.
- Reuse `DOX-B1b`'s permalink mechanism so a mounted widget's state is itself linkable
  from the chat transcript.

## Before starting
Read `appendix-parked.md` §1 — it is now a pointer to this story, and records the
original widget list (including a command palette for jumping to a function by name,
which this story may or may not pick up) and why the DST inspector was called out as the
one worth building first, which `DOX-B2b` has now done.

## Definition of done
- A free-form question that matches a Tier 2 widget's purpose (e.g. "what happens to
  1:30am on November 3rd in New York") causes the model to mount that widget, live, in
  the panel, seeded with relevant arguments.
- Every Tier 2 widget page renders **byte-identically** after the `mount(root)`
  refactor — this step changes no existing behavior.
- A tool call with a **valid shape but nonsense arguments** (e.g. zone
  `"Mars/Olympus_Mons"`) renders an error state rather than crashing the panel.
- An **unknown tool name** and an `output-error` part are both handled without crashing —
  verified with direct tests, not inferred from the happy path.
- No `eval` or dynamic code execution exists anywhere in the registry or its dispatch
  path — verified by reading the implementation, not only by testing happy paths.
- A mounted widget's state can be copied as a permalink from the chat transcript.
- A mounted widget is keyboard-operable inside the panel, matching its standalone page.
```
