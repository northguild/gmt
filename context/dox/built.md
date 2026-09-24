# Dox — as built

What `apps/dox` ships, tier by tier: the decisions with their one-line reasons, the rules
that bind future changes, the traps, and the runbooks. Every story is done; status is in
[tracker.md](tracker.md). The history of how each tier got here lives in git, not here.

## Rules that bind every change

- **`apps/dox` must not perturb `packages/gmt`.** `pnpm run validate` stays green,
  including the CI timezone matrix (10 zones × Node 22/24/26 — see README). No changesets unless a change also touches
  `packages/gmt`.
- **Merging to `main` deploys.** `deploy-dox.yml` runs when the Release workflow finishes
  on `main`, which Release does on every push, so every merge still deploys, after its
  release tag exists. It checks out the commit Release ran on, with every tag. A daily
  schedule and `workflow_dispatch` also deploy. If Release ever stops running on pushes,
  merges stop deploying.
- **Generate, don't maintain.** `scripts/build-reference.ts` is the single extraction.
  Never re-derive pages, corpus, manifest or playground seeds by re-walking source or
  re-parsing MDX.
- **Import `@northguild/gmt` at module granularity only** (`@northguild/gmt/plain/calculate`).
  Per-function paths are forbidden by the exports map, and namespace barrels re-export the
  2.98 MB Temporal polyfill.
- **Counts drift.** Derive them from source and assert them in tests; never hardcode them.
- **Tests never touch the network, and never spend AI budget.** `src/test/no-network.mjs`,
  preloaded into every test worker through Vitest's `execArgv`, blocks every non-loopback
  connection before any test code loads. Fake the model
  (`MockLanguageModelV4`), the `AI` binding, and `fetch`. Only `pnpm dev`, `pnpm dev:chat`,
  `scripts/probe-brains.ts` and real readers spend quota.
- **React lives only inside `/dox`.** Every other page is Astro plus plain-DOM modules.
- **Restyle native controls; never rebuild them from `div`s.**
- **Every tier after Tier 1 stays droppable**, and the docs work with the chat deleted.
- **No `octane` or `@octanejs/*`**, anywhere.

---

## Tiers 0–1 · Site, generator, AI surface, brand, guides

`DOX-A1`, `A2`, `A3a`, `A3b`, `A5`, `A4a`

- **Workspace.** `apps/dox` (`@gmt/dox`, private) runs Astro 7 + Starlight and depends on
  `@northguild/gmt` via `workspace:*`. It extends `astro/tsconfigs/strict`, never
  `tsconfig.base.json` (whose `composite`, `emitDeclarationOnly` and `customConditions`
  are wrong for an app), and declares `engines.node >=22.12.0` — Astro 7's floor.
- **Toolchain traps.**
  - The shell uses `fnm`: `eval "$(fnm env)" && fnm use`. `fnm use` alone is a silent
    no-op in a non-interactive shell.
  - Starlight's `@astrojs/markdown-remark` peer is optional; don't declare it. `satteri` is
    pinned through `packageExtensions` in `pnpm-workspace.yaml`.
  - pnpm 10 does not run `pre`/`post` scripts, so steps are chained with `&&`.
  - `oxlint.config.js` is never loaded, so lint runs from the app. `.oxfmtrc.json`'s
    overrides are an allow-list that includes `apps/**`.
  - `workerd` needs `allowBuilds`.
- **Deploy.** Worker `gmt-dox` on `*.workers.dev`, via `cloudflare/wrangler-action`, with
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repo secrets. The Worker serves
  `dist/` through the `ASSETS` binding (`not_found_handling: "404-page"`). A request
  matching a static asset is served before the Worker script runs, so only `/api/*`
  reaches it.
