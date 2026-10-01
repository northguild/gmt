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
- **Minimum rendered text size 12px (0.75rem)**; enforced by `font-floor.test.ts`.

---

## Tiers 0–1 · Site, generator, AI surface, brand, guides

`DOX-A1`, `A2`, `A3a`, `A3b`, `A5`, `A4a`

- **Workspace.** `apps/dox` (`@gmt/dox`, private) runs Astro 7 + Starlight and depends on
  `@northguild/gmt` via `workspace:*`. It extends `astro/tsconfigs/strict`, never
  `tsconfig.base.json` (whose `composite`, `emitDeclarationOnly` and `customConditions`
  are wrong for an app), and declares `engines.node >=22.12.0` — Astro 7's floor.
- **Toolchain traps.**
  - Where `fnm` is installed, run `eval "$(fnm env)" && fnm use`. `fnm use` alone is a
    silent no-op in a non-interactive shell. Without `fnm`, the Node on `PATH` must match
    `.nvmrc`.
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
  23 hours wide), the Free Time Ledger (INT-12, the same day grid with each day coloured
  as the tariff reads it; it imports the Dwell Ledger's grid helpers rather than copying them),
  and the Billing Deadlines widget (INT-58, a day strip wrapped by ISO week, with the three
  windows around a demurrage or detention invoice — issue, dispute, resolve — as numbered,
  patterned lanes; it draws the deadlines `billingTimeline` returns and computes none. Past
  120 cells it collapses weeks with no marked date and says so), and the four multi-leg
  scheduling widgets (TRAN-9): the Delivery Scheduler, a multi-leg journey on one exact-time
  timeline, with a local-clock row per zone and an offset-table row where a fixed offset
  misreads a handoff; the Connection Checker, one handoff, with a handling-time slider, made
  or missed beside the times as printed; the Timetable Reader, printed wall times read
  through `startTimeZone`, with the earlier-or-later badge; and the Crossing Clock, exact
  elapsed hours beside the wall-clock difference, on an hour ruler. All four import
  `transport-widgets.ts`: they find the failing leg and every ready or departure instant by
  calling `scheduleDelivery` on prefixes and zero-length legs, never by arithmetic, and each
  computes one labelled naive value of its own. Each is a
  `src/lib/<widget>-mount.ts` exporting
  `renderTemplate(args)` and `mount(root, args)`. The `.astro` shell server-renders the
  template with `<Fragment set:html>`, and the `/dox` rail string-mounts the same markup.
  Three more (TRAN-10): the Cut-off Stack, a sailing's cut-offs from `cutoffSchedule` on a
  day timeline, closed days shaded, each rolled cut-off drawn where it landed with a line
  back to where `cutoffAt` without a calendar puts it; the Cut-off Ruler, one departure's "N
  days before" read three ways by `cutoffAt` (calendar days, exact hours, a pinned local
  time) with the DST change between them marked; the Cut-off Countdown, `isPastCutoff` and
  `timeToCutoff` against the viewer's clock or a dragged time, with the half-open rule shown.
  All three import `cutoff-widgets.ts` and load through `cutoff-lib.ts`; closed days come
  from `rollDate`, hours before a departure from `timeToCutoff`, and a moved cut-off from
  comparing `cutoffAt` with and without the calendar, never from arithmetic. The Countdown
  reads the clock only after mount and only in live mode; presets, permalinks with a `now`
  and the page's default are pinned.
  Their charts share one recipe sheet, `gmt-cutoff-widgets.css`:
  - **The surface:** bevelled tint-and-hairline chart panels with no `backdrop-filter`
    (never glass within glass).
  - **The marks:** `.gmt-cutoff-mark`, a glowing bevelled marker, with a hollow, dashed
    variant for an unrolled position; and `.gmt-cutoff-gate`, a bright line for a cut-off
    or departure.
  - **The text plates:** `.gmt-cutoff-chip`, an opaque `--gmt-surface` plate that every
    label inside a chart sits on, so no glyph touches a gradient, hatch or line.
  - **The `.gmt-cutoff-closed` hatch:** a teal hatch under a void veil, plus a "closed"
    chip, shared by the Countdown and the Stack.

  Each reading or cut-off carries `data-series="1"…"4"`, which sets `--series` from the
  site-wide `--gmt-series-*` tokens:
  - **Ruler:** calendar, exact and pinned are 1, 2 and 3.
  - **Stack:** `StackRow.series` is the matched entry's place in the `cutoffSchedule` call.

  The tools in turn:
  - **Countdown:** a display-font hero of the signed time left, formatted from
    `timeToCutoff`. Above the track sit a cut-off chip and a now chip, placed apart by
    `placeLabel`. The axis has 15- or 30-minute ticks for short windows (`walkTicks`'s
    `"minutes"` unit).
  - **Ruler:**
    - Gradient stems with glowing heads.
    - The DST change in the DST Inspector's convention: purple for a fall-back overlap,
      with a band as wide as the repeated hour, and gold for a spring-forward gap
      (`transitionKind`). Series 3 is also purple; a stem is solid and horizontal, the DST
      mark dashed, vertical and labelled.
    - A close-up with alternating hour bands.
    - Result cards with a series edge.
  - **Stack:**
    - Full-height glass day columns with header strips.
    - The departure drawn once as a gate with the ship icon.
    - A moved cut-off drawn as a hollow marker joined to the solid one by a dashed arc. The
      arc's `stroke-dashoffset` flow is the one animation in a cut-off chart, and it stops
      under reduced motion.
    - Under 34rem the table becomes stacked rows: a `data-label` on each cell, a visually
      hidden `thead`, and explicit ARIA table roles.
  Three more (TRAN-57): the Punctuality Board, planned/actual pairs as deviation bars on one
  axis centred on the plan, with the tolerance band's early and late edges as draggable
  handles that reclassify every row and the on-time rate live, and an optional second late
  tolerance side by side; the ETA Drift Chart, PLN/EST/REQ/ACT records plotted by when each
  was recorded against the time it predicts, with the `bestAvailable` pick beside a naive
  latest-recorded pick and an `estimateDrift` tolerance band on a range; the Departure Board,
  a timetable list or a service every N minutes on a time rail, with a draggable arrival, a
  hatched minimum-connection bar, the window's `to` drawn open, and a link that hands the
  departure made to the Delivery Scheduler. All three import `punctuality-widgets.ts` and load
  through `punctuality-lib.ts`. Every deviation, class, rate, pick, drift and departure is a
  library call. The naive values are the same calls on wall times read as UTC, the
  latest-recorded event, and `nextDeparture` without `minimumConnection`. A `""` from
  `nextDeparture` is invalid input or a correct "no departure left"; the widget tells them apart
  by probing the library, and only invalid input renders `NO SIGNAL`.
  `cutoff-widgets.ts`'s `callSource` prints only cut-off shapes (its key table drops any other
  key), so these three print calls and results with `formatValue`/`callArgs` from
  `punctuality-widgets.ts`.
