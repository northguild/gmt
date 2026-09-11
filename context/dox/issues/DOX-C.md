# Issues #171, #137–#139 — Dox (the chatbot that mounts widgets)

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

**Amended 2026-09-09, at explicit user request: two `DOX-C3a` DoD items — the `/dox`
route and an every-page entry point — were promoted into this story.** This is a real,
intentional exception to the paragraph above: every page's header now carries an "Ask
Dox" link, so the byte-identical claim no longer holds verbatim (the visual gate's
baseline was re-captured to include it, and `visual:diff` passes against that new
baseline). What shipped is a plain link to a real `/dox` route hosting the same static,
non-networked probe DOX-C0 already built — **not** `DOX-C3a`'s draggable dock (drag,
resize, focus trap, keyboard cycling), which is real UI work that needs a working
`/api/chat` behind it to be worth building. `DOX-C3a` replaces this link with the actual
dock; see `reference/design-system.md`'s "`/dox` and the header link" section for the
implementation notes (in particular, why `Header.astro` must compose Starlight's
sub-components via `virtual:starlight/components/*`, not direct file imports).

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

**Resolved: option (a), `~/` only.** The premise for preferring (b) was wrong — the
`shadcn`/`ai-elements` CLI **rewrites every copied file's imports** from
`components.json`'s `aliases` block on install, so `npx ai-elements@latest add <name>`
keeps working unmodified either way; (a) needed no manual post-processing. No `@/*` was
added to `tsconfig.json` or `astro.config.mjs`'s Vite config.

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
against every Tailwind utility.**

**Correction (2026-09-09): the collision set has six groups, not three** — a full scan
of all 22 sheets (the 2026-09-03 grep only checked a few files) also found `header`
(whose `backdrop-filter` would nest glass-on-glass inside a future dock), `dialog` /
`[role="dialog"]` (the latter matches every Radix overlay AI Elements renders), and
`::selection`. The full table, with what each rule actually sets, lives in
`reference/design-system.md`'s "Tailwind in the chat island" section — `gmt-ask.css`
ships the scoped `.gmt-ask` reset for all six.

Also missing from the original snippet: `source(none)` on the `@import
"tailwindcss/utilities.css"` line, plus an explicit `@source` list. Without it Tailwind
scans all of `apps/dox`, including the ~504 generated reference pages. See
`design-system.md` for the corrected snippet.

### Theme bridge
Map shadcn's CSS variables (`--background`, `--foreground`, `--primary`, `--muted`,
`--border`, `--ring`, …) onto the existing `--gmt-*` tokens so the chat inherits the HUD
palette and light/dark for free. **Do not write `[data-theme="light"]` blocks** — that is
`design-system.md` rule 1. If a value must differ between themes, add a theme-role token
in `gmt-tokens.css`.

### Streamdown skin

**Correction (2026-09-09): `[data-streamdown="…"]` selectors mostly don't exist.**
Streamdown 2.6.0 emits exactly one — `table-wrapper` — not `heading-1` / `link` /
`code-block` / … as originally assumed, and its components need Tailwind's utility
classes and shadcn's CSS variables to render at all (no Tailwind isn't achievable).
The actual approach, detailed in `design-system.md`: Tailwind provides the structural
baseline; unlayered `.gmt-ask-response …` selectors in `gmt-ask.css` override it, keyed
off a `className="gmt-ask-response"` given explicitly to `MessageResponse` at each call
site. `gmt-ask.css` is **not** added to `astro.config.mjs`'s `customCss` — it's imported
from the island's entry module, same as the Tailwind sheet, so a page that never opens
the chat loads neither.

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
- **The screenshot gate from `design-system.md` passes** (`pnpm visual:diff`, a
  perceptual pixel diff — see that file for why not byte-identical) on the landing
  page, a dense reference page, the sidebar, the search modal and the mobile menu, in
  light and dark, desktop and mobile.
  **Amended 2026-09-09:** "this story changes no existing page" no longer holds
  verbatim — the header link promoted from `DOX-C3a` (see above) touches every page's
  header, intentionally. The baseline was re-captured to include it; `visual:diff`
  passing against that baseline is what this line now means.
- Grep the built output to confirm **Tailwind Preflight is absent**.
- A reference page's initial payload contains **no React bundle** — verify in the network
  panel, not by inspecting the config.
- `pnpm --filter @gmt/dox check`, `lint`, `test` and `build` all pass; the monorepo gate
  (`lint test typecheck build`, including the 20-cell GMT timezone matrix) stays green.
- A trivial AI Elements component renders inside the GMT theme with correct palette in
  both light and dark, with no `[data-theme="light"]` rule added to achieve it.
- The chosen alias option (`~/`, resolved above) is implemented consistently — no file
  imports `@/…`.
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

**Amended 2026-09-09 — implemented, with three corrections to this file's own numbers:**

1. **591 functions, not 504.** The corpus has grown since this file's estimate; measure
   from the live `gmt-corpus.json`, not this count, going forward.
2. **`CorpusEntry` had no `examples` field at all** — `build-reference.ts` parses
   `@example` JSDoc tags into memory (`Doc.examples`) but the corpus-writing step
   dropped them before ever reaching `gmt-corpus.json`. Fixed in `build-reference.ts`
   and `reference-types.ts` (`CorpusEntry.examples: CorpusExample[]`); 519 of 591
   entries now carry at least one. Also fixed in the same pass: `RouteManifest` is now
   `ReadonlySet<string>`, matching what the generator's header comment already claimed.
3. **A latent generator bug, unrelated to this story but found while touching it:**
   `runGeneration()` wrote `gmt-corpus.json`'s sidebar output before creating `outGen`,
   which only worked because the directory normally already exists from a prior run —
   a genuinely clean checkout (`rm -rf src/generated`) hit `ENOENT`. Fixed by moving the
   `mkdirSync` earlier.