- **Generator (`A3a`).** `scripts/build-reference.ts` uses the TypeScript compiler API
  (not TypeDoc) and emits one MDX page per exported function plus module index pages,
  `gmt-corpus.json`, a typed route manifest (`ReadonlySet<string>`) and
  `LIVE_PLAYGROUND_TEMPLATES`. Outputs live under `src/generated/` and are rebuilt by
  `pnpm run generate`, which runs before `test`, `check` and `build`. The directory is in
  `.gitignore`, but `reference/corpus.ts`, `reference/gmt-corpus.json` and
  `reference/route-manifest.ts` predate that rule and stay tracked, so regenerating them
  produces a diff to keep. The MDX reference pages are ignored and untracked.
  - It skips when the content hash in `src/generated/reference/.inputs-hash` matches (gmt
    source, the `exports` map and the generator itself), and otherwise writes only changed
    pages and deletes only stale ones (`scripts/build-utils/generated-files.mjs`). Never go
    back to `rm -rf` + rewrite: every file event reaches `astro dev`, VS Code's watcher and
    its TypeScript server.
  - `@example` is one inline line, `fn(args) // result (note)`, split on `/\s+\/\/\s/`. The
    one multi-line example is `getDstTransitions`.
  - `plain/calculate/weekOfYear.ts` is the only file exporting two functions.
  - **Unreleased badge.** The site deploys from `main`, but npm moves only when a human
    merges a release PR. A reference page whose export is not in the newest stable
    `@northguild/gmt@X.Y.Z` tag gets a caution aside naming that version, and a sidebar
    badge. A module or namespace group gets the badge too when every page in it is
    unreleased. `scripts/build-utils/released-exports.ts` reads the names with `git grep` at
    the tag. With no tags (a shallow checkout) nothing is badged. The tag is part of the
    input hash, so a release regenerates. A push that publishes needs its tag before the site builds,
    which is why `deploy-dox.yml` runs after the Release workflow (PR #280); otherwise what it
    released stays badged until the next deploy. Locally the new tag does not exist yet, so a branch's new
    functions show the badge.
  - Two exports whose page paths differ only by case (a `DwellTime` type beside a `dwellTime`
    function) are one file on macOS and Windows, so one page overwrites the other and the
    sidebar points at a missing slug. The generator refuses such a pair before writing, and
    `reference-corpus.test.ts` checks the manifest. The fix is a rename in `packages/gmt/src`.
  - The source has no `@category` / `@see` / `@since` tags. Taxonomy comes from the
    directory tree, cross-links from signature types. `src/regex/*` documents with `//`
    comments, not JSDoc.
  - The hard part is signatures, options objects (`startOfZoned`'s is the reference case)
    and the public type pages — not the example parser.
- **AI surface (`A3b`).** `llms.txt`, `llms-full.txt` and a raw `.md` route with "copy as
  markdown" for every page, emitted from the corpus rather than via a rendered-MDX plugin.
  Every URL is in the route manifest.
- **Brand (`A5`).** A token layer mapped onto Starlight's variables; JetBrains Mono for body
  and code; a display face for headings only; self-hosted fonts; body text ≥ 7:1; amber
  reserved for the sentinel. See [reference/visual-design.md](reference/visual-design.md)
  and [reference/design-system.md](reference/design-system.md).
- **Guides (`A4a`).** Ported, not rewritten: `packages/gmt/README.md`'s Quick Start,
  `docs/dst-disambiguation.md`, and the domain `SKILL.md` Core Patterns. Maintainer and
  contributor skills are excluded.

## Tier 2 · Widget platform

`DOX-B1a`, `B2a`–`B2d`

- **Playground on every example.** The generator renders the first `@example` as a static
  block — for no-JS and Pagefind — plus one `PlaygroundForm.astro` seeded from
  `LIVE_PLAYGROUND_TEMPLATES`. The textarea evaluates the reader's expression with
  `new Function` against the real library. `GMT_MODULES` (`src/lib/gmt-modules.ts`) holds
  module-granularity dynamic imports, so gmt chunks load only where a playground renders.
- **Sentinel-aware output everywhere.** `""` / `null` / `false` / `[]` from invalid input
  renders as `⟨ NO SIGNAL ⟩` in amber, and a correct empty result is shown distinctly
  (`renderWidgetOutput` in `src/lib/widget-ui.ts`). In the playground,
  `classifyPlaygroundResult` (`src/lib/playground-client.ts`) makes that call for every
  form. The generator classifies `object | null` returns as `object`, from the TypeScript
  type flags rather than the printed type. `null` is the sentinel for every kind unless the
  function is in `NULL_IS_EMPTY` (`scripts/build-utils/null-is-empty.ts`), the interval
  functions whose `null` also means "no shared span". Those render `null` as empty. The
  generator refuses an entry that is missing or not an object.
- **Teaching widgets:** DST inspector (`B2b`), interval visualizer (`B2c`), the converter
  bench with format and regex tester (`B2d`), the Dwell Ledger (TRAN-8, the first a realm
  story shipped; its day cells come from Temporal's `startOfDay`, so a 23-hour day is drawn
  23 hours wide), and the Free Time Ledger (INT-12, the same day grid with each day coloured
  as the tariff reads it; it imports the Dwell Ledger's grid helpers rather than copying them). Each is a `src/lib/<widget>-mount.ts` exporting
  `renderTemplate(args)` and `mount(root, args)`. The `.astro` shell server-renders the
  template with `<Fragment set:html>`, and the `/dox` rail string-mounts the same markup.
- **A widget that cannot load says so.** A mount whose `GMT_MODULES` import fails throws
  `WidgetLoadError` (`src/lib/widget-mount.ts`); it never returns an inert handle, which
  left controls that looked live and did nothing. Every `.astro` shell — the five teaching
  widgets, the globe, the scrubber and the timezone map — catches its mount and calls
  `showUnavailable(root, error)`: `data-state="unavailable"` dims and disables the
  server-rendered markup (`gmt-widget.css`), and one amber notice offers a reload.
  `widget-load-error.test.tsx` runs every library-backed mount against a `GMT_MODULES`
  whose imports all reject.
- **Tool pages:** `/tools/dst-inspector/`, `/tools/interval-visualizer/`,
  `/tools/converter-bench/`, `/tools/dwell-ledger/`, `/tools/free-time-ledger/`, plus the Tier 4 `/tools/zoned-earth/` and `/tools/zone-planner/`.
  Permalinks (`?w=&wa=`) seed a widget through `seedFromLocation`, with structural checks
  rather than zod so a docs page never pulls in the `ai` package.
- **`escapeAttr` on every template interpolation.** Values come from a model or from a URL
  someone else wrote, and a hand-written template string escapes nothing.
- **Interval visualizer:** the timeline is a `TimelineScale` value. Presets use the fixed
  calendar-year scale, because switching presets is only comparable against a still frame.
  Seeded and typed values fit their own scale with 10% padding, and drag snap and keyboard
  step derive from the span.
- **DST inspector:** `getDstTransitions` returns `…Z` instants.
  `buildZonedValueFromMinutes` deliberately omits an offset — resolving the ambiguity is
  what `startOfZoned` exists to show.
- **Gates:** `scripts/html-diff.mjs` compares built widget markup (✗ the widget changed,
  ~ only the page around it did, + a new widget page with no baseline); `visual:diff` is the
  pixel gate.

## Tier 3 · HUD chrome

`DOX-D1`, `D2`

- **Glass:** `blur(24px) saturate(1.4) brightness(var(--gmt-brightness))` — `0.72` dark,
  `0.97` light, measured 11–16:1 for body text. A tinted fill, a hairline gradient border
  and a 1px inset highlight. The corner-bracket primitive exists but sits on no surface;
  there is no grain.
- **Focus:** a 2px cyan ring plus `gmt-focus-sonar`, one outward ping on focus
  (`.gmt-sonar-loop` is the unused looping form). The rotating conic border was removed —
  its rings read unevenly on wide, short controls.
- **Corners:** `corner-shape: bevel` with no `clip-path` fallback. Browsers without it get
  plain radius, and the `box-shadow` focus ring is never clipped.
- **Scrollbars** keep the chunky `::-webkit-scrollbar` styling. `scrollbar-color` would
  override it wholesale in Chromium.
- **Motion:** none beyond the focus and tab sonar pings. The boot sequence, scroll reveal,
  scanline sweep and cross-document view transitions were removed because they flashed the
  deployed site on every navigation.
- **Accessibility:** `gmt-a11y.css` handles `prefers-reduced-transparency`,
  `prefers-contrast: more` and `forced-colors`; the global reset handles reduced motion.
- **Trap:** the package `build` waits on `typecheck`, so `astro sync` and `astro build` never
  race on the content-layer store.

## Tier 4 · Globe and scrubber

`DOX-E1a`, `E1b`

- **Globe (`src/lib/globe.ts`):** `d3-geo` `geoOrthographic` drawn to a canvas-2D context,
  not WebGL.
  - Why: keyboard selection comes free through the zone list, there is no WebGL to
    degrade from, it is ~1/5 the weight of a three.js scene, and the look is a grid globe,
    not a photoreal sphere. Revisit only if drag cannot hold 60 fps at 1× zoom after
    coarsening the land mesh.
  - Features: drag and inertia, zoom scalar `[1, 5]` (wheel, pinch, buttons),
    `land-110m`, a day/night terminator from the current instant, and an arrow-key
    `listbox` for zone selection.
  - `rAF` and the 1 s clock tick both stop on `visibilitychange`; reduced motion gives a
    static globe with selection still working.
  - Lazy-mounted by `IntersectionObserver`. No globe JS reaches reference pages (verified),
    and homepage Lighthouse matched a reference page.
  - Hosts: the landing hero, `/tools/zoned-earth/`, and the `/dox` rail via
    `mountGlobe` / `showGlobe`.
- **Zone coordinates** are vendored from tzdata by `scripts/prepare-tz-coordinates.mjs`.
  Refresh when tzdata releases.
- **Scrubber (`src/lib/multi-zone-scrubber.ts`, `/tools/zone-planner/`):** pinned zones move
  together along one slider, DST offset changes visibly bite, the configuration round-trips
  through a permalink, and a `datetime-local` input is the typed equivalent to dragging. It
  is not a chat tool.

## Tier 5 · Scenarios and pitfalls

`DOX-A4b`–`A4d`

- **Scenario pages** (`src/content/docs/scenarios/`): the naive approach → a live widget
  showing it break → why → the gmt approach → the same widget working.
- **Mistakes** (`src/content/docs/mistakes/`): the domain `SKILL.md` Common Mistakes, ported
  with severity and live proof.
- **A task-first "start here" index** driven by `packages/gmt/skills/_artifacts/domain_map.yaml`.

---

## Tier 6 · Dox, the chat

`DOX-C0`–`C4`

### Shape

- **One surface: `/dox`** (`src/pages/dox.astro`, `<DoxPage client:load />`), chrome-free,
  `noindex`, reached from the header's "Ask Dox" link.
  - There is no every-page dock: it would put React on every reference page to duplicate
    `/dox`.
  - The cost is that asking means leaving the page. Page context still follows through the
    referrer (see Retrieval).
- **Stack:** the AI SDK (`ai`, `@ai-sdk/react` `useChat`) and 12 vendored AI Elements
  components in `src/components/ai-elements/` (a shadcn registry, copied in).
  - Install one with `npx ai-elements@latest add <name>`. Bare `npx ai-elements@latest`
    installs all 48.
  - The CLI rewrites imports from `components.json`, so the repo keeps its `~/` alias and
    has no `@/`.
  - Streamdown renders replies. Code blocks keep copy and drop download.
- **Tailwind v4** exists only in the island. See [reference/design-system.md](reference/design-system.md).
- **Worker (`apps/dox/worker/`):** `POST /api/chat`, `GET /api/brains`; everything else goes
  to `ASSETS`.
  - The `.md` prompt sources load as Text modules (a `wrangler.jsonc` rule); Vitest
    mirrors this with a `markdownAsText` plugin.
  - `createChatHandler` takes vocabulary, core rules, model factory, ledger and clock as
    injected dependencies.

### Retrieval

- **Chunks** are built at `astro build` into `/retrieval-chunks.json`
  (`src/lib/retrieval/corpus.ts`): one per function (name, signature, description, examples,
  URL) and one per guide `##` heading (`github-slugger` anchors). Guides load through
  `import.meta.glob`, not `fs` — `fs` breaks once Astro bundles the endpoint. The Worker
  fetches the chunks same-origin, through the Cache API (`fetch-chunks.ts`).
- **Once per isolate, not once per request.** `fetchChunks` keeps the parsed array in
  memory for the Cache API's TTL (300 s) and returns the *same array* until it expires, so a
  warm request no longer re-parses 750 KB of JSON. `search.ts` memoises the MiniSearch index
  in a `WeakMap` keyed on that array; the build over 884 chunks measured 50–70 ms and was
  paid on every question. A new array — a test fixture or a refreshed corpus — always gets
  a fresh index, and `searchChunks` stays a pure function of its inputs.
- **Search:** MiniSearch BM25 (`src/lib/retrieval/search.ts`) with a stopword list,
  `MIN_RELEVANCE_SCORE`, and up to 15 chunks.
  - Without stopwords, "format a date for display" matched most of the corpus.
  - Without the score floor, off-topic questions got padded results.
  - The threshold is tuned to this corpus; re-verify it if the corpus or boosts change
    materially.
- **Namespace bias, not a filter.** `DoxChat` sends the same-origin referring page
  (`src/lib/page-context.ts`), and `worker/namespace-from-page.ts` turns
  `/reference/<ns>/…` or `/guides/<ns>/…` into a retrieval bias.
- **Why retrieval and not the whole corpus in the prompt:** the corpus is ~84k tokens.
- **Corpus counts on the empty screen** are generated (`scripts/build-corpus-counts.ts`) and
  checked by `corpus-summary.test.ts`.

### Request pipeline

`worker/index.ts` → `worker/chat-handler.ts`:

| Step | Failure |
| --- | --- |
| Method | `405` |
| Burst limiter — per isolate, 20/60 s; blunts casual abuse, not a determined attacker | `429` + `Retry-After` |
| JSON body | `400` |
| Envelope (zod) + `safeValidateUIMessages` with the real tool set; roles `user`/`assistant` only | `400` |
| Sanitise invisible characters, **then** apply length and conversation caps | `400` |
| Per-visitor daily cap (KV, hashed IP; dev cookie exempt) | `429` |
| No configured brain | `500` |
| Retrieve → assemble prompt | mapped error, never a raw upstream payload |
| Open the stream, then in-request failover, writing transient `data-status` progress per brain | pool spent, or every brain busy → transient `data-refusal` |
| Write the retrieval trace part, then merge `toUIMessageStream` (`sendReasoning: false`, `onError` on both layers) | mapped error text, never a raw upstream payload |

- **The stream opens before a brain is chosen.** Measured 2026-09-24: two busy brains
  took 2.8 s of a 6.7 s answer, and the reader saw nothing but "Searching corpus…". Now
  each step arrives as a transient `data-status` part ("3.8 Flash is busy — trying the
  next model…") and shows in the pending card.
- **A refusal is a transient `data-refusal` part** carrying the `{ status, payload }` the
  HTTP error used to (`RefusalData`, `src/lib/chat-types.ts`). `DoxChat` passes it to the
  same `classifyChatError`, so the warning, retry and reset time are unchanged. Transient
  parts never enter a message, so a refused request leaves no empty turn in the history
  (`DoxChat.progress.test.tsx`). What is known before the stream opens — the burst
  limiter, a bad body, the visitor cap, every brain already marked out — is still a plain
  HTTP error.

- **System prompt** (`worker/system-prompt.ts`), eight sections in order: Persona and
  scope · Standing order (the prompt-injection boundary) · Linking rules (only this
  answer's retrieved URLs) · Vocabulary (consumer `SKILL.md`s) · Core rules
  (`packages/gmt/README.md` §Core Rules) · Retrieved context · Available tools · Refusal
  instruction. The order is pinned by `system-prompt.test.ts`.
- **No provider flag restricts a model to a corpus.** Grounding is the prompt, the context
  and the refusal instruction.
- **Key custody:** keys live only in Worker secrets and `.dev.vars`, never in `dist/` or a
  response.

### Chat client

- **Transport:** `DefaultChatTransport` with `prepareSendMessagesRequest`, which sends
  `sendableHistory` (`src/lib/chat-history.ts` drops assistant turns that never got a
  token), the referring `pageContext`, and the picked brain.
- **Link hardening** (`link-components.tsx`, `resolve-href.ts`): `rehype-harden` plus a
  `components.a` override, which is the authority.

  | Link the model produced | Rendered as |
  | --- | --- |
  | Relative path in the route manifest | a link |
  | Absolute URL on our origin | origin stripped, then re-checked |
  | Relative path not in the manifest, a GitHub anchor, a `SKILL.md` heading | plain text |
  | External `https`/`http`/`mailto` on an allowlisted origin | a link |
  | `javascript:`, `data:`, unparseable | dropped |

  Bold phrases are never auto-linked.
- **Timeouts** (`use-idle-timeout.ts`): 90 s to the first output — failover plus a slow
  first token — then 30 s of silence between chunks, reset on every chunk.
- **Warnings are not errors.** A rate limit, a refused send or a stall renders a warning
  (`chat-warning.tsx`), not a message, so it never reaches the history. `retryable` drives
  "Try again".
- **Composer:** a real `<textarea>` from `prompt-input.tsx`. The vendored file defers
  `form.reset()` to the success paths so a refused send keeps the reader's text — keep that
  on any AI Elements re-sync.
- **Retrieval trace** (`RetrievalTrace.tsx`): chunk count and titles, zero for an
  out-of-corpus question, plus the brain that actually answered.
  - **Timings.** The Worker times each stage (`worker/timing.ts`): ledger, corpus, search,
    prompt, the walk across brains with each attempt's outcome, first token and total, and
    which widget tool was called. The part is written twice with one `id`
    (`RETRIEVAL_PART_ID`) — before the answer, then when it ends — and the SDK replaces it
    in place, so the transcript keeps one trace.
  - The same numbers go to the Worker log as one `dox-timing` line per answer, beside
    `dox-usage`. Read them there before tuning anything.
- **Brain menu, reset clock, header clock:** see design-system.md "The composer control bar".
- **Not wired:** `sources.tsx` / `inline-citation.tsx` — the hardened inline links are the
  citations.

### Widget tools

- **Six tools**, schemas shared by client and Worker in `src/lib/dox-tools.ts`:
  - `showGlobe({ zone })`
  - `showConverterBench({ value, from, to, locale? })`
  - `showIntervalVisualizer({ aStart, aEnd, bStart, bEnd })`
  - `showDstInspector({ zone, year, preset?, disambiguation?, offset? })`
  - `showDwellLedger({ entry, exit, zone, compareZone? })`: a zoneless wall time is read in
    `zone` with `disambiguation: "reject"`, so a skipped hour is never moved silently.
  - `showFreeTimeLedger({ clockStart, clockEnd, freeDays, firstDay, basis, chargeBasis, zone, weekend?, holidays?, tiers? })`:
    `firstDay`, `basis` and `chargeBasis` are required, as the library requires them; a zoneless wall time is
    read in `zone` with `disambiguation: "reject"`. Its permalink carries every list and number
    as a string, because `seedFromLocation` passes only strings and years.
- **Parity:** `ENABLED_TOOL_NAMES` equals the widget registry's keys
  (`widget-registry.test.ts`), and every enabled tool has a `CHAT_STARTERS` pill
  (`chat-starters.test.ts`). A tool nobody can mount or discover cannot ship.
- **A starter pill opens its widget on the click.** Each `CHAT_STARTERS` entry carries the
  `args` its question describes; the click sends the question and calls `onWidget` with
  them (`starterWidgetCall`), so the widget does not wait on a round trip or on the model
  choosing to call the tool. The model's own call replaces it unless `isSameWidget` says
  the tool and arguments match (key order ignored), which keeps anything the reader has
  already dragged. `chat-starters.test.ts` runs every seed through its schema and
  `validate`, so a seed that drifts from its tool fails the suite.
- **Worker tools carry a trivial `execute`** (no I/O) in `worker/tools.ts`. Without one, a
  replayed turn has a tool call with no tool result, which the provider rejects on the
  reader's next question (`tools.test.ts`). `convertToModelMessages` runs with
  `ignoreIncompleteToolCalls: true`.
- **One step** (the default `stopWhen`): the tool runs inside step 1, so no second upstream
  call happens after headers are sent.
- **The client never trusts tool input.** `widget-registry.ts` re-validates at mount and
  checks IANA zones with gmt's `isValidTimeZone`; a nonsense zone renders an error state.
  The registry is fixed and typed, with a literal `import()` per mount and no `eval` or
  dynamic code on the path. `showPlayground` was cut to keep that true.
  - **Template and mount load together**, from the one `import()`: an entry's `load()`
    returns `{ renderTemplate, mount }`. The registry imports only *types* from the mount
    modules. It used to import each `render*Template` as a value, which put every mount,
    each widget's logic and the Temporal polyfill in the `/dox` chunk and made every
    `import()` load nothing new. `widget-graph.test.ts` walks the island's static value
    imports and fails if one reaches a mount, `gmt-modules.ts`, a widget's logic, a direct
    polyfill import or gmt's root barrel. Chat code imports gmt by module path for the
    same reason: the root barrel re-exports the polyfill.
  - **The polyfill still ships with `/dox`,** through gmt itself: the header and reset
    clocks call `@northguild/gmt/zoned/get`, whose built chunk imports it
    (`get → zonedNowUnitValue → index.esm`). The exports map stops at module level, so
    there is no narrower import. Measured on the 2026-09-24 build, the first-load
    JavaScript went from ~755 KB to 722 KB gzipped; the widgets now load only when one
    opens.
- **`MountedWidget.tsx`** renders an empty host, and the widget's DOM lives outside React.
  An `AbortSignal` handles StrictMode's double effect.
  - The host is `aria-busy` (dimmed, inert) until the mount has wired it: a "Loading …"
    placeholder while the chunk loads, then the template.
  - A `WidgetLoadError`, or a failed `import()` of the mount module, shows the error with
    **Try again**, which clears the error and remounts. A bad argument or a mount that throws
    on its input gets no retry: the same input fails the same way.
- **Rail** (`WidgetRail.tsx`, AI Elements `Artifact`): opens for a tool call, collapses when
  empty, and has a copy-permalink button. The transcript's `WidgetReceipt` chip is a seeded
  link to the widget's tool page.
- **Tool prompt wording matters.** "When the question matches a `Call when` line, call that
  tool" works; "Prefer prose; call a tool only when seeing beats reading" took the converter
  to 0 calls in 3. Prose first, at most one tool, no default widget, never invent a zone.

### Brains and budget

- **`BRAINS`** (`src/lib/chat-constants.ts`), in preference order:
  - eight Gemini Flash / Flash-Lite models, ~20 requests/day each;
  - `gemini-3.1-pro-preview`, ~5/day;
  - `cf-glm-4.7-flash` on Workers AI, ~110 questions/day.
  
  That is ~275 questions a day in total.
- **Two kinds of allowance** (`BRAIN_PROVIDERS`):
  - **Gemini** — per project, per model, resets at midnight Pacific.
  - **Workers AI** — 10,000 Neurons/day per account, shared by every Workers AI model,
    resets at 00:00 UTC. On the Workers Free plan exhaustion fails rather than bills, so
    **stay on Free.**
- **Ledger (`worker/usage.ts`, KV `DOX_USAGE`):** advisory only — it drives the badge; the
  provider's error is the gate. A brain's `model:` and `state:` keys bucket by its
  provider's day and expire at its provider's midnight; the visitor cap stays on the Pacific
  day. Writes are best-effort, and visitors are hashed IPs.
- **Failover inside one request** (`openFirstWorkingBrain`, `worker/brains.ts`):
  - `await result.warnings` forces the upstream call before any stream opens.
  - That rejection is a contentless `NoOutputGeneratedError`, so `onError` captures the
    real provider error; unwrap `RetryError` and `NoOutputGeneratedError` before
    classifying.
  - 429 → `spent`; 404 / 400 (and a Workers AI 403) → `unavailable`; anything else
    rethrows.
  - Known-out brains are tried last, never pruned — the ledger can be stale.
  - Workers AI allocation exhaustion (3036, or the unmapped 4006) retires every Workers AI
    brain at once; a capacity 429 (3040) retires only that brain.
  - `maxRetries: 0`. The SDK's retry backs off from 2 s, which put a pause in front of
    every failover; the next brain is the retry.
  - **A busy model moves on, and is not marked.** Gemini answers 503 "This model is
    currently experiencing high demand" (seen 2026-09-24, on two brains in a row). That
    used to be rethrown, failing the whole answer. `isTransientOverload` (503, 529) now
    tries the next brain with outcome `busy` and writes nothing to the ledger; if every
    brain was out or busy, the last overload becomes a retryable refusal, not "allowance
    used". A 500 still stops at the first brain: an error in the request would fail on all
    of them.
- **Thinking level.** Each Gemini brain carries `thinkingLevel` (`chat-constants.ts`), passed
  as `providerOptions.google.thinkingConfig`. All are `"low"`: left unset, Gemini 3 thinks
  dynamically over the 10–16k-token prompt before its first token. A brain that stops
  calling its widget under `"low"` moves to `"medium"` on its own; confirm with
  `probe-brains.ts` after changing any.
- **Workers AI wiring:** `workers-ai-provider@4` over the `AI` binding (`remote: true`).
  - `worker/index.ts` offers only configured brains — Gemini needs the key, Workers AI the
    binding — so a missing provider shrinks the list instead of failing requests.
  - Each Workers AI brain sets `maxOutputTokens: 2048` (the default 256 truncates answers)
    and `reasoningEffort: null`.
  - Every answered request logs `dox-usage` with token counts.
- **Workers AI model choice** (probed 2026-09-11, 10–16k input tokens a question):
  - Kept: `glm-4.7-flash` — 4/4 widget calls, refuses, ~88 Neurons a question, but 6–24 s
    replies and occasional factual slips.
  - Dropped `qwen3-30b-a3b-fp8` and `llama-4-scout`: `workers-ai-provider@4.0.0` reads
    both `response` and `choices[0].delta` from one chunk, so text and tool arguments
    arrive doubled. Re-probe when the provider fixes it.
  - Dropped `gpt-oss-20b`: it writes tool calls as reply text.
  - Dropped `glm-5.3-flash`: Workers Paid only.
  - The cheapest lever for more Workers AI questions is a trimmed vocabulary for those
    brains — the `SKILL.md` text is the largest part of the prompt.
- **`VISITOR_DAILY_MAX` is 5.** Recompute it whenever `BRAINS` changes.

### Traps

- `/api/brains` must stay `private, no-store`: it carries one visitor's counts and dev
  status.
- `DoxChat.ssr.test.tsx` is what catches `window` during SSR; `astro check` and jsdom tests
  do not.
- Dates in the chat render after mount only — the server's zone and locale are not the
  reader's (#418).
- Tailwind's `dark:` must follow `data-theme`, or Shiki picks the wrong token colours.
- `wrangler dev` overwrites `cf-connecting-ip`, so every local request is one visitor —
  use the dev bypass.
- A `503 Your worker restarted mid-request` looks like a dead model: two `wrangler dev`
  instances, or a build without `@northguild/gmt`. `pgrep -cf "wrangler dev"` should be 1.
  Port 8787 may be taken; pass `--port`.
- Static assets bypass the Worker, so `?key=` only works on `/api/*`.
- AI bindings always run remotely: local chat spends the real Workers AI allocation.

### Runbooks

- **Vite scans `src/lib` at startup** (`optimizeDeps.entries`, `astro.config.mjs`). Astro
  scans only `.jsx/.tsx/.vue/.svelte/.html`, so packages reached from an `.astro` script
  (`@tanstack/charts`, `d3-geo`, …) were found when a page first imported them; Vite then
  re-bundled and force-reloaded every open page, and a widget chunk in flight failed with
  "Failed to fetch dynamically imported module". Keep the entries when adding a widget.
- **gmt is not pre-bundled in dev, on purpose.** A cold widget page wires in ~0.6 s with its
  ~117 gmt requests (measured 2026-09-24), and pre-bundling a linked package would need a
  dev-server restart after every gmt rebuild to avoid serving stale code.
- **Local dev:** `pnpm dox:dev` (site + chat Worker) or `pnpm dox:dev:site` (site only).
  A warm start is ~10 s: the gmt build is incremental (`build:dev`), every `generate` step
  skips when its inputs are unchanged, and `upstream refresh` makes no network calls
  while its live file is under 6 h old (`UPSTREAM_REFRESH=force`). No site build is
  needed — the Worker reads `/retrieval-chunks.json` from `astro dev` through
  `DOX_ASSETS_ORIGIN`. Content edits hot-reload; gmt source edits regenerate the
  reference in place (`src/lib/gmt-reference-watch.ts`); a new export needs a restart.
  `dev-all.mjs` only ever stops its own children. If another `astro dev` holds this
  project's lock (per project, not per port) it exits instead of replacing it — stop that
  one with `astro dev stop` first. A taken Worker port needs `DOX_WORKER_PORT`.
- **Local chat:** `pnpm dev:chat` (build, then `wrangler dev`), or `npx wrangler dev --port
  8799` with `dist/` already built. `.dev.vars` holds `NORTHGUILD_GMT_GEMINI_API_KEY` and
  `DOX_DEV_KEY` (`.dev.vars.example`).
- **Dev bypass:** `npx wrangler secret put DOX_DEV_KEY` in production, the same value in
  `.dev.vars` locally, then visit **`/api/brains?key=<secret>`** once per browser. It
  exempts you from the visitor cap, never from the shared pool.
- **Probe brains** (spends real quota):

  ```bash
  cd apps/dox
  npx wrangler dev --port 8799 --var DOX_DEV_KEY:probe --var NORTHGUILD_GMT_GEMINI_API_KEY: \
    > /tmp/dox-wrangler.log 2>&1 &
  npx tsx scripts/probe-brains.ts --base http://localhost:8799 \
    --log /tmp/dox-wrangler.log --out /tmp/probe.json   # --brains <ids> --attempts <n>
  ```

  Emptying the Gemini key keeps a failing Workers AI brain from falling back onto Gemini.
  The probe accepts only ids in `BRAINS`.
- **Refresh the Gemini list** after Google ships models: list them with
  `curl "https://generativelanguage.googleapis.com/v1beta/models?key=$NORTHGUILD_GMT_GEMINI_API_KEY"`,
  then probe.
  - A 429 proves a model exists exactly as well as a 200; drop anything that answers
    404 / 400.
  - Leave out the `-latest` aliases — it is unknown whose quota bucket they draw from.
- **After a deploy:**
  - `/dox/` loads, and a grounded answer's citation opens the right page;
  - `/api/brains` counts move and survive a reload;
  - the badge reads `● live`;
  - `curl -s <url>/dox/ | grep -c GEMINI` prints `0`;
  - the first deploy with the `ai` binding confirms the CI token may bind Workers AI.
- **Owed verification:**
  - `html-diff` and `visual:diff` after the interval visualizer's `data-role="axis"`
    attribute — both need a baseline captured from a clean `main` build;
  - the Tier 3 keyboard-only, reduced-preference and Firefox/Safari pass.

---

## Not doing

- **Chat:**
  - an every-page chat dock;
  - a scrubber or playground chat tool;
  - wiring `Sources` / `InlineCitation`;
  - React Query or TanStack Form (`useChat` covers both);
  - baking the whole corpus into the prompt;
  - auto-linking bold phrases;
  - a separate chat origin.
- **Site:**
  - TypeDoc;
  - Octane;
  - Nextra;
  - a custom domain;
  - per-page OG images;
  - a second discovery page beside the mentor index;
  - a feedback or analytics loop (it would need its own privacy and hosting decisions).
- **Motion and 3D:**
  - a boot sequence, scroll reveal, scanlines, view transitions, grain;
  - a WebGL or full-bleed 3D globe behind panels.
- **Audio and voice:** no browser exposes `speechSynthesis` output to Web Audio
  ([WebAudio#1764](https://github.com/WebAudio/web-audio-api/issues/1764),
  [mediacapture-main#654](https://github.com/w3c/mediacapture-main/issues/654)), so a
  synced voice visualizer is impossible.