- **Tools, scenarios, guides and mistakes carry an industry tag.** A page's frontmatter lists
  its `industries` (`src/content.config.ts`), and the `PageTitle` override renders them under
  the title as `IndustryTags.astro`: an icon and a word, one style for every industry, no colour
  per industry. A tag is a label, not a link. The tags are the library's industry layers one to
  one (`gmt-stats.json` `industries`) plus `core` for a page about core functions only;
  `src/lib/industry-tags.ts` holds each tag's label, one-line definition and icon. A tag is the
  layer the page's functions come from, so the Dwell Ledger is Transport (`dwellTime`), and its
  chat-rail area matches. Index pages carry no tag. The Markdown export states the same thing
  as an `Industry:` line under the title (`pageToMarkdown`), so a tool page names its industry
  once, from its frontmatter, and `ToolLayout` takes only a use case. `/tools/` lists the tools
  by industry; `scripts/build-tool-index.ts` generates it from the same frontmatter as plain
  Markdown (gitignored, like the scenarios index). `industry-tags.test.ts` fails when a shipped
  layer has no tag, when a page in one of those four sections has none, or when a tag names a
  layer the page does not use. A new industry is one entry in `industry-tags.ts` and one icon;
  it gets a tag when its first page ships, not before.
- **A widget that cannot load says so.** A mount whose `GMT_MODULES` import fails throws
  `WidgetLoadError` (`src/lib/widget-mount.ts`); it never returns an inert handle, which
  left controls that looked live and did nothing. Every `.astro` shell — every teaching
  widget, the globe, the scrubber and the timezone map — catches its mount and calls
  `showUnavailable(root, error)`: `data-state="unavailable"` dims and disables the
  server-rendered markup (`gmt-widget.css`), and one amber notice offers a reload.
  `widget-load-error.test.tsx` runs every library-backed mount against a `GMT_MODULES`
  whose imports all reject.