**Retrieval chunks:** `apps/dox/src/lib/retrieval/` — `function-chunks.ts` (one chunk
per corpus entry: name + signature + description + formatted examples),
`guide-sources.ts` (loads all 24 guide files via `import.meta.glob`, matching
`llms.txt.ts`'s existing fix for the same Astro-endpoint-bundling problem — a
`node:fs` walk relative to `import.meta.dirname` breaks once Astro bundles the calling
endpoint into `dist/.prerender/chunks/*.mjs`), and `guide-chunks.ts` (one chunk per
`##` heading, URL-fragmented via `github-slugger` to match Starlight's own anchors).
Built at `astro build` time into a static asset — `src/pages/retrieval-chunks.json.ts`
— rather than at Worker runtime, since only Node has `fs`/glob access; the Worker
fetches it same-origin (`lib/retrieval/fetch-chunks.ts`, Cache-API-based, tested with a
mock cache rather than Miniflare).

**Retrieval scored 755 chunks** (591 function + 164 guide) at build time, 2026-09-09.

**Search: `lib/retrieval/search.ts`, MiniSearch (BM25).** Two things the naive version
got wrong, found by actually running the four DoD question types against the real
corpus rather than assuming BM25 "just works":

- **Stopword filtering was necessary, not optional.** Without it, "format a date for
  display" — a real, in-corpus question — matched 489 of 591 chunks, because OR
  combination means "a"/"for" alone match hundreds of entries. A ~30-word stopword
  list cut that to low hundreds; combined with the score threshold below, to 15.
- **A minimum relevance score (8, tuned against real queries) is what makes the
  honest-refusal DoD line true.** Raw top-N alone can't distinguish a real match from
  fuzzy/prefix padding. Verified empirically: every DoD question type's best result
  scored ≥ 10.6; three genuinely unrelated questions ("recommend a pizza restaurant",
  "translate to French", "javascript sorting algorithm") topped out at 6.0 or returned
  zero. This threshold is tuned to _this_ corpus size and boost/stopword settings, not
  a universal constant — re-verify if either changes materially.
- **One finding that changed the test itself, not the code:** "parse a cron expression"
  (this file's own DOX-C2 refusal-test example) is a _bad_:\*\* "parse a cron expression"
  (this file's own DOX-C2 refusal-test example) is a _bad_ fixture for DOX-C1's
  chunk-count DoD line — it genuinely surfaces real `parseHttp`/`parseRfc3339`/`parseSql`
  chunks, which is honest retrieval (the corpus really does have those), not padding.
  Recognizing "none of these describe cron support" is the LLM's job in DOX-C2's
  end-to-end test, not retrieval's. DOX-C1's own test uses two questions with zero real
  keyword overlap instead.

**Provider decision: Vercel AI SDK (unchanged from DOX-C0), Gemini 2.5 Flash via
`@ai-sdk/google`.** **Corrected under DOX-C2 (2026-09-09): `gemini-2.5-flash` is no
longer available to new API keys** — a live call during DOX-C2's implementation returned
"This model models/gemini-2.5-flash is no longer available to new users. Please update
your code to use models/gemini-3.6-flash." `ALLOWED_MODELS` in
`src/lib/chat-constants.ts` uses `gemini-3.6-flash`; the reasoning below for choosing the
Google/Gemini family over TanStack AI, Workers AI, and Anthropic is unaffected by the
model rename. "TanStack AI" (`@tanstack/ai` + `@tanstack/ai-react`) is real and
well-built — confirmed via its own docs, not assumed — and its `chat()` +
`toServerSentEventsResponse()` works from a plain `Request`/`Response` handler (a
Cloudflare Worker example exists), not only inside TanStack Start. It loses on two
independent grounds: **no `@tanstack/ai-google` and no Workers AI adapter exist**
(checked npm directly, 2026-09-09) — of this story's three real candidates it covers
only Anthropic — and adopting it now would mean either dropping AI Elements entirely or
building an adapter shim, since AI Elements' vendored components (`message.tsx`,
`prompt-input.tsx`) are typed against the `ai` package's `UIMessage`/`ChatStatus`
directly. Between the two remaining real options: **Cloudflare Workers AI** (same-origin,
no key custody) was passed over because DOX-C3b's widget-mounting needs reliable
structured tool calls, and Workers AI's cheap-tier models are generally weaker at this
than Gemini 2.5 Flash; **Anthropic** has no free tier and no key already provisioned.
Gemini 2.5 Flash: strong tool-calling, a free tier, and `NORTHGUILD_GMT_GEMINI_API_KEY`
already sits in the real deployment's `apps/dox/.env` (absent from this worktree, which
has no `.env` file at all — confirmed, not assumed).

Original description follows, for the gap this story was built to close:

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
  **Done 2026-09-09** — all four tested in `lib/retrieval/search.test.ts` against the
  real 755-chunk corpus, not synthetic fixtures.
- Every chunk carries a URL that resolves. **Done** — function chunks reuse
  `CorpusEntry.url` directly; guide chunks reuse the same route-derivation `llms.txt.ts`
  already relies on, fragmented via `github-slugger` to match Starlight's own anchors.
- Corpus token measurements are recorded in this issue. **Done, measured 2026-09-09
  against the real built `retrieval-chunks.json`:**

      755 chunks total (591 function + 164 guide)
      ~83,750 estimated tokens across the whole corpus (chars/4 heuristic — see
        lib/retrieval/tokens.ts's docstring for why not an exact provider tokenizer)
      111 mean tokens/chunk, 2,593 max, 7 min
      Typical retrieved set (15 chunks, real questions): 1,200-6,400 tokens depending
        on how many chunks clear the relevance threshold

  For scale: the sibling repo's own arithmetic put "four packages" at 80-150 KB
  (~20,000-37,500 tokens) as the point baking the corpus into every prompt gets
  expensive, and real retrieval as worth it "past ~500 KB of docs" (~125,000 tokens).
  This **single** package's corpus, at ~83,750 tokens, is already past their
  four-package estimate — retrieval over baking is the correct call, not a
  precaution.
- The same-origin corpus-fetch path is implemented and its caching behavior recorded.
  **Done** — `lib/retrieval/fetch-chunks.ts`, Cache-API-based (`caches.default` in
  production), tested with a mock `{match, put}` cache rather than Miniflare. Not yet
  wired into a real Worker (that's `DOX-C2`); this is the tested function `DOX-C2`
  calls with `caches.default`.
- The provider and model are chosen and recorded, with the reasoning. **Done** —
  Vercel AI SDK (unchanged from `DOX-C0`) + Gemini 2.5 Flash via `@ai-sdk/google`; see
  the "Amended 2026-09-09" note above for the full TanStack AI comparison and the
  Workers AI / Anthropic tradeoffs.
- A question with no good match returns few or no chunks rather than 20 bad ones — the
  refusal path in DOX-C2 depends on this being honest. **Done, with one correction to
  this DoD's own framing**: "parse a cron expression" (this file's DOX-C2 example)
  turned out to be a bad fixture for *this* line — it genuinely surfaces real
  `parse*` chunks, which is honest retrieval, not the failure mode this line means.
  Tested instead with two questions carrying zero real keyword overlap with the
  corpus; both return under 5 chunks (one returns zero). See `search.ts`'s
  `MIN_RELEVANCE_SCORE` docstring for the empirical basis.
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

**Amended 2026-09-09 — implemented.** The bridging script above was **not** built: this
worktree had no `.env.local` to bridge from (the site's Astro build never needed the
Gemini key at build time — only the Worker needs it, at runtime), so a script for a
single env var would have been overhead the story didn't need. Instead: `apps/dox/.dev.vars`
(gitignored, real key) plus a committed `apps/dox/.dev.vars.example` placeholder — the
plain Wrangler convention, with nothing to bridge.

## Definition of done
- A question with a corpus answer streams a correct, grounded response into `useChat`.
  **Done** — verified against the real `/api/chat` endpoint via `wrangler dev` and a
  direct HTTP request (no `useChat` client exists yet; that's `DOX-C3a`). Asking "how do
  I convert a UTC timestamp to Tokyo time with gmt" streamed a correct answer citing
  `convertUtcToZoned`/`convertUnixToPlainDateTime` and a real guide link.
- A question with no corpus answer is **refused**, not improvised. Test with something
  plausible-but-absent (e.g. "how do I parse a cron expression with gmt") rather than
  something obviously off-topic — the plausible case is where grounding actually fails.
  **Done** — this exact question, against the real API, returned "The @northguild/gmt
  documentation does not cover parsing cron expressions." with no invented function.
- Every branch of the validation pipeline has a test. **Done** —
  `worker/validation.test.ts`; message-shape validation is delegated to `ai`'s own
  `safeValidateUIMessages` rather than a hand-guessed zod schema, since `UIMessage` has
  ~10 part-type variants maintained in lockstep with `useChat`.
- Rate limiting is tested including per-IP independence, with a faked clock. **Done** —
  `worker/rate-limit.test.ts`, plus verified live (25 rapid requests: 429 kicked in at
  request 19 of a 20-request window).
- **System-prompt assembly is unit-tested** — section order, and the route allowlist
  matching the retrieved set exactly. **Done** — `worker/system-prompt.test.ts`.
- Grep the deployed production assets for the key and confirm it is absent. **Done** —
  confirmed absent from `dist/`, and confirmed live that no `/api/chat` response
  (success or error) ever contains it.
- The built Worker bundle size is measured and recorded against the Workers size limit.
  **Done, measured 2026-09-09**: 354.88 KiB gzip (1959.32 KiB uncompressed) via
  `wrangler deploy --dry-run`, well under Cloudflare's 3 MB compressed Worker script
  limit.
- Worker tests pass on a clean checkout with no prior build. **Done** — the generated
  corpus/route-manifest modules `worker/*` needs are git-tracked (not merely gitignored
  as `DOX-C1` initially assumed), so `pnpm test` needs no prior `pnpm run generate`.
```

---

### Issue #139 — DOX-C3

**GitHub Issue:** #139 — see tracker.md

`DOX-C3` spans two sub-stories, both Tier 6: `DOX-C3a` (the two shells + link hardening)
and `DOX-C3b` (widget registry). The issue stays open until `DOX-C3b` also lands.

#### DOX-C3a — Chat core and the /dox route

**GitHub Issue:** #139 — see tracker.md\_

**Title:**

```
DOX-C3a Add the Dox chat core and the /dox route
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

## One surface, not two — AMENDED 2026-09-10, the dock is CUT
The 2026-08-26 spec said "not a takeover, **not a separate route**, not the homepage."
**The user has explicitly asked for a dedicated route**, so the middle clause is
reversed. The rest stands, and is the constraint this story is built against:

> The docs are the product. Dox augments them. No reader is ever forced through the
> chat to reach an answer, and deleting the chat leaves every page in Tiers 0–5 intact.

**This story originally specified two hosts over one core: an every-page draggable dock
("Host 1") and the `/dox` route ("Host 2"). Host 1 is cut. Only `/dox` is built.**

Three reasons, in order of weight:

1. **The every-page entry point already exists and costs nothing.** `DOX-C0` shipped a
   header link carrying the Dox crystal — a plain `<a>` plus inline SVG, with **no
   `client:` directive anywhere in `Header.astro` or `DoxMark.astro`**. Every page can
   reach Dox in one click, with zero JavaScript.
2. **A dock would break the property `DOX-C0` was built to protect.** That story's DoD
   requires a reference page's initial payload to contain no React bundle. Today that is
   true *by construction* — there is no island to hydrate. Overriding `PageFrame` to
   mount a launcher on all ~650 pages puts React on the critical path everywhere and
   turns a structural guarantee into a thing that needs policing.
3. **It would duplicate a surface that is now deliberately different.** `/dox` evolved
   into a chrome-free, full-bleed app surface (`dox.astro` hides the Starlight header and
   `<h1>` via `data-dox-shell`). A floating glass panel showing the same transcript is a
   second, worse version of it.

The cost of the cut, stated honestly: a reader must navigate away from the page they are
on to ask a question, losing their place. The page-context bias that seeds retrieval
(`namespace-from-page.ts`) still works — `/dox` receives it from the referrer — but the
reader's *visual* context does not follow them. If that turns out to matter, the answer
is probably a slide-over on `/dox`-adjacent routes, not the full drag/resize dock.

**What retires with it:** the `PageFrame` override, the drag/resize/undock shell, the
dialog-and-overlay spec this story was to write into `reference/visual-design.md`, and
the four dock-specific DoD lines below.

### The /dox route — the only surface
- A full-height page at `/dox`, built with `<StarlightPage frontmatter={{ template:
  'splash' }}>` so the header, search and theme select stay consistent while the sidebar
  and table of contents drop away. (A plain `src/pages/dox.astro` would not receive
  Starlight's `customCss` and would have to re-import the whole stylesheet stack.)
- Left: the chat core. Right: a **widget rail** carrying the Tier 2 widgets and — via
  `DOX-E1` — the spinnable globe with global clocks. **Deferred to `DOX-C3b`**, which
  owns the widget-mounting machinery the rail is made of.
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
- ~~The same answer renders identically in the dock and on `/dox`.~~ **Retired with the
  dock — there is only one surface.**
- Multiline input works; Enter/Shift+Enter behavior is deliberate and documented.
- Code blocks in answers are copyable.
- Stop halts the stream mid-token.
- A stalled stream (no chunks, connection open) is caught by the idle timeout.
- A rate-limit response renders as a warning, not a crash, and does not enter history.
- The retrieval trace shows zero chunks for an out-of-corpus question, and the answer
  refuses.
- Keyboard-only on `/dox`: reach the composer, type, submit, stop, and reach the brain
  selector — all without a mouse. **(The "open the dock … dismiss … return focus"
  half is retired; there is no dock to open or dismiss.)**
- ~~The dock is draggable by keyboard as well as pointer.~~ **Retired with the dock.**
- **No React bundle is hydrated on a reference page at all** — verify in the network
  panel. Stronger than the original line, which only required it "until the dock is
  opened": with the dock cut, the header entry point is a plain link and a reference
  page ships no island whatsoever.
- `/dox` renders and is usable with the DOX-E1 globe absent. **Trivially met while the
  widget rail is deferred to `DOX-C3b`; re-check when the rail lands.**

**Added by the 2026-09-10 amendment — the free-tier survival DoD.** None of this was
foreseen when the story was written; it became mandatory once a live run exhausted
Gemini's 20-requests-per-day free allowance mid-session:

- An exhausted brain is **invisible to the reader**: the request fails over to another
  brain before any output is streamed, rather than surfacing an error.
- A brain the API key cannot reach (404/400) is deprioritised for the day rather
  than retried eagerly. **Amended 2026-09-10 to match the code, which is right and
  this line was not.** It originally said "pruned". `orderCandidates`
  (`worker/brains.ts`) deliberately does not prune: a known-bad brain drops to the
  back of the candidate list and is still tried as a last resort, because the ledger
  can be stale, absent, or simply wrong about a model Google has since restored, and
  refusing to answer on a cached opinion is worse than spending one request to find
  out. The reader-visible property the line was reaching for — an exhausted or
  unreachable brain never surfaces as an error — is met by the failover, not by
  pruning.
- The usage badge reports **real** numbers from the KV ledger, and they move with real
  requests and survive a reload.
- Day boundaries are Pacific, not UTC, and are computed with `@northguild/gmt` — the
  library this site documents — including across a DST change.
```

---

#### DOX-C3b — Widget registry

**GitHub Issue:** #139 — see tracker.md\_ (folds into the same issue as `DOX-C3a`)

**Title:**

```
DOX-C3b Let Dox answer by mounting a real Tier 2 widget
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

**Pickup note (2026-09-09):** `showGlobe`'s two entry points are already rail-ready —
`initGlobe(host, clockPanel)` (`apps/dox/src/lib/globe.ts`) and `initScrubber(host)`
(`apps/dox/src/lib/multi-zone-scrubber.ts`) both take a host element and mount into it,
same shape as `DOX-B2b`/`-c`/`-d`'s widgets. This story's job for `DOX-E1` specifically
is mounting those two existing entry points into the rail, seeded from tool args — not
building new globe/scrubber code. See `issues/DOX-E.md`'s Status notes and
`tracker.md`'s footnote on the `DOX-E1` row.

---

## C1–C3a remediation pass — 2026-09-10

An audit of `DOX-C1`, `DOX-C2` and `DOX-C3a` against their own Definition of Done
found the "Done" marks defensible for "code exists, is wired, and works" but not for
"every DoD bullet has something behind it". Three shipped defects and a set of
untested branches were closed before starting `DOX-C3b`. Recorded here because
several of these are corrections to claims *this file* made.

**Three defects, all reader-visible:**

- **A refused send destroyed the reader's text.** `ai-elements/prompt-input.tsx`
  called `form.reset()` *before* `onSubmit`, so a 5,000-character paste showed
  "limit 4,000" against an already-empty box, with nothing to trim and retry. The
  vendored component's own two "Don't clear on error - user may want to retry"
  branches never applied to text — `clear()` only ever cleared attachments. Reset is
  now deferred to the success paths (the up-front reset is kept for the async blob
  race it was actually written for), and `DoxChat`'s `send` returns a boolean so a
  refusal reaches that contract.
- **`/api/brains` served per-visitor data under `cache-control: public`.** The body
  carries `visitor.used`/`remaining`/`unlimited`, keyed on a hashed IP — any shared
  cache was entitled to hand one reader's counts, including a dev's `unlimited:
  true`, to another. Now `private, no-store`: the original "keeps ledger reads flat"
  rationale was an argument for an *edge* cache, which `private` disallows outright,
  and any browser window at all swallowed the post-send refresh that makes the badge
  move.
- **`BrainSelector` was invalid ARIA.** `<ul role="listbox">` wrapping
  `<li><button role="option">` — a `listbox` may only contain `option`s. No Escape,
  no outside-click, no arrow keys, no focus return, behind an
  `aria-haspopup="listbox"` promising all of it. Rebuilt on the already-vendored,
  previously unused Radix `ui/dropdown-menu.tsx` as a `menuitemradio` group. The
  keyboard DoD line was previously met only on a literal reading.

**Untested DoD branches, now covered** (477 → 534 tests). Each was verified
non-vacuous by breaking the implementation and watching it fail:

- `worker/index.ts` had **no tests at all** — both 405 guards, the missing-key 500,
  the assets passthrough and the `?key=` interception. Testing it needed a Vite
  plugin mirroring Wrangler's `Text` module rule for `*.md`, which is why the entry
  point had gone untested; the rest of `worker/` avoids the problem only by never
  importing it.
- **Server-side sanitisation was not asserted to happen.** `sanitizeMessage` could
  have been deleted from `validateChatRequest` with a green suite. Plus the three
  genuinely untested branches: empty-after-sanitise, the conversation-character cap,
  and over-long `pageContext`.
- **"Emits all seven sections in order" omitted `## Standing order`** — the
  prompt-injection boundary. There are eight sections; the whole injection defence
  could have been deleted and the only structural test would still have passed.
- **"The route allowlist matches the retrieved set exactly" did not test that.** It
  passed both fields from one fixture and asserted only `toContain`. The property
  only exists where the handler derives one from the other, so the assertion moved
  to `chat-handler.test.ts` with decoy routes.
- **`DOX-C3a`'s self-declared most important test had never been written.** The
  hallucinated-link degradation was covered as a pure function against a two-entry
  fixture; nothing exercised Markdown → Streamdown → `components.a` → the DOM. The
  renderer moved to `ask/link-components.tsx` so it can be rendered in a test, and
  `link-components.test.tsx` runs it against the real route manifest.
- **Guide chunks — 164 of 761 — were searched by no test.** `search.test.ts` built
  its corpus from `buildFunctionChunks` alone, so every retrieval-quality claim was
  a claim about 78% of what the Worker searches. Assembly moved to
  `lib/retrieval/corpus.ts`, shared with the endpoint that serves it.
- **`MIN_RELEVANCE_SCORE` re-verified at the real corpus size.** Tuned at 591 chunks,
  never re-checked at 761 despite its own docstring asking for it. It holds; the
  fresh per-question measurements are in that docstring, including the off-domain
  column the refusal path depends on.

**Two pieces of dead code, resolved rather than left:**

- `retryable` was computed on all seven branches of `classifyChatError` and rendered
  nowhere. It now drives a "Try again" affordance — which also means a reader whose
  stream died no longer has to retype their question.
- **History was sent unfiltered.** This file's own `DOX-C3a` scope asked to "filter
  out empty or still-streaming assistant messages"; it was never implemented, and
  `DoxChat` documented the resulting failure mode without fixing it. `lib/chat-history.ts`
  now does it, via `prepareSendMessagesRequest`.

**Corrections to this file and to `tracker.md`:** nine brains, not four; eight prompt
sections, not seven; 597 functions / 761 chunks, not 591 / 755 — that last one was
also being *shown to readers* on the empty chat screen, and is now guarded by
`corpus-summary.test.ts` so it cannot drift silently again. The 404/400 "pruned" DoD
line was amended to match `orderCandidates`, whose reasoning is better than the
line's.

**Two things this pass added that the plan did not anticipate:**

- **The visual gate covered one of the three widget pages.** `DOX-C3b`'s
  "every Tier 2 widget page renders identically after the refactor" was unverifiable
  for the interval visualizer and the converter bench, which had no visual coverage
  at all. `PAGES` now carries one page per widget: 24 → 32 snapshots.
- **`DoxChat.ssr.test.tsx`.** `/dox` is server-rendered before it hydrates, and
  hoisting a `window.location.origin` lookup out of a link renderer and into a
  `useMemo` broke the build — caught by neither `astro check` (no rendering) nor any
  test (all jsdom, where `window` exists), only by `astro build`, at the end. A
  three-test `node`-environment SSR render now catches that class of bug in about a
  second.

---

## DOX-C3b progress — steps 1-4, plus the /tools pages

`DOX-C3b`'s cross-cutting layer is built and green; the three Astro widget
extractions (steps 2-4) are what remain. Decisions and findings worth carrying:

**Markup provenance: a shared `renderTemplate()`.** Settled before any code, per
this file's own instruction. One function produces the markup; the `.astro` page
server-renders it and the rail assigns it to `root.innerHTML` before `mount()`.
`widget-mount.ts` holds the contract.

**`AbortSignal`, not `destroy()`, is the React StrictMode answer.** Every mount is
async, so StrictMode's cleanup runs *before the first mount's await settles* —
`destroy()` would be called on a handle that does not exist yet. Both halves are
now tested and both were verified to fail when removed: the signal for a mount
already in flight, and a late-resolving handle for a mount that ignores it.

**The tools carry a trivial `execute`. This was verified, not reasoned.** An
execute-less tool leaves `assistant[text,tool-call]` with no `tool[tool-result]`
when replayed through `convertToModelMessages` — a `functionCall` with no
`functionResponse`, which Gemini rejects on the reader's *second* question, one
turn downstream of anything visible. `worker/tools.test.ts` pins the SDK
behaviour so an `ai` upgrade cannot quietly reintroduce it.

**`showGlobe` takes one zone, not a list.** The spec sketched
`showGlobe({ zones })`, which presumes the globe can pin a set. It cannot:
`GlobeHost.selectZone` sets *the* selected zone, and the clock panel beside it
already lists every plottable zone. A `zones` array would have kept only the
last entry — a tool argument the model believes in and the widget ignores is
worse than a narrower tool.

**`showPlayground` is cut, deliberately.** It is the only registry entry with any
reason to approach `playground-client.ts`'s `new Function`, and it would turn
"no eval anywhere in the dispatch path" from a fact into an argument — for the
least reader value of the five, since a citation already links to the playground
page. `widget-registry.test.ts` asserts the property by reading the source of
every file on the path.

**Code splitting holds.** The chat chunk grew 8 KB; d3-geo, world-atlas and the
Temporal polyfill stay in a separate 92 KB `globe` chunk, loaded only when a
widget mounts. The TypeScript compiler is absent from every client chunk, which
`client-graph.test.ts` now also asserts statically, without a build.

**A real gap in the visual harness, found the hard way.** A baseline and a
comparison taken ~30 minutes apart diverged by up to 1% on every light-theme page
carrying a globe, and the failing *set* varied between runs, which reads exactly
like flake. It was not. The diff image showed a crescent down the globe's
right-hand limb: the day/night terminator, whose position is computed from the
current time. No settle delay can fix that — two captures minutes apart are
*supposed* to differ. The globe canvas is now masked alongside the live clocks,
and the mask was confirmed to cover 100% of the region that was failing rather
than merely to turn the number green.

---

### Step 2 — ConverterBench extracted, and the parity guard

**The parity guard came first, and it should have been in the plan.** Step 1
left the model offered four tools with one registered, so Dox could promise a
DST inspector and the transcript would answer that the widget is not in this
build. `ENABLED_TOOL_NAMES` in `dox-tools.ts` is now the single declaration of
what may be offered; the Worker filters its tool set and its prompt section
through it, and a test asserts it equals the registry's keys exactly. Enabling a
tool without registering its widget now fails the suite instead of reaching a
reader. Every schema stays defined regardless, so each extraction ends in a
one-line change.

**`CodeFrame` was turned inside out, as designed.** `lib/code-frame.ts` owns the
markup; `CodeFrame.astro` is a `<Fragment set:html>` over it; every existing
`<CodeFrame id="…" />` call site is untouched. That also collapsed a real
duplication rather than relocating one — `widget-ui.ts` held the same copy/check
SVG paths as string constants, because `wireCopyButtons` swaps between them at
runtime, so the icon existed twice in two forms.

**`scripts/html-diff.mjs` is the gate that actually tests this refactor.** The
visual gate is a 0.2%-tolerance pixel diff by deliberate design and cannot see a
dropped `selected`, a reordered attribute or a missing `data-role` — each of
which renders identically and makes a control inert, since every lookup in these
widgets is a null-tolerant `q()`. The new gate compares built markup with
inter-tag whitespace normalised outside `<pre>`, and masks Vite's
content-addressed asset hashes (touching a shared module renames every chunk
that imports it, which is a build artifact, not a change to the page). It was
verified by deleting the `selected` attribute and watching it fail.

**ConverterBench now renders from `lib/converter-bench-mount.ts`**, and its page
is structurally identical to before — 135 lines of script and 78 of template
moved with no change to the built markup. `renderTemplate` takes the args, so a
seeded widget paints seeded on its first frame instead of flashing defaults; a
seeded zone outside the curated twenty is appended to the list rather than
silently falling back to the first option. Twelve jsdom tests drive it end to
end against the real library — the first DOM-testing pattern in `apps/dox`, and
the one the two harder widgets follow.

One thing worth carrying: `buildWorkerTools()` takes an optional name list so a
pending tool's `execute` stays tested before its widget is extracted. Production
must never pass it, and does not — `chat-handler.test.ts` asserts the offered
set equals `ENABLED_TOOL_NAMES`, so a stray argument fails there.

Gates after step 2: 604 tests across 40 files, `check`/`lint` clean, 646 pages
built, all three widget pages structurally identical, all 32 visual snapshots
within tolerance.

---

### Steps 3-4 — IntervalVisualizer and DstInspector extracted

Both followed the pattern ConverterBench set, and both pages are byte-identical.
The interval visualizer's six percentage-aligned timeline rows and the DST
inspector's 483-line script with pointer-capture drag and keyboard scrubbing
reproduced exactly, verified by `scripts/html-diff.mjs` rather than by eye.

**The scrub state needed no management, and that is worth recording.** This file
predicted `activeTransition`/`tickerWindow`/`handleMinuteOfDay` living outside
`render()` would be "the piece most likely to break silently under a React
re-render". It is not, and not by luck: `MountedWidget` renders an empty host and
never renders inside it, so there is no React re-render for closure state to be
lost across. The risk was removed structurally by the mount contract rather than
managed. There is a test that drags, forces an unrelated re-render mid-drag, and
confirms the drag survives.

**Two tests passed for the wrong reason and were caught.** The preset-switching
test asserted on `a-start`, which every preset in `buildRelationshipPreset` sets
to 2024-01-01 — it would have passed forever whether or not preset switching
worked. The DST drag test asserted on a coordinate that maps to exactly the
handle's starting position. Both now assert on values that actually move, and
the DST one lands inside the gap so it checks the widget's teaching point rather
than merely that something changed.

### The tool-parity guard

Step 1 left the model offered four tools with one registered, so Dox could
promise a DST inspector and the transcript would answer that the widget is not in
this build. `ENABLED_TOOL_NAMES` in `dox-tools.ts` is now the single declaration
of what may be offered; the Worker filters both its tool set and its prompt
section through it, and a test asserts it equals the registry's keys exactly.
Enabling a tool without registering its widget fails the suite instead of
reaching a reader.

### Standalone /tools pages — added 2026-09-10, outside the original plan

Two of the five interactive widgets were first-class `/tools` pages (the globe
and the scrubber); the other three were reachable only from inside a specific
function's reference page. Finding the DST inspector required already knowing
`getDstTransitions` exists, which is backwards — the inspector is how a reader
would learn that it exists.

`/tools/dst-inspector/`, `/tools/interval-visualizer/` and
`/tools/converter-bench/` now exist, each with its own framing rather than
borrowing context from the surrounding API docs. This was always possible — a
`/tools` page is frontmatter plus a component import — so the extraction work did
not unlock it; it was an information-architecture gap, not a technical one.

It does resolve something the permalink design left inconsistent.
`WIDGET_PAGE_PATHS` sent the globe's permalink to `/tools/zoned-earth/` and the
other three to reference pages, which resolved but landed a reader who clicked
"the view I was looking at" on a function's API documentation with the widget
partway down, reachable only via a heading anchor. All four now target a page
whose whole subject is the widget, and the anchors are gone because the widget
*is* the page.

**A security issue found while wiring this up, and introduced by DOX-C3b
itself.** Until the extraction these widgets were `.astro` templates, and **Astro
escaped every interpolation**. A hand-written template string does not — and the
values now flowing into these templates are the least trustworthy the widgets
have ever seen: chosen by a language model, or decoded from a URL a reader was
handed by someone else. `escapeHtml` was no help, because it leaves quotes alone
and every one of these values lands in an HTML attribute. `escapeAttr` was added
and applied at every interpolation, with tests that fail when it is removed.

`seedFromLocation` reads a `?w=&wa=` permalink on each widget's page bootstrap.
Its checks are structural rather than a zod parse, deliberately: this entrance
runs on a documentation page, which must not drag `zod` — and through
`dox-tools.ts`, the whole `ai` package — into its bundle to read four query
parameters. The escaping is what makes it safe; the checks stop a nonsense value
producing a confusing widget.

**`scripts/html-diff.mjs` now reports the widget and the page separately.**
Adding three sidebar entries changed Starlight's `sl-sidebar-state-persist` hash
on every page in the site — a real change, correctly detected, and nothing to do
with the extraction those pages police. The gate now distinguishes "the widget's
markup changed" (a failure) from "the widget is identical and the page around it
changed" (review, then re-baseline), instead of leaving that judgement to whoever
reads the output.

Gates: 657 tests across 44 files, `check`/`lint` clean, 646 pages built, all
three widget subtrees byte-identical, all 44 visual snapshots within tolerance
(10 pages, up from 5 before this story). The `/tools/dst-inspector/` permalink
was driven in a real browser: it seeds zone, year and preset, and the ticker
lands reading "01:00 — inside the overlap, this local time happens twice".

---

## Remaining work to close Tier 6 — written 2026-09-10, pre-publish

`DOX-C0`, `DOX-C1`, `DOX-C2` and `DOX-C3a` are done. Dox answers from the corpus, cites
pages that resolve, refuses honestly, and stays inside the free tier by failing over
between brains inside a single request. **The site is publishable as it stands** — what
follows is what is left, in the order it should be picked up.

### 0 · Publish (blocking nothing else, do it first)

Merging to `main` **is** publishing: `.github/workflows/deploy-dox.yml` fires on every
push to `main` with no path filter and no `workflow_dispatch`, and ships Worker + assets
in one `wrangler deploy`. There is no staging step and no way to trigger a deploy by
hand.

Pre-merge state, all verified 2026-09-10:

| Gate | Status |
| --- | --- |
| `pnpm --filter @gmt/dox test` | 477 passing, 28 files |
| `check` / `lint` / `oxfmt` | 0 errors, 0 warnings, clean |
| Worker bundle | 420.28 KiB gzip, against Cloudflare's 3 MB limit |
| Visual gate, 24 snapshots | all within tolerance; largest 0.069% vs 0.2% |
| `CLOUDFLARE_API_TOKEN` / `_ACCOUNT_ID` | provisioned (see `DOX-A.md`) |
| `NORTHGUILD_GMT_GEMINI_API_KEY` (prod) | set via `wrangler secret put` |
| `DOX_USAGE` KV namespace | created and bound in `wrangler.jsonc` |

Post-deploy smoke test, on the live URL rather than locally:

- `/dox/` loads, the mark lands, the composer accepts input.
- A real question streams a grounded answer whose citation opens the right page.
- `/api/brains` counts **move** after that question and survive a reload. This is the
  one thing that cannot be checked before deploy, because production KV is a different
  namespace from the preview one.
- The env badge reads `● live`.
- `curl -s <url>/dox/ | grep -c GEMINI` → `0`.

### 1 · `DOX_DEV_KEY` (small, unblocks the team)

Never set, so `isDevRequest` always returns false and the dev bypass is inert — the whole
team is capped at `VISITOR_DAILY_MAX` like any reader. `worker/dev-access.ts` is built and
has 13 passing tests; it needs only the secret:

```bash
cd apps/dox && npx wrangler secret put DOX_DEV_KEY   # production
# then the same value in apps/dox/.dev.vars for local
```

Then visit `/dox?key=<secret>` once per device. Note what this does **not** buy: exemption
from the per-visitor cap and manual brain choice, never a larger shared pool. Nothing at
the application layer can raise a project-wide free-tier ceiling.

### 2 · Brain-list maintenance (recurring, cheap)

`BRAINS` in `src/lib/chat-constants.ts` is the free tier's escape hatch: the quota id is
`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, so **every additional reachable model
adds its own 20/day**. Confirmed against the live API on 2026-09-10 — a `429` naming the
model in its own `quotaDimensions` proves reachability exactly as well as a `200`.

Re-run this whenever answers start getting scarce, and after any Gemini release:

```bash
cd apps/dox && source .dev.vars
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$NORTHGUILD_GMT_GEMINI_API_KEY" \
  | grep -o '"name": "models/gemini[^"]*"' | sort -u
```

Three traps found doing this, each of which produced a convincing false negative:

- **`wrangler dev` overwrites `cf-connecting-ip`.** Probing a dozen models in a loop with
  a different spoofed IP per request does *not* give you a dozen visitors — the runtime
  sets that header itself, so every probe shares one visitor identity and the run dies at
  `VISITOR_DAILY_MAX`. The refusals look exactly like model failures. Raise the cap for
  the duration of the probe (`wrangler dev` hot-reloads on save) and put it back after.
- **A flapping `wrangler dev` produces false negatives.** `503 Your worker restarted
  mid-request` reads exactly like a dead model. Two causes seen: building `@gmt/dox`
  without its `@northguild/gmt` dependency (`pnpm --filter "@gmt/dox..." -r run build`,
  note the `...`), which leaves esbuild unable to resolve the import and kills the server;
  and two `wrangler dev` instances fighting over one port. Check `pgrep -cf "wrangler dev"`
  returns exactly 1 before believing any result.
- **Read the state, not the response.** `GET /api/brains` reports each brain as `ok`,
  `spent` or `unavailable`, and that distinction is the whole answer: `spent` is a 429,
  which *proves the model exists and has a free allowance*, while `unavailable` is a
  404/400 and means it is not callable at all. A brain that merely fell through to another
  tells you nothing about which of the two it was.

The 2026-09-10 probe settled the list at **nine brains** (~165 requests/day): eight Flash
and Flash-Lite models, plus `gemini-3.1-pro-preview`, which answered 429 and is therefore
real. Three candidates were dropped on a 404/400: `gemini-2.5-flash-lite`, `gemini-2.5-pro`
and `gemini-2.5-flash` — the last confirming `DOX-C2`'s finding that it is closed to new
keys. Also excluded: the `-latest` aliases (unknown whether the quota bucket follows the
alias or its target — a badge that lies is worse than a shorter list) and every non-text
model. Full reasoning lives in that file's docstring.

**Keep `VISITOR_DAILY_MAX`'s arithmetic in step with the list.** It is currently 5 against
a pool of ~165/day. The two numbers drift apart silently, and that cap is the only thing
between one enthusiastic reader and everybody else's day.

### 3 · `DOX-C3b` — the widget registry (the whole of what is left)

This is a story, not a finishing pass, and its own spec understates it. Scoping on
2026-09-10 found:

**The stated step 1 is the easy part.** All three widget scripts already factor cleanly
into a container-scoped `setupWidget(container, …)` — they use a local
`q(role) => container.querySelector(...)` helper, attach listeners only inside their
container, and their bootstraps already loop `document.querySelectorAll(...).forEach(...)`,
so they are multi-instance-safe today. Extracting `mount(root)` is close to mechanical.

**The real work is markup provenance, which the spec does not mention.** All three widgets
are ~100% server-rendered Astro; the scripts build result rows and chips, never controls.
Every `<select>`, `<input>`, slider handle and `CodeFrame` comes from the `.astro`
template. So `mount(root)` alone does **not** make them React-mountable — something must
produce the markup it expects to find. Three options:

1. **Template string inside the mount module** (the `initScrubber` shape). One source of
   truth, but it converts SSR HTML into client-generated HTML, which breaks this story's
   own "byte-identical Tier 2 pages" DoD line and loses pre-JS readable markup.
2. **`mount(root)` requires pre-existing markup**, React renders it as JSX. Tier 2 pages
   are untouched, but the markup exists twice and drift is silent — a missing `data-role`
   just makes a control inert, because every lookup is a null-tolerant `q()`.
3. **A shared `renderTemplate(): string`** used by both — `.astro` does
   `<Fragment set:html={dstTemplate()} />`, the panel does `root.innerHTML = dstTemplate()`
   before `mount(root)`. **Recommended:** the only option that keeps SSR *and* one source
   of truth. Decide this before writing any code; everything else is downstream.

**Four cross-cutting items, roughly two-thirds of the effort:**

- `CURATED_TIMEZONES` lives in `scripts/build-utils/build-utils.ts`, which does
  `import ts from "typescript"` at the top. It is currently tree-shaken out because only
  Astro frontmatter reaches it. A client-side template that references it risks dragging
  the TypeScript compiler into the browser bundle — **extract it (and ConverterBench's
  `LOCALES`) to a client-safe `src/lib/` module first.**
- `mount()` must return a `destroy()` handle in the shape of `GlobeHost`/`ScrubberHost`.
  React StrictMode double-invokes effects, so mount-without-cleanup double-wires
  `wireCopyButtons` and every control listener on day one.
- **`apps/dox` has no DOM-test environment.** Existing widget tests are pure logic. The
  DoD lines about nonsense arguments and keyboard operation need jsdom set up, which is
  likely larger than the extraction itself.
- `playground-client.ts`'s `evaluateArg` uses `new Function`. The three widgets never call
  it, but keep it off `showPlayground`'s path or the "no `eval` anywhere in the registry
  or its dispatch path" DoD line becomes an argument.

Difficulty, per widget: **ConverterBench easy** (135-line stateless script, no drag, no
keyboard — do it first as the pattern-setter). **IntervalVisualizer medium** (342 lines,
cleanest architecture, but six precisely-aligned timeline rows are easy to get subtly
wrong by hand). **DstInspector medium-hard** (483 lines, pointer-capture drag plus
keyboard scrubbing, and cross-render scrub state deliberately owned outside `render()` —
the piece most likely to break silently under a React re-render). It also cannot be
deferred: the spec's motivating example, *"what happens to 1:30am on November 3rd in New
York"*, is exactly this widget.

Closing `DOX-C3b` also closes `DOX-E1a`'s last open DoD item — the globe in the `/dox`
rail — and with it `#139` and `#142`. See the pickup note above.

### Not doing

- **The every-page draggable dock.** Cut; see the `DOX-C3a` amendment above for the
  reasoning and the honest cost.
- **A custom domain.** Launching on `gmt-dox.northguild.workers.dev`; `astro.config.mjs`'s
  `SITE` already matches.
- **`DOX-C4` (Cloudflare AI).** A separate issue (#240) and explicitly deferred — Gemini
  first. Now the next story; see the section below for what it inherits.

---

## Live verification — 2026-09-10

The `DOX-C3b` DoD line that footnote 5 held the story open for — *a real question, to a
real brain, mounting a real widget* — is **met for all four widgets**, against live Gemini
brains through `/api/chat`. It also surfaced two defects that no unit test could have
caught, because both live in the gap between what the model sends and what the widgets
were built to receive.

### 1 · The interval widget drew every seeded value on one pixel

**Symptom.** The widget mounted with correct inputs and correct numeric outputs, and drew
a flat line. Nudging the relationship preset "fixed" it. The obvious reading — a stale
render, or seeded values arriving after the first paint — was wrong on both counts, and
there is no React in this path to re-render at all.

**Cause.** `TIMELINE_START` / `TIMELINE_END` hard-coded the canvas to calendar 2024. A
two-hour meeting is **0.0228%** of a year, floored to the 0.5% minimum bar width; all four
handles landed within 0.035% of each other. The render was arithmetically perfect on a
366-day ruler. The axis labels gave it away — `Jan 2024 · Jul · Dec` above a 9am meeting —
and the preset toggle never repaired the render, it **replaced the data** with the
preset's own year-scale values.

**Why the fixed canvas could not simply become a fitted one.** The five relationship
presets are composed against that canvas, and `disjoint` occupying only the left
two-thirds is *information*: holding the frame of reference still is what makes switching
presets comparable. Refitting per preset would destroy the teaching value of the reference
pages.

So the canvas became a value (`TimelineScale`) rather than a constant. Presets restore
`FIXED_YEAR_SCALE`; seeded and typed values call `fitTimelineScale`, which pads 10% each
side so the handles stay draggable. Drag snap and keyboard step derive from the span
rather than being pinned at a day — which is what keeps the fixed-year case *identical*
(366 days / 200 lands on the 1-day rung) while giving a three-hour canvas a one-minute
step instead of an unusable one-day one. Measured drift across all 5 presets × 4 values:
**0.000000%**.

**A test passed while the bug was present.** `draws the timeline bars` asserted
`width !== "0%"`; the bug produced `0.5%`. It is now asserted as a *readable* width, and
verified to fail when only the fit is reverted and the render kept — the true old
behaviour. This is the third test in this story found to pass for the wrong reason; the
pattern each time was asserting on a value that survives the defect rather than on the
one the defect changes.

**Markup impact.** One attribute, `data-role="axis"`, so the labels can follow the canvas.
The three span texts are unchanged for the fixed year and pinned by a test. **`html-diff`
and `visual:diff` have not been re-run since** — that is the one gate still owed.

### 2 · The system prompt was suppressing tool calls

Live probing of starter-button candidates, 3 attempts each across three brains:

```
GLOBE      1/3
CONVERTER  0/3
```

Zero for three on a question matching `showConverterBench`'s `Call when` line almost word
for word. The per-tool copy was not at fault — this line above it was:

> Prefer prose. Call a tool only when seeing the thing beats reading about it.

It made every call a judgement the model kept declining. Rewritten to key off the
`Call when` lines instead. Every safety property is unchanged and now *individually*
pinned by `system-prompt.test.ts`: prose-first, never tool-only, one tool per turn, never
invent a zone, no default widget when nothing matches — plus a test asserting the old
wording cannot return.

**Not empirically re-measured.** `VISITOR_DAILY_MAX` is 5 and diagnosis spent ~46
requests; the 0/3 converter probe needs re-running before this is called fixed.

### 3 · Starter buttons became the widget-discovery surface

The four pills on the empty screen are now one per enabled widget, as structured data
(`CHAT_STARTERS` in `chat-constants.ts`) rather than strings, so `chat-starters.test.ts`
asserts the mapping is **total**: enabling a fifth tool without adding a pill fails the
suite. Same parity contract as `ENABLED_TOOL_NAMES` ↔ the registry, for the same reason —
a widget no reader can discover may as well not ship. `widget` is intent, not a guarantee:
tool choice belongs to the model, and the deterministic mounts remain the `/tools` pages.

### Also confirmed clean

- **`isValidZonedDateTime` is not at fault** in either the original interval bug or this
  one. It answers "is this a valid `ZonedDateTime`?" correctly; the widget was asking a
  stricter question than it meant to (`Instant.from` requires an explicit offset).
- **The DST inspector has the same shape of hazard and does not have the bug.** Verified
  three ways: the library's `getDstTransitions` always returns absolute `…Z` instants; a
  20-combination sweep (5 zones × 4 presets) is clean; and it has no free-text date input.
  `buildZonedValueFromMinutes` deliberately omits an offset — adding one fails 4 tests,
  because resolving the ambiguity is precisely what `startOfZoned` exists to demonstrate.
  Three guard tests now pin both invariants.


---

## DOX-C4 — Cloudflare Workers AI (#240)

Next story. The motivation is budget: Gemini's free tier is
`PerDay·PerProject·PerModel`, which is why Dox carries nine brains and a KV ledger to
fail over between them mid-request. Workers AI is expected to lift that ceiling far
enough that the whole failover apparatus becomes optional rather than load-bearing.

**Start with a spike, not a migration.** Three things have to be true before any of the
Gemini path is touched, and none of them is known yet:

1. **The AI SDK's Workers AI adapter behaves like the Google one at the seams Dox
   actually uses.** `DOX-C1` picked the Vercel AI SDK partly *because* it has a Workers
   AI adapter where TanStack AI does not — but "has an adapter" was a selection criterion,
   never an exercised path. The seams that matter: streaming through
   `toUIMessageStream`, tool calls arriving as `tool-input-available` with parsed input,
   and `await result.warnings` forcing the upstream call before the UI stream opens, which
   is the entire mechanism behind in-request failover.
2. **Tool calling works at all, and works often enough.** This is the sharp one. Dox's
   four widgets are driven purely by the model choosing to call a tool, and the
   `Call when` instruction was tuned against Gemini — see "Live verification" above,
   where a single sentence took the converter bench from firing to not firing. That
   tuning does not transfer. **The 0/3 converter probe is the carried-forward
   measurement**, and it has to be re-run per candidate model, not once.
3. **Retrieval and grounding survive a smaller model.** The system prompt is large:
   vocabulary, core rules, and up to 15 retrieved chunks. A model with a shorter context
   or weaker instruction-following may ground worse, hallucinate links the allowlist then
   strips, or refuse where Gemini answered. The refusal instruction and the link
   hardening are the two behaviours to spot-check hardest, because both fail *quietly*.

### Carried forward from DOX-C3

- **Re-measure the tool-call instruction.** The `## Available tools` block was rewritten
  after live probing and the fix was never re-measured — `VISITOR_DAILY_MAX` is 5 and the
  day's budget went on diagnosis. Re-run the converter probe (3 attempts, 3 brains) on
  Gemini to confirm the rewrite landed *before* changing provider, so the two variables
  do not move at once.
- **`DOX_DEV_KEY` is still unset**, which is what made the budget the binding constraint
  in the first place. Setting it is the cheapest unblock for every live check this story
  needs, and it is a prerequisite rather than a nice-to-have here.

### Keep, whatever the provider

The brain-selection UI, the KV ledger and the visitor cap are provider-shaped but not
provider-specific, and the failover seam (`openFirstWorkingBrain`) is worth keeping even
against a generous quota — it is also how a model that rejects a tool schema is survived,
which is a failure mode that gets *more* likely with a new provider, not less.
