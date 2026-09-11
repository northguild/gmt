# Dox — as built

What `apps/dox` ships, tier by tier: the decisions with their one-line reasons, the rules
that bind future changes, the traps, and the runbooks. Every story is done; status is in
[tracker.md](tracker.md). The history of how each tier got here lives in git, not here.

## Rules that bind every change

- **`apps/dox` must not perturb `packages/gmt`.** `pnpm run validate` stays green,
  including the 20-cell GMT timezone matrix. No changesets unless a change also touches
  `packages/gmt`.
- **Merging to `main` deploys.** `deploy-dox.yml` runs on every push to `main`, with no
  path filter and no manual trigger.
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
  `LIVE_PLAYGROUND_TEMPLATES`. Outputs are gitignored under `src/generated/` and rebuilt by
  `pnpm run generate`, which runs before `test`, `check` and `build`.
  - `@example` is one inline line, `fn(args) // result (note)`, split on `/\s+\/\/\s/`. The
    one multi-line example is `getDstTransitions`.
  - `plain/calculate/weekOfYear.ts` is the only file exporting two functions.
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
  (`renderWidgetOutput` in `src/lib/widget-ui.ts`).
- **Teaching widgets:** DST inspector (`B2b`), interval visualizer (`B2c`), and the converter
  bench with format and regex tester (`B2d`). Each is a `src/lib/<widget>-mount.ts` exporting
  `renderTemplate(args)` and `mount(root, args)`. The `.astro` shell server-renders the
  template with `<Fragment set:html>`, and the `/dox` rail string-mounts the same markup.
- **Tool pages:** `/tools/dst-inspector/`, `/tools/interval-visualizer/`,
  `/tools/converter-bench/`, plus the Tier 4 `/tools/zoned-earth/` and `/tools/zone-planner/`.
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
  ~ only the page around it did); `visual:diff` is the pixel gate.

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
| Retrieve → assemble prompt → in-request failover | pool spent → `429` with the soonest refill |
| Stream: `createUIMessageStream` writes the retrieval trace part, then merges `toUIMessageStream` (`sendReasoning: false`, `onError` on both layers) | mapped error text, never a raw upstream payload |

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
- **Brain menu, reset clock, header clock:** see design-system.md "The composer control bar".
- **Not wired:** `sources.tsx` / `inline-citation.tsx` — the hardened inline links are the
  citations.

### Widget tools

- **Four tools**, schemas shared by client and Worker in `src/lib/dox-tools.ts`:
  - `showGlobe({ zone })`
  - `showConverterBench({ value, from, to, locale? })`
  - `showIntervalVisualizer({ aStart, aEnd, bStart, bEnd })`
  - `showDstInspector({ zone, year, preset?, disambiguation?, offset? })`
- **Parity:** `ENABLED_TOOL_NAMES` equals the widget registry's keys
  (`widget-registry.test.ts`), and every enabled tool has a `CHAT_STARTERS` pill
  (`chat-starters.test.ts`). A tool nobody can mount or discover cannot ship.
- **Worker tools carry a trivial `execute`** (no I/O) in `worker/tools.ts`. Without one, a
  replayed turn has a tool call with no tool result, which the provider rejects on the
  reader's next question (`tools.test.ts`). `convertToModelMessages` runs with
  `ignoreIncompleteToolCalls: true`.
- **One step** (the default `stopWhen`): the tool runs inside step 1, so no second upstream
  call happens after headers are sent.
- **The client never trusts tool input.** `widget-registry.ts` re-validates at mount and
  checks IANA zones with gmt's `isValidTimeZone`; a nonsense zone renders an error state.
  The registry is fixed and typed, with lazy `import()` and no `eval` or dynamic code on the
  path. `showPlayground` was cut to keep that true.
- **`MountedWidget.tsx`** renders an empty host, and the widget's DOM lives outside React.
  An `AbortSignal` handles StrictMode's double effect.
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
  - `maxRetries: 1`: backoff is pointless against a daily quota.
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