- **One control system for every widget.** `gmt-form-controls.css` holds the primitives:
  - the field grid with subgrid label rows, and the `optional` hint chip;
  - the faceted-grip `.gmt-range` with its fill, value chip and end labels;
  - `.gmt-handle` for custom `role="slider"` handles;
  - bevelled `.gmt-chip-toggle`s in a `.gmt-chip-group`;
  - the chevron `.gmt-select`, and `.gmt-button--pad`.

  Templates build them with `labelTextHtml`, `rangeFieldHtml`, `syncRange` and
  `chipToggleHtml` from `widget-ui.ts`. Every teaching widget, the multi-zone scrubber and
  `PlaygroundForm.astro` use them, so a new tool composes these and adds no control CSS of its
  own. Rules and traps:
  [reference/design-system.md § Form controls](reference/design-system.md#form-controls).
  - **Every widget root carries `not-content`** and `container-type: inline-size`, so
    Starlight's prose spacing never reaches widget internals.
  - **The Cut-off Countdown's axis is inset by half a thumb width.** Its "now" marker and the
    range thumb then share an x. One property, `--gmt-countdown-inset`, sets the inset for
    both the axis and the drag field. It is defined on `.gmt-cutoff-countdown` because the
    drag label is a sibling of the axis, not a child. Any padding or border added to the
    axis or track goes into it.
  - **Axis and track labels are fitted by measurement**, through `label-fit.ts` and the DST
    Inspector's `selectTickMinutes`. A label that would collide, cross a rule or overflow is
    thinned or flipped to the other side of its mark, and the fit re-runs on a width change.
    This is how the Cut-off Stack, the Cut-off Ruler, the Free Time Ledger's expiry, the
    DST ticker, the Punctuality Board's band, the ETA Drift Chart's plot and the Departure
    Board's rail stay legible at 390px. A drawing with lines and rings through it (the ETA
    Drift plot, the Departure Board rail) places each label with `placeLabels` from
    `punctuality-widgets.ts`, which treats rings, other labels, handle hit squares and line
    segments as obstacles; those labels also sit on an opaque surface above the lines, so a
    line never crosses a glyph.
  - **`scripts/html-diff.mjs` finds a widget root with or without `not-content`.**
- **Trap: Starlight's `Icon` is not an override slot.** Importing
  `{ Icon }` from `@astrojs/starlight/components` and expecting `transport-*` names to
  resolve does nothing useful — that component never sees this repo's icon set. Icons
  live in the repo's own `src/components/Icon.astro` (`BuiltInIcons`, which the transport
  set is added to, not replaces). A widget's plain-DOM template calls `transportIcon()`
  from `src/lib/transport-icons.ts`; an MDX page imports `~/components/Icon.astro`, never
  Starlight's own.
- **Trap: a class name containing "card" turns into glass.** `[class*="card"]` rules in
  `gmt-glass.css`, `gmt-a11y.css` and `gmt-light.css` give it a 16px bevel, a fill and a
  backdrop blur. Name widget parts without the substring, or override all three rules on
  purpose, as `.gmt-cutoff-ruler-card` does.
- **Trap: an element with an author `display` ignores `hidden`.** A chip or plate that a
  fit pass hides needs its own `[hidden] { display: none }`. Without it, `placeLabel` and
  `thinTickLabels` hide nothing.
- **Trap: tint a hatched element with `background-color`, never the `background`
  shorthand.** A higher-specificity shorthand, such as the Stack's alternating day tint,
  wipes a hatch drawn in `background-image`.
- **Trap: a table that `.gmt-widget.not-content` makes `display: block` takes
  `overflow-x: auto`, never `overflow: hidden`.** `hidden` silently cuts its last column off
  at 390.
- **Trap: a bevelled corner hides the text under it.** `corner-shape: bevel` clips glyphs
  that sit in the cut corner, so first and last cells need at least 10px of inline padding.
- **Trap: `Date.parse` is banned in tests too.** `date-ban.test.ts` and `oxlint` reject it
  in test files as well as source. Use `Temporal.Instant.from(…).epochMilliseconds`.
