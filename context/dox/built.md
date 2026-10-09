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
- **Web Analytics.** Every HTML page loads Cloudflare's beacon
  (`static.cloudflareinsights.com/beacon.min.js`) from the `Head` override
  (`src/components/Head.astro`), in production builds only. The site is registered by
  hostname in the NorthGuild Cloudflare account, where the page views and visits are read.
  - The token in the script tag is public: it names the site entry and grants nothing.
  - The beacon sets no cookie and does not identify visitors.
  - A `workers.dev` hostname is not a zone in the account, so Cloudflare cannot inject the
    beacon itself; that is why the tag is in the page. On a custom domain, change the
    hostname of the site entry in the dashboard.
- **Generator (`A3a`).** `scripts/build-reference.ts` uses the TypeScript compiler API
  (not TypeDoc) and emits one MDX page per exported function and regex, one per shared
  type, index pages, `gmt-corpus.json`, a typed route manifest (`ReadonlySet<string>`),
  `LIVE_PLAYGROUND_TEMPLATES` and `public/_redirects`. Outputs live under `src/generated/` and are rebuilt by
  `pnpm run generate`, which runs before `test`, `check` and `build`. The directory is in
  `.gitignore`, but `reference/corpus.ts`, `reference/gmt-corpus.json` and
  `reference/route-manifest.ts` predate that rule and stay tracked, so regenerating them
  produces a diff to keep. The MDX reference pages are ignored and untracked.
  - It skips when the content hash in `src/generated/reference/.inputs-hash` matches (gmt
    source, the `exports` map and the generator itself), and otherwise writes only changed
    pages and deletes only stale ones (`scripts/build-utils/generated-files.mjs`). Never go
    back to `rm -rf` + rewrite: every file event reaches `astro dev`, VS Code's watcher and
    its TypeScript server.
  - **Where a type is documented is decided by use, not by source directory.**
    `scripts/build-utils/type-usage.ts` walks the type nodes of every public function's
    parameters and return type, and of every public type, and takes the closure. A type two
    or more functions reach gets a page at `/reference/types/<Name>` (flat, no module
    level). A type one function reaches is documented on that function's page: as the
    `## Options` block when it types an expanded parameter, otherwise as a `### Name`
    section under `## Types`. A type no function reaches stops the generator; the fix is in
    `packages/gmt/src`. The graph reads nodes, never printed signatures: the printer inlines
    union aliases, so a string match cannot see `Overflow`.
    - Duplicate type names (also by case), an unannotated return, and a generic or
      overloaded public function stop the generator too.
    - Anchors come from `github-slugger`, one slugger per page fed every heading in order,
      so they match what Starlight emits. The generator stops if a rendered page's headings
      differ from the list the anchors were computed from.
    - Every type link goes through `typeUrl` in `build-utils/reference-urls.ts`.
  - **`## Options` expands a parameter's properties** when its declared type is an inline
    literal or an intersection, or a named public object type on a parameter whose declared
    name contains `options` or is `props`. A data parameter such as
    `calendar: BusinessCalendar` stays a Parameters row linking to its type. Columns are
    `Option | Type | Default | Description`; a required option reads "Required".
  - **Descriptions and defaults come from the property's own JSDoc**: the comment, and the
    `@defaultValue` tag. The renderer never invents text; a missing value prints `—`.
    TypeScript does not attach a `/** */` that sits on the same line as the `{` before it,
    and `//` comments are not JSDoc.
  - **`Intl.DateTimeFormatOptions` members collapse to one row** linking to the
    `DateTimeFormatOptions` page and ECMA-402. They are declared in TypeScript's lib and
    cannot carry GMT's JSDoc. A property GMT redeclares in its own interface keeps its row.
  - **One table renderer**, `build-utils/render-table.ts`. `mdText` escapes prose outside
    code spans; `mdCode` escapes only what breaks a span or a cell. Entity-escaping inside
    backticks prints the entity. `\|` inside a code span in a table cell renders `|`.
    A union splits into chips only at its top level (`topLevelUnion`), never inside `<>`,
    `()`, `[]`, `{}` or a string. A double-quoted, hyphenated token with no space in prose
    (`"4-5-4"`) is wrapped in `<span class="gmt-nobreak">` so it cannot wrap at the hyphen;
    `stripMdx` removes the span for the text surfaces.
  - **The doc gate** (`build-utils/doc-gate.ts`, `pnpm dox:docs-check`) lists every public
    type, member and option without a description, every optional input property without
    `@defaultValue`, `@default` used in its place, a list inside a property description,
    and a `@param` that names no parameter. Each declaration is checked once. Return-only
    members need no default. It owns missing docs; the renderer does not. A gap fails
    generation before any page is written, and `pnpm run validate` runs the check first, so
    the fix is always JSDoc in `packages/gmt/src`, never a fallback string.
    - **Nested literals are rows.** A property typed as an inline object literal (also inside
      an array or a union with `null`) carries `children`; the Options and Members tables
      print each as its own row named by a dotted path (`options.allowEqual`, `parts[].type`
      for an array's elements), as MDN names nested parameters, and the parent's Type reads
      `object`. The gate checks the children by the same rules, under the dotted subject.
    - **An inline return literal gets a Members table under `## Returns`** (`**Members**`, or
      `**Members of each item**` for an array); the gate rule `return-description` requires a
      description on each member and no `@defaultValue`.
    - **`param-lists-options`**: an expanded options `@param` must not name the object's own
      options. It matches a whole, case-sensitive name inside a code span, or two or more of
      the names in a row joined by `,` `;` `/` `|` `and` `or`. One name in plain prose does
      not match.
  - **Index pages** exist at `/reference/`, `/reference/types/`, `/reference/<ns>/` and
    `/reference/<ns>/<mod>/`, each listing its children with a one-line summary. Their
    frontmatter uses the block form `sidebar:` / `order: 0`: `ensure-sidebar-order.mjs`
    matches only that form and rewrites any other on every run, which defeats `syncTree`.
  - **The corpus keeps one entry per public type.** `url` is the link to cite (owner page
    plus `#anchor` for an inline type), `page` is the route that serves it, `inlineOn`
    names the owner function, `members` feeds retrieval. The route manifest is the unique
    `page` values plus the index routes. `scripts/api-surface.mjs` accepts a
    `/reference/…#fragment` link only when it is a corpus `url`.
  - **`public/_redirects` is generated and ignored by git.** A type's old URL is a pure
    function of its source path, so each gets three `301` rules: bare, trailing slash and
    the `.md` twin. An inline type redirects to its owner page and anchor. Astro's
    `redirects` is not used: it emits meta-refresh pages. Under `wrangler dev` the source
    match is case-sensitive and the fragment survives in `Location`; `astro dev` does not
    apply the file.
  - Every `build-utils` module the generator imports is listed in `referenceInputs()`, or
    editing it does not regenerate.
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
  An enum select carries per-choice examples (`choiceSeeds` on the template, built by
  `buildChoiceSeeds`): for each choice, the first `@example` that writes it as a quoted literal,
  whose other arguments are literals the form can hold and whose documented result is not a
  sentinel, supplies the other fields' values. Choosing that value loads them and runs the call
  when every other field still holds what the form last loaded; a field the reader edited is
  never overwritten, and a choice with no example only re-runs (`createSeedLoader` in
  `src/lib/playground-client.ts`). A function whose examples do not vary by choice has no
  `choiceSeeds`.
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
  through `startTimeZone`, on a local-day track with a handle per row, above a chart that
  joins each printed time to its instant (its rules are below); and the Crossing Clock, exact
  elapsed hours beside the wall-clock difference, on an hour ruler. All four import
  `transport-widgets.ts`: they find the failing leg and every ready or departure instant by
  calling `scheduleDelivery` on prefixes and zero-length legs, never by arithmetic, and each
  computes one labelled naive value of its own. Each is a
  `src/lib/<widget>-mount.ts` exporting
  `renderTemplate(args)` and `mount(root, args)`. The `.astro` shell server-renders the
  template with `<Fragment set:html>`, and the `/dox` rail string-mounts the same markup.
  The Timetable Reader's rules (spec: [specs/timetable-reader.md](specs/timetable-reader.md)):
  - **Three full-width sections, stacked:** the timetable, what each printed time means, and
    the call. Each carries `gmt-widget-section--wide`, because a day track and a chart need
    the whole row.
  - **Pictures left, values right, from a 76.25rem section.** Sections 1 and 2 each hold a
    `.gmt-timetable-split` of two `.gmt-timetable-pane`s (track and frames; chart and table),
    in DOM order. From `w` = 76.25rem (a 1902px viewport) a split is a two-column grid,
    `minmax(28rem, 1fr) minmax(47.25rem, 1fr)` with a 1rem gap, held in `--tt-cols` on the
    root so both sections share one seam (separate cards, so not a subgrid). 47.25rem is the
    table's minimum; 28rem is the legibility floor of the track and chart. Every pane is a
    container named `gmt-timetable-pane`, so each breakpoint under the band is written once
    against the pane and holds stacked and split alike. Under the band the layout is the
    stacked one.
  - **One local-day track, a handle per row.** The track is the local calendar day of the
    first row that holds a valid time, 00:00 to 24:00 on the "Printed in" clock. Each row
    has its own lane and its own handle, built on the Interval Visualizer's `.gmt-handle`
    pattern: a `role="slider"` `div`, with pointer and key listeners delegated on the root.
    An empty lane reads "click to add", and a press on it adds the row and carries on as a
    drag. All four lanes are always drawn, because two rows can print one time, and a lane
    that came and went would jump section 1.
  - **A handle changes a row's printed time and never its offset.** The offset is the
    reader's choice. A time that no longer agrees with it returns `null`, as the library does.
  - **The repeated or skipped hour is shaded from the library, never from a table of dates.**
    `getDstTransitions` lists the clock changes, `etaAtZone` at each change's two offsets
    gives the band's two wall readings, and `classifyLocal` says whether a printed time
    happens once, twice or never. `loadTimetableLib` (`transport-lib.ts`) adds the two calls;
    the other three TRAN-9 tools do not load them. Comparing `HH:MM` cannot tell a repeated
    hour from a date that a zone skipped whole.
  - **Four row frames with corner brackets**, one per row. Each is a `fieldset` that holds
    the printed departure and the Offset select. The select is disabled unless the printed
    time has more than one reading or the row already holds an offset, so a written offset
    can always be cleared.
  - **A two-clocks chart above an edge-to-edge table.** The printed clock and the exact-time
    axis share one scale and one origin, the local midnight, so the line from a printed time
    to its instant is vertical until the clock changes. The chart shows a window fitted to
    the rows and refits only when a change settles (pointer up, key up, a typed value's
    `change`). While a handle moves, the axis stays still under the pointer; this is the
    Departure Board's rule for its rail. Each run is a bar from its instant to its arrival.
    The table fills its panel as a real table with fixed column widths where four columns
    fit, and becomes stacked rows where they do not.
  - **Nothing moves while a handle is dragged**, in any of the three sections. Every height
    and column width is fixed, and a cell whose content comes and goes holds its size with a
    hidden sizer ([design-system.md § Drawn charts](reference/design-system.md#drawn-charts)).
    `readout:still` and `grow:measure` gate it (§ Gates below).

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
  Their charts share one recipe sheet, `gmt-cutoff-widgets.css`. The three TRAN-57 tools and
  the Timetable Reader's day track and two-clocks chart join it, so the sheet lists seven
  roots:
  - **The surface:** bevelled tint-and-hairline chart panels with no `backdrop-filter`
    (never glass within glass).
  - **The DST colours:** purple (`--gmt-dst-purple`) marks a repeated hour and gold
    (`--gmt-dst-gold`) a skipped one. This is the DST Inspector's pair, and the charts of
    this sheet that draw a clock change follow it: the Cut-off Ruler and the Timetable
    Reader. In this sheet gold has no other meaning. Purple is also series 3, so a DST mark
    differs from a series mark in form as well: the Ruler's DST mark is dashed, vertical and
    labelled beside solid horizontal stems, and the Timetable Reader's band is a translucent
    region between its own edges (double for a repeated hour, dashed with a hatch for a
    skipped one) under a chip that names it, beside solid numbered marks. Tools outside this
    sheet do not all use the pair: the Crossing Clock marks both kinds in purple, with the
    same double and dashed edges, and the Dwell Ledger and the Free Time Ledger flag a 23- or
    25-hour day in gold either way.
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
    - The DST change in the family's DST colours: purple for a fall-back overlap, with a
      band as wide as the repeated hour, and gold for a spring-forward gap
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
  Two more (INT-15): the DTM Decoder, a pasted UN/EDIFACT `DTM` segment, or a value and its
  2379 format code. It calls `classifyEdifactDtmFormat` on the code, then the parser of the kind
  that came back (`parseEdifactDate`, `…Time`, `…DateTime`, `…OffsetDateTime`, `…DatePeriod` or
  `…DateTimePeriod`), with a verdict on the offset (stated or not stated), a zone table and one
  shared UTC timeline that read an offsetless local date-time, or both ends of a period of them,
  in up to four zones through `resolveLocal` and state the widest gap from `diffUtcAsDuration`,
  the value taken apart field by field (a code's layout is read off its kind's formatter, in
  `edi-picture.ts`), and the value written back by the kind's formatter; and the X12 Time Reader,
  an X12 date, time and time code (elements 373, 337 and 623) read by `parseX12DateAndTime` (or
  `parseX12Date` or `parseX12Time` when only one is sent), `classifyX12TimeCode`, and then
  `x12TimeCodeOffset` or `x12TimeCodeZone`, with the same strip (a code that states an offset
  gives the instant with `resolveLocal(local, offset)`), the date and time written back by
  `formatX12Date` and `formatX12Time`, and a second section that classifies a `DTP` qualifier
  (1250) and reads its value (1251) with the parser of that kind. A code or value the library does
  not read is the sentinel with one plain sentence: for a two-digit-year code, the pattern parsers
  with a `yearWindow`; for `CET` under `303`, that the field holds a signed hour, `UTC` or `GMT`.
  Both import `edi-widgets.ts` and load through `edi-lib.ts`. They share the two-pane split
  (pictures left, values right, one seam, stacked below a derived boundary), the member grid, the
  zone table, the timeline, the verdict plate and the holds that reserve every region's height
  (`gmt-edi-widgets.css`, `edi-picture.ts`, `edi-render.ts`), and the zone code (`widestGap`, in
  `edi-widgets.ts`), and they print every call made, one a line, with the same
  `formatValue`/`callArgs`. Their rules:
  - **Nothing derives a zone from a place, a zone name, an abbreviation or a time code**,
    because the standards state no such mapping: typing `ET` never fills, suggests or changes a
    zone, and no site module holds a lookup from a name or code to an IANA id (a test asserts
    it). A preset is an example, and an example may state its place: each preset whose result
    states no offset carries its example's zones as literal fields of the preset object, written
    by hand beside its description, and the description says the zone is the example's pick and
    the reader can change it. Presets where the strip does not apply carry none. The strip's four
    zone selects are the only zone inputs; editing a field leaves the zones (state) and switches
    the preset to Custom; a permalink or chat seed names only what it carries, and an absent
    `zone` is empty with no fallback to a preset.
  - **Every region is present in every state, and holds still.** A region whose text varies
    (a description, a note, a verdict, the picture, an aside, an output, a call frame) draws every
    text it can show, hidden, in the same grid cell (`.gmt-edi-hold`), so its height is the
    tallest text's at any width; a region that does not apply shows its empty state in the same
    box. A test and a bounding-box script across every preset enforce it.
  - **On-screen text never calls the library `GMT`** (`GMT` is also a zone literal that resolves
    to +00:00) and never shows a raw `null`: a flag shows its meaning, while the printed call and
    result keep the library's literal output.
  - **Every zone is read with `disambiguation: "reject"`**, stated beside the result and in the
    printed call, because any other policy picks an instant for a repeated or skipped time.
    `classifyLocal` supplies the reason for a refused one.
  - **The site holds no table of codes.** Whether the library reads a code, and its kind, come from
    the classifier, and a code's layout comes from what its kind's formatter writes, so the widgets
    cannot drift from the library's code table. The one list of codes is `TWO_DIGIT_YEAR_CODES`
    (`edi-widgets.ts`), an advisory list that words the sentence under `NO SIGNAL` for a code the
    classifier does not know; a test asserts each code in it is one the classifiers return `null`
    for. There is no year-window control, and an old link that carries a `yearWindow` loads and
    ignores it.
  - **The printed call is the call made.** A blank form in either tool (nothing typed in any field
    of the section, `dtmBlank`, `mainBlank`, `dtpBlank`) makes no call, hides the call frame and
    renders "nothing to read", never amber. Anything typed is partial input and gets the library's
    sentinel with its reason. A time code sent with no time reads through `parseX12DateAndTime`
    with an empty time, which is the library's sentinel.
  - **Only a pasted segment is un-released.** `splitDtm` applies the UN/EDIFACT default service
    characters. A bare value reaches the library as typed, so a `?` left in it shows the
    library's own sentinel and its reason.
  - **A readout reserves its box.** Every member row and strip row is always rendered, and the
    verdict, the detail line and the instant output reserve the height of their longest text for
    the container width they sit in (`4lh` down to `1lh` for the detail line), so no preset
    moves what is below.
  - **The X12 time is written back with `TM` when it was typed as four characters and `TS`
    otherwise**, so the value comes back in the form it was sent. A time with tenths or
    hundredths is cut to the mask and the note says so: the library reads a fraction and the
    formatter truncates it.
- **A new tool is registered in lists no single test covers.** The pieces are in
  [docs-site.md § Purpose-built widgets](../domination/docs-site.md#purpose-built-widgets). The
  chat side is guarded: a missing schema or `ENABLED_TOOL_NAMES` entry in `src/lib/dox-tools.ts`,
  Worker tool in `worker/tools.ts`, entry in `src/components/ask/widget-registry.ts`,
  `WidgetKind` in `src/lib/widget-permalink.ts` or `CHAT_STARTERS` card fails
  `widget-registry.test.ts`, `chat-starters.test.ts`, `widget-permalink.test.ts` or
  `client-graph.test.ts`. These are kept by hand, and nothing fails when one is forgotten:
  - `MOUNTS` in `src/lib/widget-load-error.test.tsx`;
  - the `heavy` list in `src/components/ask/widget-graph.test.ts` (the tool's pure module, and
    any shared helper or loader it adds);
  - the sheet in `customCss` in `astro.config.mjs`;
  - `PAGES` in `scripts/html-diff.mjs`, `scripts/visual-snapshot.mjs` and
    `scripts/grow-measure.mjs`;
  - `TOOLS` in `scripts/readout-still.mjs`, for a tool with a drag handle;
  - its forced-colours rules in `src/styles/gmt-a11y.css`. A mark or a line drawn as a
    `background` gradient disappears under forced colours and needs a system-colour rule there:
    the EDI pictures' boxes, brackets, pins and axis have one, so they keep an edge.

  One more fails only after a build: the component's name in the dropped-components list in
  `src/lib/mdx-jsx.ts`, which `scripts/llms.test.ts` checks against the built text surfaces.
  `DOX_TOOLS` reads `DOX_TOOL_DOCS` by position, so a new doc is appended, never inserted: an
  insert gives every later tool its neighbour's description, and no test fails.
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
  it gets a tag when its first page ships, not before. The intermodal tag's definition is
  "Container free time, demurrage, billing deadlines, bill of lading dates and EDI timestamps."
  - **Trap: a `core` page never links an industry layer's reference pages.** The test reads
    `/reference/<layer>/` or an import from `@northguild/gmt/<layer>` in a page's source as use
    of that layer, and a page that uses a layer cannot be tagged `core`. The Standards guide is
    `core`, so it names `parseEdifactDateTime` and the other EDI functions as inline code and links
    the EDI guide, never `/reference/intermodal/`.
- **A widget that cannot load says so.** A mount whose `GMT_MODULES` import fails throws
  `WidgetLoadError` (`src/lib/widget-mount.ts`); it never returns an inert handle, which
  left controls that looked live and did nothing. Every `.astro` shell — every teaching
  widget, the globe, the scrubber and the timezone map — catches its mount and calls
  `showUnavailable(root, error)`: `data-state="unavailable"` dims and disables the
  server-rendered markup (`gmt-widget.css`), and one amber notice offers a reload.
  `widget-load-error.test.tsx` runs every library-backed mount against a `GMT_MODULES`
  whose imports all reject.
  - **Trap: the notice covers a failed gmt import, not a failed page script.** The shell's
    `<script>` imports the mount statically, and most pure widget modules import
    `@js-temporal/polyfill` statically for drawing (`transport-widgets.ts` and
    `timetable-reader.ts` among them). If that import fails, the script never runs, so the
    mount is never called and nothing catches: the server-rendered markup stays, inert, with
    no notice. A dev server that answers `504 (Outdated Optimize Dep)` does exactly this
    (§ Tier 6, Runbooks).
- **One control system for every widget.** `gmt-form-controls.css` holds the primitives:
  - the field grid with subgrid label rows, and the `optional` hint chip;
  - the faceted-grip `.gmt-range` with its fill, value chip and end labels;
  - `.gmt-handle` for custom `role="slider"` handles;
  - bevelled `.gmt-chip-toggle`s in a `.gmt-chip-group`;
  - the chevron `.gmt-select`, and `.gmt-button--pad`;
  - one disabled look for `.gmt-input` and `.gmt-select`.

  Templates build them with `labelTextHtml`, `rangeFieldHtml`, `syncRange` and
  `chipToggleHtml` from `widget-ui.ts`. Every teaching widget, the multi-zone scrubber and
  `PlaygroundForm.astro` use them, so a new tool composes these and adds no control CSS of its
  own. Rules and traps:
  [reference/design-system.md § Form controls](reference/design-system.md#form-controls).
  - **Every widget root carries `not-content`** and `container-type: inline-size`, so
    Starlight's prose spacing never reaches widget internals.
  - **A disabled `.gmt-input` or `.gmt-select` has one shared style**
    (`gmt-form-controls.css`): dimmer text, a dashed border, no fill and a not-allowed
    cursor, with no opacity. Forced colours restate it as `GrayText` (`gmt-a11y.css`). A
    widget sets `disabled` and styles nothing itself, so the state looks the same in every
    tool. The tools that disable such a control are:
    - the Punctuality Board: the early and second late tolerance inputs while each one is
      switched off;
    - the DTM Decoder: the format code while a pasted segment supplies it, the strip's zone
      selects unless the value is a local date-time (or a period of them) with no offset;
    - the X12 Time Reader: its strip's zone selects, on the same condition;
    - the Timetable Reader: a row's Offset select while the printed time has one reading and
      the row holds no offset.

    A disabled range (`.gmt-range`, the Cut-off Countdown's and the ETA Drift Chart's
    sliders) is a different control with its own rules.
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
- **Trap: a second class name containing "card" turns into glass within glass.**
  `[class*="card"]` rules in `gmt-glass.css`, `gmt-a11y.css` and `gmt-light.css` give any such
  element a 16px bevel, a fill and a backdrop blur. Every widget wraps its sections in
  `.gmt-widget-card` on purpose: that wrapper is the widget's one layer of glass. The trap is a
  part inside it, such as a readout, a plate or a row, whose class also holds the substring: it
  becomes a second blurred panel inside the first. Name widget parts without it, or override all
  three rules on purpose, as `.gmt-cutoff-ruler-card` does.
- **Trap: an element with an author `display` ignores `hidden`.** A chip or plate that a
  fit pass hides needs its own `[hidden] { display: none }`. Without it, `placeLabel` and
  `thinTickLabels` hide nothing.
- **Trap: tint a hatched element with `background-color`, never the `background`
  shorthand.** A higher-specificity shorthand, such as the Stack's alternating day tint,
  wipes a hatch drawn in `background-image`.
- **Trap: a table that `.gmt-widget.not-content` makes `display: block` takes
  `overflow-x: auto`, never `overflow: hidden`.** `hidden` silently cuts its last column off
  at 390.
- **Trap: a block table does not fill its panel.** A block box is not a table box, so
  `width: 100%` sizes the box while the rows inside stay as wide as their content. A table
  that must reach both edges sets `display: table` and `table-layout: fixed` with widths on
  its `th`s, and gives every long value a break point (`<wbr>`), because a fixed column
  cannot grow. The Timetable Reader's table does this, and wraps each part of a value in a
  `nowrap` token so the only breaks are the ones it placed.
- **Trap: `.gmt-widget-section--wide` works only as a child selector.** The rule is
  `.gmt-widget-card > .gmt-widget-section.gmt-widget-section--wide`. From 80rem a bare
  `.gmt-widget-section--wide` loses to the card's span rules (`span 2`, and the
  `:first-child` and `:nth-child(2)` rules), so the section does not take the whole row.
  The longer selector ties the two positional rules and wins on order.
- **Trap: an unnamed `@container` query on anything inside a `.gmt-field-grid` resolves to
  the grid.** The grid is a container itself (`gmt-field-grid`), so a width rule for a label
  or a control in it reads the grid's width, not the section's. Name the section and query
  it by name, as the Timetable Reader does (`gmt-timetable-section`).
- **Trap: `.sl-markdown-content ul li` reaches a list inside a widget.** `gmt-content.css`
  gives every list item on a content page a dash (`::before`), left padding and a bottom
  margin. It is the site's own rule, so `not-content` does not switch it off. A `ul` in a
  widget resets all three with one more class than that rule, as the Timetable Reader's
  legend does (`.gmt-timetable .gmt-timetable-legend > li`).
- **Trap: the live wrapper in a hold cell must stretch.** A cell that holds its size stacks
  a hidden sizer and a live wrapper in one grid cell (`.gmt-timetable-hold`). The wrapper
  keeps the grid's default stretch, so its box is always the sizer's size. If it is aligned
  to the start instead, its height goes from 0 to the content's each time a note or a value
  appears, and `readout:still`, which measures the wrapper, reports it as a resize.
- **Trap: a bevelled corner hides the text under it.** `corner-shape: bevel` clips glyphs
  that sit in the cut corner, so first and last cells need at least 10px of inline padding.
- **Trap: the Converter Bench's pattern chips grow with the library.** `getRegexList`
  (`converter-bench-mount.ts`) lists every `RegExp` the `regex` barrel exports, so a new pattern
  under `packages/gmt/src/regex/` adds a chip with no Dox edit. The chip list grows, so
  `/tools/converter-bench/` and the reference page that embeds the bench
  (`convertZonedToZoned`) change height in a visual diff.
  `epcisEventTime` and `epcisTimeZoneOffset` are two such chips. Read that diff as expected; it
  is not a regression.
- **Trap: `Date.parse` is banned in tests too.** `date-ban.test.ts` and `oxlint` reject it
  in test files as well as source. Use `Temporal.Instant.from(…).epochMilliseconds`.
- **Result regions ease through `.gmt-grow`.** Sections after the first, and elements marked
  `data-grow="slot"`, change height smoothly: one shared observer and a frame loop with one step
  budget (40 px a frame in total, however late the frame) keep every step under the 48 px gate,
  where a CSS transition would double its step on a dropped frame, and the markup is wrapped at runtime so a reader without JS sees the server
  render. Section 1, the controls, is never wrapped, so popovers and focus rings do not clip.
  Rules: [reference/design-system.md § Smooth growth](reference/design-system.md#smooth-growth).
- **Tool pages:** `/tools/dst-inspector/`, `/tools/interval-visualizer/`,
  `/tools/converter-bench/`, `/tools/dwell-ledger/`, `/tools/free-time-ledger/`,
  `/tools/billing-deadlines/`, `/tools/delivery-scheduler/`, `/tools/connection-checker/`,
  `/tools/timetable-reader/`, `/tools/crossing-clock/`, `/tools/cutoff-stack/`,
  `/tools/cutoff-ruler/`, `/tools/cutoff-countdown/`, `/tools/punctuality-board/`,
  `/tools/eta-drift/`, `/tools/departure-board/`, `/tools/dtm-decoder/`,
  `/tools/x12-time-reader/`, plus the Tier 4 `/tools/zoned-earth/`
  and `/tools/zone-planner/`. Permalinks (`?w=&wa=`) seed a widget through `seedFromLocation`,
  with structural checks rather than zod so a docs page never pulls in the `ai` package. The
  Zone Planner's is `/tools/zone-planner/?w=planner&wa={"time":…,"zone1":…,"zone2":…}`: a UTC
  instant ending in `Z` and up to eight numbered zone ids, strings only (`permalinkOf` in
  `src/lib/zone-planner.ts`). `seededZones` also reads a `zones` array, which is what a chat
  call carries.
- **`seedFromLocation` keeps only top-level strings of 1–64 characters and years.** A widget
  whose arguments are lists or objects flattens them into numbered string keys (Delivery
  Scheduler, Timetable Reader, the Cut-off Stack's `name1`…`atLocalTime4`) or joined strings
  (Free Time Ledger, the Cut-off Stack's `weekend` and `holidays`), and the content-permalink
  test checks every key survives. The three TRAN-57 tools use a preset form, `{ preset }` plus
  each scalar that differs from it (`"none"` clears an optional one), and fall back to numbered
  list keys only for a list no preset holds, so a chat-seeded list survives the rail's
  copy-permalink. The two INT-15 tools carry flat strings: the DTM Decoder's `input`, `format` and
  `zone1`…`zone4`, and the X12 Time Reader's `date`, `time`, `timeCode`, `zone`, `zone2`…`zone4`,
  `format` and `value`. An old link that still carries a `yearWindow` loads without error and the
  key is ignored.
  - **Trap: build a permalink written into a page with `encodeWidgetPermalink`, never
    `encodeURIComponent` and never by hand.** A `DTM` segment ends in `'`, which
    `encodeURIComponent` leaves raw. The content-permalink test matches a link with
    `/\?w=([a-z]+)&wa=([^)"'\s]+)/` (`widget-permalink.test.ts`), so a raw `'` ends the match
    early and the test reads a cut-off link; a raw `+` in a query string decodes as a space.
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
  on each frame, on load and on input, in Chromium and WebKit at 1440 and 390 px. It asserts an HTTP 200 page, a root that
  matches, a largest painted jump of 48 px for the root and for `<main>` (the height read at the end
  of each frame's last `ResizeObserver` callback, before paint; the post-frame reading is kept as
  `rawMaxJump`, reported and never asserted, because a mount task between a frame and its sample can
  show a height that was pinned back before anything was drawn), every `.gmt-grow` at rest, a final height
  equal to the reduced-motion run's, and that each interaction it asks for (the select, the drag) actually
  happened. A tool's `drag` entry names the handle or range it drags, and for a custom handle the
  script reads the handle's parent as its track. The Timetable Reader's entry is `handle-1`, whose
  parent, its lane, is as wide as the track.
  A run that measured nothing, skipped an interaction, or crashed fails. Both gates are
  diagnostics: a few px of browser difference is read, not chased. `scripts/readout-still.mjs` (`pnpm run readout:still`) drags every handle
  in the Departure Board, Punctuality Board, ETA Drift Chart and Timetable Reader by keyboard and pointer, in Chromium
  and WebKit at 1440 and 390 px viewports, plus the widget root forced to 360 and 300 px (the rail widths); these
  are the script's defaults, so `pnpm run readout:still` with no arguments is the gate. It fails if a hero
  plate, the chart frame, the dragged control or anything above it moves or resizes
  (design-system.md § Drawn charts), if a required control is missing, if a handle's value does not
  change under the keyboard or the pointer, or if it checked nothing. `handle-early` and
  `handle-compare` are optional: a preset may not show them. So are the Timetable Reader's
  `handle-2` to `handle-4`, outside the presets that fill those rows. For the Timetable Reader
  the script measures every element in the widget, in all three sections (`scope: "widget"`),
  because a handle in section 1 must not move the table or the output below it. Only the
  insides of the day track, the plot and a hold cell's live wrapper may move (`drawn`), and each
  pointer sweep takes 48 steps of 30 minutes, so it always enters the shaded hour. The pass/fail decisions live in
  `scripts/gate-checks.mjs`, unit-tested in `gate-checks.test.ts`. A tool with no drag handle,
  such as the DTM Decoder and the X12 Time Reader, is not in `readout-still`; its definition of
  done measures the same boxes across every preset and zone instead.
  `scripts/html-diff.mjs` compares built widget markup (✗ the widget changed,
  ~ only the page around it did, + a new widget page with no baseline); `visual:diff` is the
  pixel gate.

## Tier 3 · HUD chrome

`DOX-D1`, `D2`

- **Glass:** `blur(24px) saturate(1.4) brightness(var(--gmt-brightness))` — `0.72` dark,
  `0.97` light, measured 11–16:1 for body text. A tinted fill, a hairline gradient border
  and a 1px inset highlight. There is no grain.
- **Corner brackets:** two L-shaped corners, top left and bottom right, on a few frames only
  (when one is right: [visual-design.md § Panels](reference/visual-design.md#panels)).
  `.gmt-brackets` (`gmt-primitives.css`, cyan) is on the home page's hero stage and on each
  `GridSection.astro` panel of the home page and `/why-gmt`. The transport tools share a
  second rule in `gmt-transport-widgets.css`, in the frame's own colour (`--leg-color`, else
  `--series`): it lists `.gmt-delivery-leg-fieldset` (the Delivery Scheduler's legs) and
  `.gmt-transport-leg--brackets` (the Timetable Reader's rows), so both tools draw the same
  frame from one rule.
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

`DOX-E1a`–`E1d`

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
  - **Error scopes never span an `await`.** A device's scopes are one stack, and every globe
    on the page shares the device, so a scope held open while its owner awaits catches the
    other globe's errors and the pops cross over. `withValidation` takes synchronous work
    only, and `createCheckedShaderModule` pops before it awaits the compiler; both are
    pinned by `webgpu/device.test.ts`. Async creation that reports its own failure —
    `createRenderPipelineAsync` — needs no scope.
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
    `listbox` for zone selection. The ambient spin eases in from rest over 2 s every time
    it starts — on mount and after any interruption — and never begins at full speed. The
    wheel is only swallowed while the zoom can still change, so a reader who scrolls onto
    the hero is not trapped on it.
  - Shading (`src/lib/globe/shading.ts`): day light, twilight and night are shaded per
    pixel from the sun's elevation. Stacked translucent caps were tried first and showed as
    rings and limb stripes. An atmosphere ring outside the limb follows the sun. Both
    washes are tokens that `gmt-a11y.css` zeroes under reduced transparency and raised
    contrast. `globe.ts` re-reads the theme when any of those preferences, or forced
    colours, changes.
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
  - **Earth imagery (`DOX-E1d`, #293).** In the dark theme, and in the landing hero in both,
    the WebGPU globe wraps NASA's Blue Marble round the sphere in place of the flat ocean
    and land. The light theme elsewhere and the canvas-2D fallback stay flat.
    - **The asset.** `public/earth-blue-marble.webp`: Blue Marble Next Generation with
      topography and bathymetry, July 2004, resampled to 4096×2048 WebP (about 530 KB) by
      `scripts/prepare-globe-imagery.py`, which records the source URL and the licence.
      Public domain in the US, as a work of the US Government (17 U.S.C. § 105). NASA's
      media guidelines ask that NASA be acknowledged as the source — a request, not a
      condition of use — and rule out its insignia and any implied endorsement; the script
      records all three. The credit is one quiet line at the foot of `why-gmt.mdx` — "Earth
      imagery: NASA Earth Observatory (Blue Marble Next Generation)." — off the homepage,
      with no logo. July, because the
      northern hemisphere, where most plotted zones are, is free of snow then. One static
      file — no tile service, no runtime dependency on anyone else's server.
    - **Loading.** `webgpu/imagery.ts` fetches it once the WebGPU renderer has started and
      its theme asks for imagery, decodes it with `createImageBitmap`, uploads it and builds
      the mips. Never awaited: the globe draws flat and is interactive meanwhile, then
      cross-fades over 600 ms (at once under reduced motion). The renderer asks for those
      frames through `RendererInit.invalidate`. A failed fetch, decode or upload leaves the
      flat globe and logs at `info`, nothing more. One texture per device, reference-counted
      like the device, because two globes on one page would otherwise hold two 45 MB copies.
    - **Sampling.** Stored `rgba8unorm-srgb`, so filtering and the mips run in linear light;
      the shader re-encodes before compositing, like every other colour. WebGPU has no
      `generateMipmap`, so each level is a render pass that box-filters the one above.
      `textureSampleGrad` with the analytic gradients `geoAt` already computes for the
      graticule: legal inside the on-sphere branch, and steady across the antimeridian, where
      screen-space derivatives of a wrapping longitude would pick the smallest mip and draw a
      seam. The sampler repeats in longitude, clamps in latitude, and is 16× anisotropic,
      which holds the poles sharp to within a few degrees, where the image is uniform ice.
    - **Shading.** The imagery is a photograph of a lit planet, so it takes the sun as a
      brightness — `imageryLight` in `shading.ts`, `dayFactor`'s falloff above a 0.18
      ambient floor — and stands in for the day wash, which fades out as it fades in. The
      night wash, haze, atmosphere, limb, graticule, region, markers and labels draw on top
      as before. The vector land fill and stroke fade out with it, down to the vector
      overlay's share below: the image has real coastlines.
    - **The cyber look (experimental).** Two tokens restyle the photograph, and both ship at
      1. `--gmt-globe-imagery-duotone` recolours it by brightness onto the globe's own ramp
      — the night colour, the ocean teal, the day cyan, the label ice — so the relief and
      coastlines survive and only the hues change. The dark end is the night colour, not the
      casing's, so retuning the casing for contrast leaves the Earth alone.
      `--gmt-globe-vector-overlay` keeps that share of the vector land fill and coastline on
      top instead of fading them out. That share is lit like the photograph under it, by
      `imageryLight`: the land layers draw after the night wash, so an unlit overlay kept
      night-side land as bright as day-side land and blurred the terminator. The day wash is
      deliberately not in the overlay: over a photograph that carries its own light it read
      as milky haze. The 0.18 ambient floor above is what keeps the night side dark enough
      for a crisp terminator under all of this. Both at 0 give the plain photograph back. An
      overlay on the plain photo alone was tried first and was too faint to see: the vector
      land is styled to sit quietly on the flat globe.
    - **The zoom fade.** `IMAGERY_FADE_START_ZOOM` (2) to `IMAGERY_FADE_END_ZOOM` (2.7) in
      `shading.ts`, interpolated into the WGSL. A 4096-wide image is roughly a texel per
      device pixel at rest and soft by 2×. The dissolve is short because half-way the photo
      mixed with the flat washes reads as murky; three presses of zoom-in already land on
      the vector look. Every imagery term in every shader is scaled by one weight, so at
      weight 0 the output is the flat globe exactly: at 5× it matches its own flat rendering
      pixel for pixel.
    - **Dark theme, and the landing hero.** The light theme sets `--gmt-globe-imagery-alpha`
      to 0 and keeps its own flat globe. The Blue Marble is a dark photograph: on the dark
      page it reads as the planet in space, but floating on the pale page it read as a hole,
      its glow as a smudge, and labels near the limb carried dark halos out onto white. A
      dark panel boxed round the globe was tried and rejected. What stayed is a full-width
      dark band behind the landing hero (`HeroGlobe.astro`), painted with a `border-image`
      outset so it spans the window from inside the content column without widening the
      page. A light-theme reader who never opens the front page never downloads the image.
    - **The hero is a dark island.** `.gmt-herostage` carries `.gmt-theme-dark`, which the
      dark blocks of `gmt-tokens.css` and of `gmt-theme.css` (Starlight's colours, mapped
      from ours) name beside `:root`. The island re-declares them on itself, so everything
      in it — the copy, the buttons, the globe, the zone list — resolves the dark values and
      draws exactly as in dark mode, imagery included, with nothing copied. Keeping that
      true takes four things: every light token has a dark counterpart; each `gmt-a11y.css`
      block that restates a token for `:root` names the island too, or its own declarations
      would undo the override; a light-only component rule that can reach inside
      (`gmt-light.css`, the selection and scrollbar rules in `gmt-controls.css`) excludes it
      with `:not(:where(.gmt-theme-dark *))`, which adds no specificity; and a dark-only
      rule the hero needs (`.sl-link-button.secondary`) names the island beside
      `[data-theme="dark"]`. `globe-stage.test.ts` pins the dark counterparts, the selector
      lists and the `gmt-a11y.css` blocks. The exclusions and the dark-only rule are not
      listed anywhere a unit test can read them; `pnpm globe:smoke` checks them, with the
      rest, by comparing the computed colours of every element in the hero across the two
      themes.
    - **Legibility, on every globe.** A cyan dot that reads on the ocean vanishes over the
      Sahara, and an outline over ice — and before #293's review the flat globe had the
      same gap: dark-theme labels at 3:1 against the lit limb, light-theme markers near
      1:1. So every marker, selection ring, label, region outline and arc sits on a dark
      casing (`--gmt-globe-casing`), always at full strength, on every globe and in both
      renderers. In the WebGPU shaders markers grow a disc or ring in the fragment shader,
      labels carry a halo in the atlas's green channel (glyphs are red), and the outline is
      the region-stroke coverage dilated by eight taps — cheaper than a second coverage
      target. The canvas-2D fallback strokes the same shapes wider in the casing colour
      first. `globe/casing.ts` holds the sizes both share, and `labelRingShift` slides the
      selected marker's label right until its halo clears the ring. The inks
      (`--gmt-globe-ink`, `--gmt-globe-marker`, `--gmt-globe-selected`, `--gmt-globe-gold`)
      are the same in both themes, with no light value, because the casing is what they
      contrast with. An earlier version faded the casing with the photo; it thinned out
      while bright photo was still behind a label, and labels fell to about 3.7:1 partway
      through the zoom fade. `globe-contrast.test.ts` measures every ink against its casing
      over a sweep of backdrops from black to white — labels at the 7:1 text floor, markers
      and outlines at 3:1 — and fails if any overlay token gains a light-theme value.
    - **Preferences.** `--gmt-globe-imagery-alpha` is 1 in the dark theme, and `gmt-a11y.css`
      zeroes it under `prefers-contrast: more` and `forced-colors: active`: a busy photograph
      behind the markers costs contrast that mode asked for, and a canvas is not repainted
      in the system palette. At 0 the image is never downloaded. Reduced transparency keeps
      it; the photograph is opaque. `globe-stage.test.ts` pins both switches.
    - **The smoke.** Parity between the renderers runs with the image withheld at the
      network, so it compares the vector layers alone and doubles as the failed-load check.
      In the dark theme, with the image allowed, it must be requested once and change the
      globe, and the landing hero in the light theme must request it too; at 5× the globe
      must match its flat rendering, captured still with the tooltip masked. The light
      theme's other globes, canvas-2D, the no-WebGPU fallback, raised contrast, forced
      colours and a reference page must make no request for it. The hero's computed colours
      must match across the two themes.
- **DST answers are not cached** (`src/lib/zone-clock.ts`). The library's rule (daylight time runs
  from a forward clock change to the backward change of the same size that undoes it, within 365
  days) reads the zone's transitions around the instant, so no key of zone, year and offset is
  complete: `America/Asuncion` at the same -03:00 is daylight time in January 2024 and not in
  December 2024, and Istanbul's 2016 summer reads as standard time because its advance was never
  undone. `hasDaylightSaving` is asked with `{ at }` for the instant read, so "No DST" is for the
  scrubbed date. A scrub step with eight zones costs about 5 ms for both calls.
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
  is a chat tool too (`showZonePlanner`, below), mounted in the rail by
  `src/lib/zone-planner-mount.ts`.
  - **Opening set.** With no link or call naming zones, the planner pins the reader's own zone
    first (`getSystemTimeZone`, via `openingPins`), then the tour: Reykjavik, Helsinki, Los
    Angeles, Shanghai, Calcutta, Katmandu. The reader's tile says "Your time zone" and takes a
    full border. A zone already in the tour moves to first place (compared by the engine's
    canonical id), and the list never exceeds eight. A zone with no coordinate, or the
    `getSystemTimeZone` sentinel, leaves the tour unchanged: the clock face needs no
    coordinate, but `decodeState` drops ids without one, so the share link would not
    reproduce the screen. A link (`?tz=`, `?w=planner`) or a chat call that names zones is
    shown as given, with nothing prepended; `getState()` and the permalink include the
    reader's zone. The zone arrives at mount with the rest of the tiles, which are all built
    there inside the `.gmt-grow` host, so it adds no jump of its own.
  - **Reference time.** With no seed the planner opens on now rounded forward (ceiling) to the
    next 5 minutes (`roundUnix`, in UTC, so a transition in the reader's zone cannot move it; an
    instant already on a boundary stays). The server renders no time at all (the whole planner is
    built at mount inside the `.gmt-grow` host), so there is no stale baked value to flash. A
    permalink's or a call's `time` is kept, to the slider's step. `initScrubber` takes `now` so a
    test injects the clock.
  - **DST at the scrubbed instant** (`src/lib/scrubber-dst.ts`). Every tile recomputes, on each
    step, from the library: `isInDaylightSaving` (through `zone-clock`, uncached) for the state and
    `getDstTransitions` (cached per zone and year) for the switches, so nothing is a typed date or
    hand-rolled offset arithmetic. A tile always says its state in words: a gold, bevelled
    outline pill `DST` (the home page's `--gmt-dst-gold` and `--gmt-dst-gold-ink`; a rounded pill
    where `corner-shape` is unsupported), muted `Standard time`, or muted `No DST` for a zone with
    no offset change in that year (so Istanbul is `DST` in 2010 and `No DST` in 2026). A
    crossed switch (between the reference time and the scrubbed instant) shows as `Spring forward
    +1 h` / `Fall back −1 h` (`+30 min` for Lord Howe) while the scrub stays past it; the offset
    line beside it is the new offset. A transition is any offset change the library lists, so
    Casablanca's Ramadan changes show as switches, and its pill follows the library's rule for
    daylight time (a forward change undone by a backward one within 365 days). Marks on the slider's track show each shown zone's switch inside the
    ±36 h range (decorative, `aria-hidden`; filled for a fall back). The state and switch have
    one reserved line each in every tile, so nothing resizes while dragging; they are not live
    regions, and one settled `role="status"` message (500 ms) names the crossed switches.
  - **Jump to the next DST transition** goes to the earliest switch strictly after the scrubbed
    instant among the shown zones, spring forward or fall back, up to two years ahead. It lands
    the reference time an hour before the switch and the slider two hours along, so the scrubbed
    instant is an hour after it: the tiles show the new state and the crossed switch, and
    dragging back shows the state before. Landing past the switch is what makes a second press go
    on to the next one. With no switch ahead the button is disabled and a line says so. The
    status line holds two lines, so a message arriving moves nothing.
  - **Reset to today** sets the reference time to now rounded forward again, read at the press, and
    the slider to 0. The link then carries that concrete time (so a link reproduces what the reader
    sees), as it does after a jump.

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
  - `showZonePlanner({ zones, time? })`: one to eight zones the planner can place (each has a
    coordinate in `globe-zones`), and an optional UTC instant ending in `Z` to start from;
    without it the planner starts at now. Its permalink is `?w=planner`, on
    `/tools/zone-planner/`.
  - `showDtmDecoder({ input, format?, zone1?, zone2?, zone3?, zone4? })` (INT-15):
    `input` is a whole `DTM` segment or a bare value, and `format` is needed with a bare value.
    A zone is passed only when the reader named it, never chosen from a port, a place, a
    partner or an abbreviation.
  - `showX12TimeReader({ date?, time?, timeCode?, zone?, zone2?, zone3?, zone4?, format?, value? })`
    (INT-15): one of `date`, `time` or `value` is required. `format` and `value` are the `DTP`
    pair. A zone is passed only when the reader named it, never chosen from the time code.
    Both schemas check a code's shape only (`ediCodeSchema`): a code the library does not read is
    the widget's sentinel to show, not a failed tool call.
- **Count:** 20 tools — the globe, the 18 teaching tools and the Zone Planner — and 20
  `CHAT_STARTERS`, one card each. `ENABLED_TOOL_NAMES` and `CHAT_STARTERS` hold the numbers;
  re-derive them from there.
- **Parity:** `ENABLED_TOOL_NAMES` equals the widget registry's keys
  (`widget-registry.test.ts`), and every enabled tool has a `CHAT_STARTERS` card
  (`chat-starters.test.ts`). A tool nobody can mount or discover cannot ship.
- **Example cards open their widget on the click.** The 20 `CHAT_STARTERS` live in the widget
  rail, not the empty chat, as a scrolling panel of bevelled cards (`ExamplesPanel.tsx`)
  grouped by area. Each entry carries an `area` from `EXAMPLE_AREAS` (Zones and DST,
  Intervals, Transport, "Intermodal, billing and EDI"), and `startersByArea()` returns the groups in
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
- **Trap: a build or a second Astro command breaks a running `astro dev`, in two ways.**
  - **The library's `dist`.** The dev server aliases `@northguild/gmt` to `packages/gmt/dist`
    (`gmtPkg` and `resolve.alias`, `astro.config.mjs:16` and `:70`), so it serves the built
    files straight from disk. `pnpm --filter @northguild/gmt build` and `pnpm run validate`
    rewrite `dist`; until the build ends, a widget on an open page cannot load its gmt
    modules. The pages work again once the build has ended and they are reloaded. Run a
    library build when no one is reading a dev page, and build a gate baseline in its own
    worktree, which has its own `dist`.
  - **Vite's dependency cache.** Vite keeps its pre-bundled dependencies in
    `apps/dox/node_modules/.vite/deps`, and every Astro or Vite process in the checkout uses
    that folder unless `DOX_VITE_CACHE_DIR` names another (`cacheDir`, `astro.config.mjs`).
    A second process rewrites the folder under the running server, which then answers
    `504 (Outdated Optimize Dep)` for its pre-bundled imports, `@js-temporal/polyfill` among
    them, on every page, until it is restarted. Reloading does not help.
    **Every Astro or Vite command an agent runs in `apps/dox` sets `DOX_VITE_CACHE_DIR` to a
    private folder**, such as one in the session scratchpad:
    `DOX_VITE_CACHE_DIR=$SP/vite-cache pnpm --filter @gmt/dox build`. That covers `astro`
    itself, the app's `build`, `check`, `typecheck`, `dev`, `dev:site`, `dev:chat` and
    `preview` scripts, and the root `validate`, which builds the app. Vitest and the `node`
    gate scripts that only read a built `dist` need nothing.
  - **A page in the 504 state shows no "could not load" notice.** The failed import is a
    static import of the page script, so the widget's mount never runs (§ Tier 2, "A widget
    that cannot load says so"). Dead widgets with no notice on every page mean the dev
    server needs a restart, not that a widget is broken.
- **A gate baseline is a clean worktree of the commit the branch is based on.**
  `html-diff.mjs capture` and `visual:before` run in a detached worktree at
  `git merge-base HEAD origin/main`, with its own install, library build and site build;
  `html-diff.mjs compare`, `visual:after` and `visual:diff` run in the branch. It is not the
  local `main` branch, which can lag `origin/main`, and it is not the working tree with changes
  set aside: a stash is shared by every worktree, and a baseline built over leftover generated
  files is not clean. The commands are in
  [specs/int-15-edi-timestamp-tools.md](specs/int-15-edi-timestamp-tools.md), step G7.
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
    attribute — both need a baseline captured from a clean worktree of the commit before that
    change (see the baseline runbook above);
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
  - a feedback loop (it would need its own privacy and hosting decisions).
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