- **Result regions ease through `.gmt-grow`.** Sections after the first, and elements marked
  `data-grow="slot"`, change height smoothly: one shared observer and one speed budget keep each
  frame's step small, and the markup is wrapped at runtime so a reader without JS sees the server
  render. Section 1, the controls, is never wrapped, so popovers and focus rings do not clip.
  Rules: [reference/design-system.md § Smooth growth](reference/design-system.md#smooth-growth).
- **Tool pages:** `/tools/dst-inspector/`, `/tools/interval-visualizer/`,
  `/tools/converter-bench/`, `/tools/dwell-ledger/`, `/tools/free-time-ledger/`,
  `/tools/billing-deadlines/`, `/tools/delivery-scheduler/`, `/tools/connection-checker/`,
  `/tools/timetable-reader/`, `/tools/crossing-clock/`, `/tools/cutoff-stack/`,
  `/tools/cutoff-ruler/`, `/tools/cutoff-countdown/`, `/tools/punctuality-board/`,
  `/tools/eta-drift/`, `/tools/departure-board/`, plus the Tier 4 `/tools/zoned-earth/`
  and `/tools/zone-planner/`. Permalinks (`?w=&wa=`) seed a widget through `seedFromLocation`,
  with structural checks rather than zod so a docs page never pulls in the `ai` package.
- **`seedFromLocation` keeps only top-level strings of 1–64 characters and years.** A widget
  whose arguments are lists or objects flattens them into numbered string keys (Delivery
  Scheduler, Timetable Reader, the Cut-off Stack's `name1`…`atLocalTime4`) or joined strings
  (Free Time Ledger, the Cut-off Stack's `weekend` and `holidays`), and the content-permalink
  test checks every key survives. The three TRAN-57 tools use a preset form, `{ preset }` plus
  each scalar that differs from it (`"none"` clears an optional one), and fall back to numbered
  list keys only for a list no preset holds, so a chat-seeded list survives the rail's
  copy-permalink.
- **`escapeAttr` on every template interpolation.** Values come from a model or from a URL
  someone else wrote, and a hand-written template string escapes nothing.
- **Interval visualizer:** the timeline is a `TimelineScale` value. Presets use the fixed
  calendar-year scale, because switching presets is only comparable against a still frame.
  Seeded and typed values fit their own scale with 10% padding, and drag snap and keyboard
  step derive from the span.
- **DST inspector:** `getDstTransitions` returns `…Z` instants.
  `buildZonedValueFromMinutes` deliberately omits an offset — resolving the ambiguity is
  what `startOfZoned` exists to show.
- **Gates:** `scripts/grow-measure.mjs` (`pnpm run grow:measure`) samples every tool page's height
  on each frame, on load and on input, in Chromium and WebKit at 1440 and 390 px. It asserts a
  largest jump of 48 px, every `.gmt-grow` at rest, and a final height equal to the
  reduced-motion run's. `scripts/readout-still.mjs` (`pnpm run readout:still`) drags every handle
  in the Departure Board, Punctuality Board and ETA Drift Chart by keyboard and pointer, in Chromium
  and WebKit at 1440, 390, 360 and 300 px, and fails if a hero plate, the chart frame, the dragged
  control or anything above it moves or resizes (design-system.md § Drawn charts).
  `scripts/html-diff.mjs` compares built widget markup (✗ the widget changed,
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
- **Motion:** the focus and tab sonar pings, the globe, cross-document view transitions (header
  and sidebar swap in place, the content cross-fades), the homepage scroll reveal (hidden only
  under `html.gmt-reveal-ready`) and `.gmt-grow` height easing. There is no boot sequence or
  scanline sweep. The allow-list is in `reference/visual-design.md` § Motion.
- **Accessibility:** `gmt-a11y.css` handles `prefers-reduced-transparency`,
  `prefers-contrast: more` and `forced-colors`; the global reset handles reduced motion.
- **Trap:** the package `build` waits on `typecheck`, so `astro sync` and `astro build` never
  race on the content-layer store.

## Tier 4 · Globe and scrubber

`DOX-E1a`, `E1b`

- **Globe (`src/lib/globe/`):** a reusable WebGPU engine, with a canvas-2D renderer as the
  fallback. `src/lib/globe.ts` is the Dox layer on top — zones, clocks, selection and the
  tooltip — and keeps `initGlobe(host, clockPanel)`, so the hero, `/tools/zoned-earth/` and
  the `/dox` rail all mount it unchanged.
  - **The split.** `globe/` knows nothing about time: it draws a planet, takes markers,
    regions and arcs, and asks the caller for the instant to light it by. That line is what
    lets the same engine carry route arcs or a coloured region set without a fork.
  - **Pure and shared:** `camera.ts` (the orthographic projection, checked against
    `d3-geo`), `controller.ts` (rotation, inertia, ambient spin, pinch, fly-to — a state
    machine that takes its timestamps as arguments, so both renderers feel identical and a
    fake clock drives it in tests), `geometry.ts`, `triangulate.ts`, `sun.ts`, `shading.ts`.
  - **Choosing a backend.** The engine asks for a device *before* touching a canvas, since
    `getContext("webgpu")` claims an element for good and the fallback needs a clean one.
    Each renderer owns its canvas; the shell swaps it and rebinds input. A null adapter, a
    rejected device, a shader that will not compile or a validation error on the first
    frame are all just "use canvas-2D". A lost device is retried once, while the tab is
    visible, then the fallback holds for the session. `?globe=webgpu|canvas2d` pins one.
  - **Three passes.** Coverage into a 4× MSAA `rgba8unorm` target, one channel per vector
    layer, blended with operation `max` so overlapping triangles and stroke joints never
    double-blend a translucent layer — a 2D canvas strokes a path as one coverage, and
    beaded joints are how a port betrays itself. Then one full-screen quad that ray-casts
    the sphere and composites atmosphere, ocean, sun shading, limb, an analytic graticule
    and the coverage channels. Then instanced markers and labels. The coverage pass is
    skipped when only the sun has moved, which is what the 1 s clock tick changes.
  - **One source for the shading.** The WGSL is built from TypeScript template strings with
    the constants interpolated out of `shading.ts`, so the shader cannot drift from the
    maths Vitest covers. `webgpu/shaders.test.ts` checks each constant arrives.
  - **Geometry.** Rings are unwrapped so an antimeridian crossing stops reading as a sweep
    round the planet, densified so a chord does not sag off the limb, and triangulated with
    `earcut` plus a conforming red–green refinement that leaves no T-junctions. Edges are
    straight in lng/lat, per RFC 7946 §3.1.1 — which is also how a tap is resolved to a
    zone, so the answer does not depend on which renderer is drawing. A hole is aligned to
    its outer ring's 360° window first; Afro-Eurasia crosses the seam while its one hole
    does not, and without that the mesh loses a band and fills the Mediterranean.
  - **The fallback** is the previous canvas-2D drawing code, moved behind the renderer
    interface and otherwise untouched, so the picture it produces is the one the visual
    baselines already hold. It is the only globe code left that uses `d3-geo`, and
    `renderer-graph.test.ts` keeps it that way — deleting it later is the directory plus one
    `import()` in `engine.ts`.
  - Features: drag with inertia, pinch and wheel zoom over `[1, 5]`, zoom buttons,
    `land-110m`, a day/night terminator from the current instant, and an arrow-key
    `listbox` for zone selection. The wheel is only swallowed while the zoom can still
    change, so a reader who scrolls onto the hero is not trapped on it.
  - Shading (`src/lib/globe/shading.ts`): day light, twilight and night are shaded per
    pixel from the sun's elevation. Stacked translucent caps were tried first and showed as
    rings and limb stripes. An atmosphere ring outside the limb follows the sun. Both
    washes are tokens that `gmt-a11y.css` zeroes under reduced transparency and raised
    contrast.
  - `rAF` and the 1 s clock tick both stop on `visibilitychange`; reduced motion gives a
    static globe with selection still working.
  - Lazy-mounted by `IntersectionObserver`, every instance on the page, not just the first.
    No globe JS reaches reference pages. A browser with WebGPU never downloads `d3-geo`; one
    without it never downloads the shaders or `earcut`.
  - Hosts: the landing hero, `/tools/zoned-earth/`, and the `/dox` rail via
    `mountGlobe` / `showGlobe`.
  - **Verifying it needs a GPU.** CI has none and jsdom has no WebGPU, so `pnpm globe:smoke`
    is the gate: it drives a real browser, pins the clock, asserts the expected backend
    started with no GPU error, compares the two renderers pixel for pixel, exercises the
    no-WebGPU fallback, and checks drag, keyboard and zoom. Run it before calling globe work
    done. A software adapter (`GLOBE_SMOKE_SOFTWARE=1`) drops its GPU instance partway
    through a frame, so it cannot gate — though watching the globe fall back cleanly when
    that happens is worth something.
- **DST answers are cached on `(zone, year, offset)`** (`src/lib/zone-clock.ts`), which is the
  complete input set of `isInDaylightSaving` — it compares an offset against the smaller of
  that year's own January and July offsets. The year is load-bearing: the same offset can be
  DST in one year and standard in another once a zone stops observing it and keeps the summer
  offset, so `2016-07-01T12:00+03:00[Europe/Istanbul]` is in DST and the 2026 reading at the
  same offset is not. Keyed on `(zone, offset)` alone the two collided, which the scrubber
  could reach because it takes an arbitrary anchor date.
- **The zone readout (`src/lib/zone-readout.ts`)** is the one vocabulary the globe's tooltip
  and the clock list beside it both render from. They show the same four facts, so they say
  them the same way: time in `--gmt-cyan-ink`, UTC offset in `--gmt-spring-ink`, DST as a
  gold `DST` badge. Every one is an `-ink` token because all three are text, and the bright
  base tokens only clear the 3:1 fill bar in light theme. Amber is not among them — it is
  the "no signal" sentinel's alone.
  - **Gold means daylight saving and nothing else.** Every hue in this widget is spoken
    for — cyan is "on" and the selected/hover state, spring the UTC offset, purple the day
    shift, amber the no-signal sentinel — so a second meaning for gold has nowhere to go
    without stealing one. The local-sky bands are therefore not colour-coded at all: their
    sun, horizon and moon glyphs carry them. Daylight briefly took gold and collided twice,
    with the DST badge on the line below it and with the globe beside it, which paints its
    *night* markers `--gmt-globe-gold` as city lights.
  - **DST is marked in text, not with a sun.** A row on summer time carries a gold `DST`
    badge, matching the `Gap` / `Overlap` badges the DST Inspector already uses; standard time
    and no-DST rows carry nothing. It was a sun, and that was wrong twice: daylight saving is
    a property of the *clock* and says nothing about the sky, and this panel sits beside a
    globe that draws a real day/night terminator and paints its night markers
    `--gmt-globe-gold` — so gold meant *night* on the canvas while a gold sun meant *DST*
    beside it. The filter switches are clocks for the same reason.
  - **Local sky (`src/lib/zone-sky.ts`)** is where the sun and moon went, meaning the one
    thing they look like. A zone solar elevation is 90 degrees minus the great-circle angle to
    `subsolarPoint`, the globe own sun, so the tooltip wording and the terminator behind it
    cannot disagree. Three bands: daylight above the conventional horizon (-0.833 degrees,
    which is where refraction and the sun own radius put sunrise), twilight down to -18, night
    below. Polar day and polar night need no special case. It answers for the zone
    representative coordinate, not its whole territory - the same point the globe marker uses.
    Pure trigonometry with no polyfill, so unlike the DST scan it is cheap on every tick.
  - **DST has three states, and one of them draws nothing.** Sun for an instant in DST, moon
    for standard time in a zone that observes it, no glyph at all for a zone with no DST
    rules. The absence is the signal, and it keeps about half the list free of icon noise.
    Glyphs follow `transport-icons.ts`: inner SVG markup only, shared with `Icon.astro`.
  - **A zone's day is called out when it is not the viewer's.** The row carries its local
    date, plus a `+1d` / `−1d` chip and a purple wash on the card; the tooltip has room, so
    it spells out "Yesterday" / "Tomorrow" instead. Direction lives in the text, never in
    the wash alone — a background colour is not ours to set under forced-colors.
  - **The label states the real difference, the filter uses three buckets.** Those are not
    the same number. Kiritimati (UTC+14) and Midway (UTC−11) are 25 hours apart, so for
    about an hour a day the gap is *two* calendar days: the chip reads `+2d` and the label
    "2 days ahead", while the filter still sorts every zone into prev / same / next. Deriving
    the label from the clamped bucket put "Yesterday" beside a date two days back.
  - The wash alphas are a measured ceiling, not a taste: they sit under the card's own text
    and spend its contrast budget. `--gmt-dst-purple-ink`, not `--gmt-purple-ink`, is what
    the chip and the tooltip's word use; the latter's dark value is an alias onto the bright
    hue and falls under the 7:1 floor on both surfaces. Re-measure if you change either.
  - **Day arithmetic is integer, not `Date`.** `dayDelta` converts each wall date with
    Hinnant's days-from-civil. The offset range spans UTC−12 to UTC+14, 26 hours, so two
    zones can sit *two* calendar days apart — a ±1 check falls through to "same day" for
    exactly the pair that differs most.
- **Zone filters (`src/lib/zone-filter.ts`, `zone-filter-ui.ts`)** — a settings gear to the
  right of the zone search opens a popup of six switches over the same two axes the rows
  show: local day
  (Yesterday / Today / Tomorrow), DST state (In DST / Standard time / No DST) and local
  sky (Daylight / Twilight / Night). They narrow
  the clock list *and* the globe's markers, and the region hit test with them, so a zone the
  list is not showing cannot be selected by tapping its territory either. The selected zone
  keeps its marker regardless — its tooltip and outlined region would otherwise point at bare
  ocean.
  - **It is a popup, not an accordion**: it floats over the clock list instead of pushing it
    down, and light-dismisses on a press outside or on Escape, which returns focus to the
    gear. `<details>` supplies the disclosure and the keyboard toggle; the dismissal is ours,
    because on its own it would sit open over the list until clicked a second time.
  - **A switch is on screen when its bucket has zones in it, or when it is switched off.**
    The second clause is what stops a filter becoming unreachable: hide an unchecked toggle
    once its bucket empties and the only control that could undo it disappears.
  - **The switches are built once and afterwards only shown, hidden or relabelled.**
    Availability changes about once a minute as zones cross midnight, so re-rendering the
    group would routinely pull a control out from under a keyboard user.
  - **A rescan that changes nothing touches nothing.** `applyFilter` compares the new zone
    list against the last one applied and only then calls `setIds`, which drops every mounted
    row and returns the list to the top. That is right after a real filter change and wrong
    once a minute: without the guard a reader was thrown back to the first zone every minute
    the panel stayed open. The toggle counts refresh either way, since a zone can cross
    midnight without changing what is shown.
  - **Cost is why the panel is shut by default.** Bucketing every zone costs ~11 ms warm,
    and `globe.ts` skips the scan entirely while the panel is closed and no filter is on —
    the state the globe mounts in. When it does run it runs at most once a minute: day and
    DST state change only on whole-minute boundaries, so a per-second scan would recompute
    an answer that provably has not moved.
  - **Changing the filter re-seats the list's scroll through the virtualizer, not through
    `scrollTop`.** TanStack only learns its scroll position from an async observer, so a
    synchronous render straight after a programmatic scroll can still be using the old
    offset — past the end of the new, shorter list — and paint nothing. `setIds` scrolls via
    the virtualizer and renders again on the next frame.
- **Zone coordinates** are vendored from tzdata by `scripts/prepare-tz-coordinates.mjs`.
  Refresh when tzdata releases.
- **Scrubber (`src/lib/multi-zone-scrubber.ts`, `/tools/zone-planner/`):** pinned zones move
  together along one slider, DST offset changes visibly bite, the configuration round-trips
  through a permalink, and a `datetime-local` input is the typed equivalent to dragging. It
  is not a chat tool.

## Tier 5 · Scenarios and pitfalls

`DOX-A4b`–`A4d`

- **Scenario pages** (`src/content/docs/scenarios/`): the naive approach → a live widget
  showing it break → why → the gmt approach → the same widget working. The scenarios index
  (`scenarios/index.mdx`) is generated from their frontmatter by
  `scripts/build-scenario-index.mjs` during `generate`, and is untracked; never edit it.
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
  HTTP error. Anything watching the endpoint should note the change: a pool spent or every
  brain busy *during* the answer is now HTTP 200 with the refusal in the stream, not a
  non-OK status (PR #281 review).

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

- **The widget tools**, schemas shared by client and Worker in `src/lib/dox-tools.ts`:
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
  - `showBillingDeadlines({ anchorOn, invoiceIssuedOn?, requestReceivedOn?, issueDays, disputeDays, resolutionDays, agreedResolutionOn? })`
    (INT-58): the windows are required, as the library requires them, and a blank window
    stays blank, never defaulted. Its permalink carries every window as a string, because
    `seedFromLocation` drops other numbers.
  - `showDeliveryScheduler({ legs, startTimeZone? })` (TRAN-9): `legs` is an array of objects,
    so its permalink flattens them to `departure1`…`mode4` plus `legCount`, because
    `seedFromLocation` keeps only top-level strings.
  - `showCrossingClock({ entry, exit, targetZone })` (TRAN-9): a zoneless wall time is read in
    `targetZone` with `disambiguation: "reject"`, as `showDwellLedger` does.
  - `showConnectionChecker({ inboundDeparture, inboundDuration, portZone, handlingMinutes, onwardDeparture, onwardDuration?, onwardZone? })`
    (TRAN-9).
  - `showTimetableReader({ startTimeZone, departures, offsets?, duration, timeZone })`
    (TRAN-9): a zoneless departure is the point, and it is never pre-resolved.
  - `showCutoffStack({ anchor, timeZone, cutoffs, weekend?, holidays?, roll? })` (TRAN-10):
    `roll` is never defaulted; a calendar with no roll shows the library's `[]`.
  - `showCutoffRuler({ anchor, timeZone, days, atLocalTime })` (TRAN-10).
  - `showCutoffCountdown({ cutoff, now?, timeZone })` (TRAN-10): no `now` means the reader's
    clock, live.
  - `showPunctualityBoard({ pairs, late, early?, compareLate? })` (TRAN-57): `late` is
    required; there is no default tolerance.
  - `showEtaDrift({ events, tolerance? })` (TRAN-57): each event is `{ classifier, at,
    recordedAt }`, the classifier one of `PLN`, `EST`, `REQ`, `ACT`.
  - `showDepartureBoard({ after, departures? | headway, from, to, minimumConnection?, onwardDuration?, onwardZone? })`
    (TRAN-57): every moment carries its offset; the onward leg only feeds the Delivery
    Scheduler hand-off link.
- **Parity:** `ENABLED_TOOL_NAMES` equals the widget registry's keys
  (`widget-registry.test.ts`), and every enabled tool has a `CHAT_STARTERS` card
  (`chat-starters.test.ts`). A tool nobody can mount or discover cannot ship.
- **Example cards open their widget on the click.** The 17 `CHAT_STARTERS` live in the widget
  rail, not the empty chat, as a scrolling panel of bevelled cards (`ExamplesPanel.tsx`)
  grouped by area. Each entry carries an `area` from `EXAMPLE_AREAS` (Zones and DST,
  Intervals, Transport, Intermodal and billing), and `startersByArea()` returns the groups in
  that order, empty areas omitted. `chat-starters.test.ts` asserts every starter has a known
  area, every area has a starter, and the grouping covers each starter exactly once.
  - A card is a native `<button>` whose accessible name is the question and whose description
    is a chip naming the widget (the registry title). Activating it sends the question and,
    only if the send went, calls the rail with `starterWidgetCall(starter)`, so the widget does
    not wait on a round trip or on the model choosing the tool. Each entry carries the `args`
    its question describes. The model's own call replaces it unless `isSameWidget` says the
    tool and arguments match (key order ignored), which keeps anything the reader has already
    dragged. `chat-starters.test.ts` runs every seed through its schema and `validate`, so a
    seed that drifts from its tool fails the suite.
  - **The rail has two names.** `aria-label="Examples"` with the list, `Widget panel` with a
    widget (and in the error-boundary fallback). With no widget the rail shows the panel on
    every viewport width; the widget replaces it in the same slot through the rail's
    `<ViewTransition>`, and closing the widget brings it back.
  - **Phone (below 60rem):** while the conversation is empty the panel is the bottom sheet. `DoxPage`
    sets `data-empty` on `.gmt-hive-body`, so the chat keeps its content height (crystal, status
    line, prompt, composer) and the sheet takes the rest, at least 12rem; a started conversation
    or an open widget gets the usual 55% sheet.
    Once it starts, the sheet collapses (`data-collapsed`, `display: none`) and an
    `Examples · N` bar (`ExamplesBar.tsx`, `aria-expanded`, `aria-controls` the rail) sits above
    the composer and toggles it. N is `CHAT_STARTERS.length`. Picking a card collapses the sheet
    again. The bar is hidden by CSS above 60rem.
  - **Focus.** Activating a card moves focus to the open widget's title (`tabIndex={-1}`);
    a widget the model opens never takes focus, since the reader may be typing. Closing a
    widget returns focus to that tool's card when the panel is visible, otherwise to the bar
    (phone, conversation started, sheet folded). `matchMedia` is read in handlers and effects
    only, never during render (#418).
  - **Ownership.** `DoxPage` owns `conversationStarted`, `examplesOpen`, the rail widget and
    the focus requests; `DoxChat` stays host-agnostic and exposes `send` through a ref handle,
    reports emptiness through `onEmptyChange`, and renders the host's `aboveComposer` node.
    `rail-keyboard.test.tsx` drives `DoxPage` with real Tab, Enter and Space
    (`@testing-library/user-event`).
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
- **Rail** (`WidgetRail.tsx`, AI Elements `Artifact`): shows the examples panel until a tool
  call opens a widget, and has a copy-permalink button. The transcript's `WidgetReceipt` chip is a seeded
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
  - a boot sequence, scanlines, grain;
  - a full-bleed 3D globe behind panels. The globe renders on the GPU, but it stays an
    object on the page: the landing hero, `/tools/zoned-earth/` and the `/dox` rail, never
    a backdrop;
  - a photoreal Earth. The look is a grid globe. Textures, clouds and atmospheric
    scattering would slot into the surface shader without touching the vector layers, and
    are not built.
- **Audio and voice:** no browser exposes `speechSynthesis` output to Web Audio
  ([WebAudio#1764](https://github.com/WebAudio/web-audio-api/issues/1764),
  [mediacapture-main#654](https://github.com/w3c/mediacapture-main/issues/654)), so a
  synced voice visualizer is impossible.
