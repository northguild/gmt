# Dox — as built

What `apps/dox` ships, tier by tier: the decisions with their one-line reasons, the rules
that bind future changes, the traps, and the runbooks. Every story is done; status is in
[tracker.md](tracker.md). The history of how each tier got here lives in git, not here.

## Rules that bind every change

- **`apps/dox` must not perturb `packages/gmt`.** `pnpm run validate` stays green,
  including the CI time-zone matrix (`gmt-matrix` in `.github/workflows/ci.yml`; its zones and
  Node versions are in `src/data/gmt-stats.json`). No changesets unless a change also touches
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
  Per-function paths are forbidden by the exports map. A namespace barrel loads every module of
  its namespace and the root barrel loads every namespace, so neither is used. The Temporal
  polyfill loads with any module, because every module imports it. `regex` has no module
  subpaths, so its namespace barrel is its narrowest import.
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
- **A widget draws the library's results and computes none of them.** Every date, duration,
  verdict, class and total on screen is a library call, and the printed call is the call made. The
  polyfill is imported for drawing only (where a mark sits, formatting a returned duration). The
  site holds no table of the library's rules and guesses no zone: a zone, an offset or a code's
  kind comes from the reader or from the library, never from a place name, a port, an abbreviation
  or a lookup the site keeps. A preset is an example, and it carries its zones as literal fields.
- **GMT tracks no law, and the UI names no body.** No statute, regulation, regulator, court,
  docket, carrier rule or jurisdiction label appears in a widget string, preset, chat doc, page or
  test name; examples are labelled by their numbers ("30-day windows", "a 14/14/45 contract").
  Standards are named as data: DCSA field names, GS1 EPCIS 2.0, ISO/IEC 19987, UN/EDIFACT, ANSI
  X12, GTFS `frequencies.txt`. GMT computes dates, not liability: copy says "on or before the
  deadline" or "after the deadline", never `timely`, `late` as a finding, `void`, `payable` or
  `compliant`. A window has no default, so a blank window input is left out of the call, has no
  `placeholder`, and is never filled from a preset.
- **International authority first, no national lead.** Cite ISO, IEC, ITU, BIPM, IERS, IAU, IMO,
  CGPM and IGS/RINEX first, multinational industry bodies next, and a national source only as one
  labelled peer. No tool, preset or starter opens on `America/New_York`, `en-US` or a US-only
  example: rotate through `Europe/London`, `Asia/Tokyo`, `Australia/Sydney`,
  `America/Sao_Paulo`, `Africa/Johannesburg` and `Asia/Kolkata`, and keep a zone only where the
  example needs its DST shape or a standard's own code names it (an X12 time code such as `ET`).
  A locale, where one is needed, is regionless (`"en"`). A page that introduces X12 says it is a
  United States standard, and that GMT reads its code lists through an X12-licensed dictionary and
  not the X12 text.
- **Verdicts are words and patterns.** Early, late, on time, open, closed and moved are never
  amber, green or red. Amber is `NO SIGNAL` alone. A series colour goes on a mark, stem, edge,
  swatch or border and never on text (the `-ink` tokens measure only 5.7 to 6.7:1 on a light
  surface). Every text label inside a chart sits on an opaque plate (a chip or header strip on
  `--gmt-surface`, text in `--gmt-ice` or `--gmt-ice-dim`), never on a gradient, hatch, glow or
  line. Glow is a shadow on a mark, never on text, and there is no `backdrop-filter` inside a chart.
- **A holiday tool draws which rule closed which day with library calls on rule prefixes
  (`attributeRules`), and takes closed days only from the full calendar.** The library returns the
  closed dates but not the rule behind each; calling it on the rules before each one gives the
  rule's own dates without a shift computed on the site. This binds every later tool that draws a
  built calendar.
- **Helpers follow the zero-bug house rules.** No catch-all helper: split by kind with narrow
  unions and return one shape. No constant that ages: no fixed year window, century pivot, era
  count or "current era"; a preset's dates carry their year, and the eras to draw come from the
  library at the reader's today.

---

## Tiers 0–1 · Site, generator, AI surface, brand, guides

`DOX-A1`, `A2`, `A3a`, `A3b`, `A5`, `A4a`

- **Workspace.** `apps/dox` (`@gmt/dox`, private) runs Astro 7 + Starlight and depends on
  `@northguild/gmt` via `workspace:*`. It extends `astro/tsconfigs/strict`, never
  `tsconfig.base.json` (whose `composite`, `emitDeclarationOnly` and `customConditions`
  are wrong for an app), and declares `engines.node >=22.12.0` — Astro 7's floor.
- **Toolchain traps.**
  - `pnpm` runs scripts and `pnpm exec` on the Node that `devEngines.runtime` pins (26.12.1 or
    newer), whatever Node is on `PATH`. Only a bare `node` outside pnpm needs care: it follows
    the pin only when pnpm installed the global Node (`pnpm runtime set node 26 -g`).
    Otherwise use `pnpm exec node`, or on an `fnm` machine run
    `eval "$(fnm env)" && fnm use` first (`fnm use` alone is a silent no-op in a
    non-interactive shell). `.node-version` names `26.12.1` for tools that read it.
  - CI matrix jobs must keep running on the matrix Node: they install with `--no-runtime` and
    set `pnpm_config_verify_deps_before_run=false`. Without both, a later `pnpm run` reinstalls
    with the runtime and quietly switches the job to the pinned Node.
  - Starlight's `@astrojs/markdown-remark` peer is optional; don't declare it. `satteri` is
    pinned through `packageExtensions` in `pnpm-workspace.yaml`.
  - pnpm runs `pre`/`post` scripts (checked on 10.32.1 and 12.15.0: `predev` runs before
    `dev`). Steps that must stay together are still chained with `&&`.
  - `oxlint.config.js` is never loaded, so lint runs from the app. `.oxfmtrc.json`'s
    overrides are an allow-list that includes `apps/**`.
  - `workerd` needs `allowBuilds`.
- **Deploy.** Worker `gmt-dox` serves `https://northguild.dev/gmt/`, via
  `pnpm exec wrangler deploy` (the lockfile's Wrangler), with `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` as repo secrets. The Worker serves `dist/` through the `ASSETS` binding
  (`not_found_handling: "404-page"`).
  - **Route.** `northguild.dev/gmt*` is one pattern, because route matching includes the
    query string and a bare `northguild.dev/gmt` would miss `/gmt?a=1`. `workers_dev: true`
    is stated, because it defaults to `false` once `routes` is set. The landing page at `/`
    is a separate Worker in `northguild/northguild.dev` (Custom Domain); a Route beats a
    Custom Domain on the same hostname.
  - **Assets sit under the base.** Astro builds to `dist/gmt/` with `base: "/gmt"`, because
    Cloudflare looks assets up by full request path.
  - **`run_worker_first: ["/*", "!/gmt/", "!/gmt/*/", "!/gmt/*.*"]`.** Page URLs and files
    under `/gmt/` go to assets; everything else runs the Worker. Without an array, a browser
    navigation that matches no asset gets the 404 page and never reaches the Worker
    (`assets_navigation_prefers_asset_serving`). A `!` match is served by assets even when
    no file exists, so each negative is narrow: a trailing slash (a page) or a dot after
    `/gmt/` (a file). `/gmt/api/*` has neither and so reaches the Worker. A negative like
    `!/gmt/*` would send it to the 404 page.
  - **Worker.** Under the base (bare `/gmt` included) it does the `?key=` dev exchange
    first, then the 301 from bare `/gmt` to `/gmt/`, then `/gmt/api/*`, then `ASSETS`. On
    the legacy `workers.dev` host every path is a 301 to
    `https://northguild.dev/gmt<path><query>` with any `key` dropped from the query,
    except `/api/brains` and `/api/chat`, served in place because a redirect turns a POST
    into a GET and the hop is cross-origin with no CORS; `/robots.txt` goes to the landing
    page's `robots.txt`.
  - **`_redirects`.** The generator writes `src/generated/_redirects` and the
    `astro:build:done` hook in `src/lib/copy-redirects.ts` copies it to `dist/_redirects`,
    because Cloudflare reads it only at the assets root and Astro copies `public/` into
    `dist/gmt/`.
  - **Smoke.** `scripts/deploy-smoke.mjs` checks the redirect matrix after each deploy.
  - **`robots.txt`** is served by the landing Worker; crawlers read only the host root.
  - **Zone and dashboard setup** (zone settings, tokens, `www`, Web Analytics, org links) is
    in `context/domination/issues/CORE-86/runbook.md`.
- **Base `/gmt`.** Routes are base-less inside the site (generators, route manifest, corpus
  `page` and `url`, sidebar slugs). `src/lib/site.ts` holds `SITE_ORIGIN`, `SITE_BASE`,
  `SITE_URL` and `LEGACY_ORIGIN`, with `withBase`, `stripBase` and `isUnderBase`. `/gmt` is
  added where a URL leaves the code: the rehype plugin (`rehype-base-links.ts`),
  `prefixMarkdownLinks` for the `.md` twins, `llms*.txt`, the hero links, every `fetch`
  (through `withBase`) and `encodeWidgetPermalink`, which returns a base-prefixed path. It is
  stripped where code reads a path: `page-context.ts` and `resolve-href.ts`, which also
  accepts `SITE_ORIGIN`. `scripts/dist-base.test.ts` (scanners in
  `scripts/build-utils/dist-base.ts`) reads the built `dist` after the CI build: every
  `href`/`src`/`srcset`/social `content`/`data-*` URL in the HTML, every `url()` in the CSS
  (the Michroma `@font-face` included), the `.md` twins and `llms*.txt`, the sitemap `<loc>`s,
  `dist/_redirects` and the `/api/` and public-file strings in the bundled JS. A root URL
  without `/gmt` anywhere in `dist/` fails CI; `dist/` must hold only `gmt/` and `_redirects`.
  `CHUNKS_PATH` in `fetch-chunks.ts` is Worker-only code, not in `dist`, so
  `fetch-chunks.test.ts` guards it. The dev server serves `/gmt/` and proxies `/gmt/api`
  with no rewrite.
  - **The NorthGuild mark** (#424) is the header's way back to the landing page: a same-tab
    `<a>` to `LANDING_URL` (`https://northguild.dev/`, in `site.ts`) before the site title,
    named "NorthGuild home", on every page. The shield is inlined from
    `src/assets/northguild-logo.svg`, so the page theme reaches its paths. The dist guard
    allows exactly that URL in an `<a href>` (`LANDING` in `dist-base.ts`) and nowhere else;
    `judgeUrl` is unchanged.
- **Web Analytics.** Every HTML page loads Cloudflare's beacon
  (`static.cloudflareinsights.com/beacon.min.js`) from the `Head` override
  (`src/components/Head.astro`), in production builds only. The site is registered by
  hostname (`northguild.dev`) in the NorthGuild Cloudflare account, where the page views and
  visits are read.
  - The token in the script tag is public: it names the site entry and grants nothing.
  - The beacon sets no cookie and does not identify visitors.
  - Automatic injection stays off, so the beacon is never loaded twice.
- **Generator (`A3a`).** `scripts/build-reference.ts` uses the TypeScript compiler API
  (not TypeDoc) and emits one MDX page per exported function and regex, one per shared
  type, index pages, `gmt-corpus.json`, a typed route manifest (`ReadonlySet<string>`),
  `LIVE_PLAYGROUND_TEMPLATES` and `_redirects`. Outputs live under `src/generated/` and are rebuilt by
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
    - Duplicate type names (also by case), an unannotated return, and a generic public
      function stop the generator too. An overloaded public function gets one page that
      lists every overload, and stops the generator only if a later overload names a public
      type the first overload does not.
    - Anchors come from `github-slugger`, one slugger per page fed every heading in order,
      so they match what Starlight emits. The generator stops if a rendered page's headings
      differ from the list the anchors were computed from.
    - Every type link goes through `typeUrl` in `build-utils/reference-urls.ts`.
  - **A behaviour bullet may hold a fenced `text` or `ts` block**, which the generator
    copies verbatim (`behaviorItems`, `mdListItem`, `stripMdx`'s `outsideFences` for the text
    twins); any other language, none, or an unclosed fence fails the build. Shiki has no
    grammar for most notations (EBNF among them), and Expressive Code falls back to `txt`
    with only a log line, so a typo would pass unseen. The block never reaches the corpus,
    the export or the chat's retrieval chunks, which take only the summary, signature and
    examples.
    TypeScript keeps a fence's indentation under a bullet, so `outsideFences`
    (`page-markdown.ts`) matches an indented fence too; otherwise the text twins would rewrite
    the block as prose. `context/jsdoc-standards.md` states the rule for authors.
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
  - **Code in a table cell wraps only at set points.** A code token never breaks inside a word,
    at a hyphen or at a `.`. `src/lib/code-break.ts` (`codeBreakPieces`, `codeBreakHtml`,
    `codeBreakHast`, `codeBreakClass`) splits a cell's code at each run of spaces and directly after
    a `/` that joins two names (`Europe/` `Berlin`, `@northguild/` `gmt/` `zoned`): a letter, digit,
    `_` or `$` before it and a letter, `_`, `$` or `@` after it. So `//`, a lone ` / `, `1/2`,
    `<br/>` and `a/-b` are not break points. Each piece is
    `<span class="gmt-cw">` (`nowrap`), a joining `/` is followed by `<wbr>`, and the `code` carries
    `gmt-codebreak` (`white-space: pre-wrap`). Code with one piece comes back unchanged and keeps the
    plain `nowrap` rule. `rehype-table-scroll.ts` splits every Markdown cell's code, including a table
    already in a `.gmt-ref-table` box or inside MDX JSX; `codeSpans` in `migrate-view.ts` and the
    `set:html` cells of BehaviourMatrix, BundleSize and MigrationMap use the same helper, so a
    component's table wraps the same way.
  - **Entries layout.** `.gmt-ref-table[data-layout="entries"]` takes the Options entry for its rows
    (a block table, hidden header row, a wrapping flex row with a bottom hairline and a hover wash):
    the first cell is the entry's title, every other cell is a fact labelled with its column header
    (`data-col`), and an empty cell is hidden. It is for a table whose cells hold long code or that has
    too many columns for the article column. A table opts in where it is built: a component sets
    `data-layout` and `data-col` (BehaviourMatrix; UpstreamTracker through `UPSTREAM_COLUMNS`;
    LibraryCompare for the ids in `ENTRY_TABLES`; MigrationMap through `layout="entries"`), and a
    Markdown table takes an MDX comment that reads `table: entries` on the line directly above it.
    That comment reaches rehype as an `mdxFlowExpression` beside the table; the plugin sets the
    layout and `data-col`, removes it, and a paragraph between the two cancels it. The `.md` twin
    strips the comment. A table CI reports as scrolling gets the entries layout, never smaller
    padding or a pinned width.
  - **A label drawn into a table cell is out of its accessible name.** Generated `::before` text
    joins the cell's name with no space (`NoteThe string is…`), and every table that draws a column
    label into its cells (the entries layout, the Options, members and parameters entries, and the
    tool tables that stack on a narrow card) keeps its header row for screen readers. So each such
    rule declares the label twice: `content: attr(data-col);` for a browser without the alternative
    syntax, then `content: attr(data-col) / "";`. `src/lib/table-cell-label.test.ts` reads every
    stylesheet and fails on a table-cell label without the pair.
  - **Unit names print largest first.** The TypeScript printer lists a union in the checker's
    internal order, which changes with what else the program holds. `orderUnitUnions`
    (`build-utils.ts`) rewrites every type the generator prints: the signature, the
    Parameters, Options and Members types, and an inline type's values. In each union whose
    quoted members are unit names, those members read by descending magnitude, as the
    Temporal specification's table of units orders them: `years` to `nanoseconds` in the plural,
    then `year` to `nanosecond` in the singular. A union with two or more unit names reorders
    only its quoted slots: the unit names first, then any other quoted literal (`"dayOfWeek"`)
    in its printed order. An alias (`TimeUnit`), `DateUnit[]`, `null` and `""` keep their
    places, except that `""` goes last when every other member is a unit name or a unit alias
    (`DateUnit`, `TimeUnit`, `DateTimeUnit`, `keyof DurationLike`). A shared type page shows its
    declaration as the source writes it, so its order is the source's.
    `classifyType` gives an enum select the same order (`orderUnitChoices`): unit names first,
    largest first, then the other choices (`dayOfWeek`) in their original order, then `""`. The
    unit control's constants are declared in it, so a page's signature and its playground agree.
    `reference-unit-order.test.ts` scans every generated page, code blocks and table cells, and
    fails on a union of unit names out of this order. A `@param` description that lists unit
    names as a union is held to it too.
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
  - **Industries are declared, and each owns at most one namespace.** `src/data/industries.json`
    lists them in display order: `id`, `label`, a one-line `definition`, `icon`
    (`industry-<id>`), `guide`, the `namespace` it owns (or none) and the modules it `drawsOn`.
    Workforce owns `workforce`; Transport owns `transport` and draws on `workforce`; Intermodal
    owns `intermodal` and draws on `transport`; GNSS owns `gnss` and draws on `timescale`;
    Maritime owns none and draws on `gnss` and `timescale`. `src/lib/industry-tags.ts`, a leaf
    module, reads it (`INDUSTRIES`, `INDUSTRY_TAG_IDS` with `core` first, `OWN_NAMESPACES`,
    `industryOwning`, `drawsOn`, `industriesUsing`, `INDUSTRY_ICON_PATHS`); `core` and `space` are
    reserved ids. A drawn-on entry is a whole namespace or one sub-module (`moduleCovers`: a
    namespace covers its modules, a sub-module only itself, never by string prefix), and it is
    another industry's namespace (a shared industry layer) or a Core one. No generator types a
    list of industries, so a new one lands in every place below with no generator edit.
    - **Sidebar.** `buildSidebar` writes `Overview`, the Core namespace groups and `types` in
      alphabetical order, then a divider reading `By industry`, then the own-namespace groups in
      declared order, as siblings of the Core groups. Each group keeps its namespace name as its
      label (the import path) and its inner structure.
      - **The divider is text, not a group.** Starlight's sidebar holds only links and groups,
        so the generator writes it as a link entry with `attrs: { "data-gmt-divider": "true" }`
        and the `Sidebar` override (`src/components/Sidebar.astro`, with its own copy of
        `SidebarSublist.astro`) draws it as a `<span id>` under a thin rule, in the quiet text
        tier, and puts the entries after it in their own `<ul aria-labelledby>`. It is not a
        link, a `<details>` or a tab stop, and a screen reader hears the label before the list.
        Everything else is Starlight's markup, so current-page highlighting, a page opening
        only its ancestors, `sl-sidebar-state` and the mobile menu are unchanged. The divider is
        also a link in Starlight's data, so the override recomputes the previous and next links
        under a page without it. `SidebarSublist.astro` follows Starlight's file of the same
        name: compare them on a Starlight upgrade.
      - **The icon.** An own namespace's `Overview` link carries `attrs: { "data-gmt-industry":
        <id> }`; `Head.astro` writes one `--gmt-industry-icon` rule per own namespace from
        `industrySidebarCss()` (the tag's glyph as a mask), and a `:has()` rule in
        `gmt-shell.css` draws it before the group's label over the label colour, with
        `white-space: nowrap`. An industry with no namespace has no reference group and no rule.
        Forced colours repaint it in `CanvasText` (`gmt-a11y.css`).
      - **Tools, Scenarios, Mistakes and the industry guides use the same dividers.**
        `scripts/build-industry-sidebars.ts`, a `generate` step, reads each page's title,
        description and `industries` and writes `src/generated/{tools,scenarios,mistakes,guides-industries}-sidebar.ts`
        (`build-utils/industry-sidebar.ts`): the section's index page, then a divider for each
        industry with pages, in `INDUSTRY_TAG_IDS` order, with its pages by title. A page with no
        `industries` stops the step. Each divider's id comes from its link (`#tools-intermodal`,
        `#guides-industries-gnss`), so no two collide. A divider with `data-gmt-industry` shows the
        tag's glyph as an inline `aria-hidden` SVG in the label's own colour.
    - **Hubs.** `scripts/build-industry-pages.ts` (`build-utils/industry-pages.ts`), a `generate`
      step, writes `/industries/` ("By industry") and one `/industries/<id>/` per declared
      industry into `src/content/docs/industries/` (gitignored), from the corpus, the
      declarations, the hub text and the frontmatter of guides, tools, scenarios and mistakes. A
      hub holds the industry's `about`, "What these functions solve", "Start with the guide", "Its
      own functions", "Functions it draws on" (a module another industry owns reads "Part of the
      [X](/industries/x/) industry layer.") and the Guides, Tools, Scenarios and Mistakes pages
      tagged with it, by title. It also writes `src/generated/industries-sidebar.ts`, the
      collapsed Industries group before Guides: Overview, then one link per industry carrying
      `data-gmt-industry-link`, which shows the icon without matching the group-icon rule.
      `industryPages()` in `top-level-pages.ts` lists the hubs in `llms.txt` and `llms-full.txt`.
    - **Hub text.** `src/lib/industry-overview.ts` (`INDUSTRY_OVERVIEWS`) is the one hand-kept
      leaf, read only by `build-industry-pages.ts`: per declared industry an `about` paragraph
      and three to five `solves` pain points. A pain point is a short `problem` sentence (bold,
      naming no function), an `answer` of one or two sentences whose `{{functionName}}` tokens
      become function links, and the pages that show it. A token outside the industry's own
      namespace and the modules it draws on stops the generator. The `solves` list is where an
      industry links the tools and guides of a layer it draws on (Maritime links the GNSS tools,
      Transport the workforce guide and scenarios). `industry-overview.test.ts` fails when a
      declared industry has no text, a link has no page, a guide title drifts, or a sentence
      holds a digit, a law or the word GMT.
    - **Root page.** `/reference/` lists the Core namespaces under "For any industry", then "By
      industry": each industry's icon (`Icon.astro`, imported by the generated MDX; `stripMdx`
      drops the import and the tag), its label linked to its hub, its definition, its namespace
      and what it draws on. An own namespace's index page points at its hub (`hubPointer`).
    - **Page tag.** `withIndustry` writes `industries: [<id>]`, from `industryOwning`, into the
      frontmatter of every function page, module index and overview of an own namespace, so
      `PageTitle` shows the tag. A Core page has no tag, not even `core`, and `timescale` is
      Core. A shared type's page is tagged only when every public function that reaches it
      (`usedBy` in the usage graph) is in one own namespace (`typeIndustry`). The Markdown export
      of a tagged page gains the `Industry:` line.
    - **README and chart.** The README's "By industry:" line links `/industries/<id>/` for
      exactly the declared industries, in order, under their labels (`namespaceLinkProblems` rule
      2 in `scripts/stats.mjs`). `gmt-stats.json` `industryLayers` gives each industry its own
      count and its drawn-on modules; `industryFunctions` sums the own counts only, so no
      function is counted twice. `/why-gmt` stacks them (`industrySegments` in
      `src/lib/why-gmt-charts.ts`; rule in design-system.md § Drawn charts).
  - **The corpus keeps one entry per public type.** `url` is the link to cite (owner page
    plus `#anchor` for an inline type), `page` is the route that serves it, `inlineOn`
    names the owner function, `members` feeds retrieval. The route manifest is the unique
    `page` values plus the index routes. `scripts/api-surface.mjs` accepts a
    `/reference/…#fragment` link only when it is a corpus `url`.
  - **`src/generated/_redirects` is generated and ignored by git.** A type's old URL is a pure
    function of its source path, so each gets three `301` rules: bare, trailing slash and
    the `.md` twin. A renamed function cannot be derived: `scripts/build-utils/renamed-functions.ts`
    lists each released function that was renamed, and each gets the same three rules to its
    new page. The generation fails when a rename's target is not a function page or its source
    is one. Sources are written in the case the pages are built in. It holds the old
    `plain/validate/isLeapSecond`, now `hasSecond60` (the name went to the leap-second table
    check in `timescale/validate`), and the `duty/*` functions, now `workforce/*`. A page with
    no function behind it (a namespace index, a guide, a mistakes page) is listed in
    `scripts/build-utils/moved-pages.ts` (`/reference/duty/…`, the hours-of-work guide,
    `/mistakes/duty`) and gets the same three rules; generation fails unless the new path is
    live and the old one is not. An inline type redirects to its owner page and anchor. Astro's
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
- **Brand (`A5`).** A token layer mapped onto Starlight's variables; the system monospace stack
  (`--gmt-font-mono`) for body and code; Michroma, a display face, for headings only; self-hosted fonts; body text ≥ 7:1; amber
  reserved for the sentinel. See [reference/visual-design.md](reference/visual-design.md)
  and [reference/design-system.md](reference/design-system.md).
- **Search and share tags.** `src/lib/head-tags.ts` (pure) builds each docs page's head tags and
  `src/route-data.ts` (Starlight route middleware) applies them; `Head.astro` does not.
  - `<title>` is unique per page and ends ` · GMT` (`TITLE_SUFFIX`); the home page's title is its
    frontmatter title with no suffix. A reference page's `headTitle` is written by
    `scripts/build-utils/reference-title.ts` (at most 70 characters with the suffix).
  - Every page has a description of its own; only the home page uses the site's.
  - `og:image` is `/og/<key>.png` from `src/pages/og/[...route].ts`: one per guide, tool and
    scenario, one per reference namespace, else `site`. Fonts for them sit in `src/assets/og-fonts/`
    under SIL OFL 1.1.
  - JSON-LD: `SoftwareSourceCode` on the home page (version from `@northguild/gmt`),
    `BreadcrumbList` on every docs page, `TechArticle` on every guide with `dateModified`.
  - Every docs page links its Markdown twin (`<link rel="alternate" type="text/markdown">`); the
    twin route is `src/pages/[...slug].md.ts`, the path rule `src/lib/md-twin.ts`. A page with a
    `slug:` has its twin at `<slug>.md` (`reference/workforce.md`); any other page at its path
    (`guides/index.md`, the home page `index.md`). `scripts/llms.test.ts` checks every `.md` link
    in `llms.txt`, `llms-full.txt` and `_redirects` against `dist`.
  - No page carries an edit link: there is no Starlight `editLink` and no page sets `editUrl`.
    Starlight's `lastUpdated` is styled in `Footer.astro`.
  - The sitemap leaves out `/dox/`. The gate is `scripts/head-tags.test.ts` over `dist/gmt`.
- **Guides (`A4a`).** The guides under `src/content/docs/guides/` are the home of every
  feature's explanation and examples; the generated reference holds the signatures.
  `README.md` and `packages/gmt/README.md` are landing pages that hold neither, so a story
  that adds or changes a function adds to a guide and never to a README. The guides, by group:
  - `concepts/`: `plain-vs-zoned`, `dst-disambiguation` (written by `scripts/build-guides.mjs`
    from `docs/dst-disambiguation.md`), `standards`, `correct-at-the-edges`.
  - `core-date-operations/`: `get-current`, `plain-arithmetic`, `comparisons`, `durations`,
    `parsing`, `formatting`, `relative-time`, `validation`, `calendar-systems`,
    `business-calendars`, `operating-hours`, `nanosecond-precision`, `spans`,
    `leap-seconds-and-tai`.
  - `zoned-date-operations/`: `zoned-operations`, `calendar-boundaries`,
    `offset-instants-and-local-resolution`, `recurrence-and-cron`.
  - `conversion/`: `converting-types`, `foreign-epoch-bridges`.
  - `intervals/`: `interval-basics`, `containment-and-overlap`, `set-operations`,
    `splitting-and-counting`.
  - `integration/`: `app-integration`, `linting`, `skills` (its industry-skill table has one row
    per industry skill, with the industry's icon).
  - `industries/`: one guide per topic, each named for its industry
    (`transport-legs-and-dwell`, `gnss-system-time-and-week-rollover`,
    `maritime-gnss-time-and-week-rollover`, `workforce-hours-of-work`). The Guides sidebar is the
    index, then one autogenerated group per folder, except `industries`, which is the generated
    `guidesIndustriesSidebar` grouped by industry (`astro.config.mjs`).

  **DST walkthroughs and holiday presets lead with London and Sydney**, opposite hemispheres, so
  the two clocks change in opposite seasons; New York appears only as a labelled peer or where
  the subject is a US code (the X12 time codes). The DST Inspector opens on `Europe/London` 2024
  and the Converter Bench on a London wall time converted to `Australia/Sydney`.

  The domain `SKILL.md` Core Patterns teach the same patterns to agents. Maintainer and
  contributor skills are excluded.
- **`/compare/` is a top-level page**, in "Start here" after `why-gmt` (`astro.config.mjs`
  for the sidebar, `START_ORDER` in `src/lib/top-level-pages.ts` for `llms.txt` and
  `llms-full.txt`). `<LibraryCompare table="…">` renders each of its tables and the notes list
  from the builders in `src/lib/library-compare-tables.ts`, and `src/lib/mdx-jsx.ts` renders
  the same builders for the text surfaces (`.md`, `llms.txt`, the retrieval chunks), so the
  page and its text twin cannot state different figures. Its figures come only from
  `gmt-stats.json` and `library-measurements.json`; none is typed into `compare.mdx`.
- **`src/data/library-measurements.json` is the one source for the six other libraries.** It
  holds each library's name, measured facts (tests, CI executions, Node versions, time-zone
  and locale test files, public API) and provenance (version, repository, commit, command, CI
  configuration, `measuredOn`, note). `src/data/library-comparison.ts` reads it for every dox
  page, chart and card, and `scripts/stats.mjs` reads it for the READMEs' comparison table. A
  re-measurement is an edit to that file only: `pnpm stats:sync` then writes the READMEs, and
  the site renders from it.
- **`agent-prompt.test.ts` keeps `AGENT_PROMPT` (`src/lib/agent-prompt.ts`) equal to the
  fenced prompt** in `README.md`, `packages/gmt/README.md` and `CONTRIBUTING.md`. The constant
  is the source; a change to it goes into all three files in the same edit.
- **The `/upstream/` defect table reads each group's `state` from `temporal-compat.json`.**
  `stateLine` in `src/data/temporal-compat.ts` turns the state into the badge and count line for
  both the Astro row and the Markdown twin (`renderUpstreamDefects` in `src/lib/mdx-jsx.ts`). A
  `guard` row shows "Kept on purpose", its check count and the snapshot's `guard.reason`, because
  the canary (`pnpm compat:snapshot`) owns state: the page never reads `failing`, `through` or a
  version to choose a badge, and `toCompatGroup` fails the build on an unknown state or an
  incomplete guard. The badge has a full `--gmt-ice-dim-fill` border (`--gmt-border-strong`
  measures under the 3:1 bar in both themes) and wraps inside it at the table's 34rem minimum.
  The table sits in the site's table box (`.gmt-ref-table`, named by `data-label`), like every
  table on the site; `src/lib/ref-table.ts` makes the box a focusable, named region only while it
  overflows, so a desktop reader never lands on a box that cannot scroll. The Markdown
  twin runs every free-text cell (reason, what-breaks text, label) through `escapeMarkdownInline`
  so `_`, `*`, `[`, `<` and the rest read the way the HTML shows them. The label is "Kept on purpose"
  because it answers the column's question in familiar words, and "Guarded" already means the
  `gmtGuard` join of filings on the same page. A reason never says "probe" (a test rejects it), and
  `owner/repo#n` in a reason renders as a short link (`reasonParts`) only for a repository the
  site knows (`tc39/proposal-temporal`, `js-temporal/temporal-polyfill`), never inside a URL or
  after a word character, so `and/or#1` and `…/issues/3292#3` stay text. Both "ok" badges
  (`.gmt-defects-badge--ok`, `.gmt-upstream-badge--ok`) use `--gmt-cyan-ink`, not Starlight green
  (1.69:1 in light).
- **Migration pages.** `/migrate/` has an index, one page each for date-fns, Luxon, Day.js,
  Moment and `@internationalized/date`, and a Temporal page. `/compare/behaviour/` holds the
  full behaviour matrix. Each library page is a call-by-call table (`MigrationMap`, data in
  `src/data/migration-maps.ts`, one row per call, with GMT names checked against the corpus by
  `gmtFunction` in `src/lib/migrate-view.ts`), a short "What changes" list and the cases where
  that library differs from Temporal (`BehaviourDiffs`). The pages draw data and compute
  nothing; each has a Markdown twin in `src/lib/mdx-jsx.ts`. The Luxon page's call table
  (`rows`) uses the entries layout (`layout="entries"`), and so do the Day.js, Moment.js and
  Internationalized Date pages. Tables that keep the plain layout have a `40rem` minimum and a
  `16rem` note column.
  - **Matrix data.** `src/data/behaviour-matrix.json` is the output of
    `scripts/behaviour-matrix/run.mjs`, read through `src/data/behaviour-matrix.ts`. A page
    quotes a case by id (`checkedLine("<id>")`, `matrix.measuredOn`), never by retyping a
    result.
  - **Matrix runner.** `scripts/behaviour-matrix/` is its own folder, outside the workspace, with
    exact pins and its own `pnpm-workspace.yaml` (`allowBuilds` for esbuild). It is run by hand
    with `TZ=Asia/Kolkata pnpm matrix`; it bundles GMT's source, runs each case against every
    library and against native Temporal, and exits 2 when the polyfill and native Temporal
    disagree or `TZ` is UTC. Each cell carries one reason. A case where a library only
    appears to differ (not reproduced, or the cell is equal) is left out. The folder is
    gitignored for `node_modules`, `.cache` and the lockfile, and is skipped by `date-ban`,
    oxlint's date-library rule, fallow and Renovate.
  - **Rules.** Facts and links only, no adjective about another library; clauses cite
    tc39.es, rfc-editor.org, unicode.org or iso.org only; examples use international zones.
    Both the date-fns and Luxon pages say that `isValidDate("20240212")` is `false` on purpose
    (basic format; RFC 3339 §5.6).
  - **Sections.** `migrate` and `compare` pages each get their own share image
    (`OWN_IMAGE_SECTIONS`); `migrate/**` except the index also carries `TechArticle`. The
    sidebar group "Migrate" and the `/llms.txt` section come from `migratePages` in
    `src/lib/top-level-pages.ts`. Migration pages are not in the chat's retrieval corpus.
- **How-to guides.** `guides/how-to/` holds short task pages (add business days, convert
  between time zones, check that a local time exists), each with a worked example whose result
  the API-surface check runs. They carry `industries: [core]`, and avoid generic words in titles
  and descriptions, because the refusal tests in `search.test.ts` count weak matches.

## Tier 2 · Widget platform

**Component kit.** A widget is an Astro shell, a pure `renderTemplate` built from the kit, and a
`mount`. The kit is nine custom elements and a set of builders. The builders sit in
`src/widgets/builders`, re-exported from `builders/index.ts`: the layout set (`widget`, `card`,
`section`, `fieldGrid`, `field`, `hint`), `aside`, `badge`, `button`, `buttonRow`, `chartKey`,
`codeFrame`, `dataCredits`, `disclosure`, `hero`, `instant`, `loading`, `plates`, `select`,
`srOnly`, `switchField`, `swatch`, `table`, `textInput`, `toolLinks`, `verdict` and the timeline
pieces (`axis`, `lane`, `mark`, `tick`). The `html`, `raw` and `idScope` helpers escape and
scope. The elements sit in `src/widgets/primitives/<name>/`: `gmt-range`, `gmt-handle`,
`gmt-readout`, `gmt-preset`, `gmt-chips`, `gmt-copy`, `gmt-grow`, `gmt-listbox` and
`gmt-combobox`. A builder takes its accessible name as a required argument, so a piece without a
label does not compile. Family pieces, shared by the tools of one family, live in
`src/widgets/families/<family>/`. A tool's own layout is a CSS Module in `src/widgets/tools/`.

**Global sheets.** Only what styles the site is global, each in its `gmt.*` layer: `gmt-tokens.css`,
`gmt-theme.css`, `gmt-light.css`, `gmt-primitives.css`, `gmt-glass.css`, `gmt-shell.css`,
`gmt-content.css` with `gmt-content-tables.css`, `gmt-controls.css`, `gmt-reveal.css`,
`gmt-view-transitions.css`, `dox.css`, `gmt-a11y.css` (site rules), the chat sheets
(`chat.css`, `gmt-ask.css`, `gmt-ask-tailwind.css`, `gmt-hive.css`) and `gmt-widget-reset.css`
(the `not-content` restore, the syntax-token colours and the load-failure notice). The
`gmt.thirdparty` layer holds the sheets for DOM we do not render: `gmt-charts.css`, the map
tooltip shell, and the Pagefind and Starlight overrides. Every element we render is styled by a CSS
Module or a component `<style>` block. Content tables carry `data-col` (written by
`src/lib/rehype-table-scroll.ts`), so a stacked label reads `attr(data-col)` and no column name is
typed in CSS. The reveal stagger is `--gmt-reveal-i`, set by `scroll-reveal.ts`.
- **Finding a part.** `widget()` writes `data-widget` and `data-scope` on the root.
  `findWidget(root, name)` (`src/widgets/root.ts`, re-exported by the builders) returns the root
  and `part(local)`, which finds the part whose id the template wrote with `idScope`, and throws
  naming the part when it is missing.
- **Optional fields.** The label of an optional field ends in "(optional)", written by the caller
  in the label text (`At local time (optional)`); the kit has no separate chip. A required field
  has no marker.
- **Text fields.** `textInput` is always `type="text"`. `inputMode` picks the mobile keyboard,
  and `autocomplete`, `spellcheck: false` and `maxLength` quiet the browser where it would mangle
  a code or a timestamp; the tool's parser, not the control, judges the value. A native
  `number`, `date` or `datetime-local` control appears only where the platform's stepper or
  picker is the point, and lives in the family that needs it: `numberInput`
  (`families/timescale/number-input.ts`, a year), `dateInput`
  (`families/ledger/date-input.ts`, a calendar date; a value the control refuses leaves it empty
  and the mount keeps the refused string) and `utcDatetimeInput`
  (`families/zones/utc-datetime-input.ts`). `textArea` (`families/ledger/text-area.ts`) is the
  native multi-line field.
- **Tool links.** `toolLinks` writes a named group of links to other tools. Each link starts
  without an `href` and with `aria-disabled="true"`; `setToolLink` (`src/lib/widget-ui.ts`)
  gives it one when the widget has a result to send. In a test, `linkTarget(link)`
  (`src/test/render-widget.ts`) follows an in-page link to the element its fragment names, or
  returns `null` for a dead link.
- **Copy.** `copy()` writes `<gmt-copy>`: a native button and a polite status that says "Copied"
  or "Copy failed". With `reveal: true`, for text shown nowhere else on the page (a share link),
  a failed copy shows the text in the status, and it stays until the next click, so the reader
  can select it and copy it by hand (`src/widgets/primitives/copy/copy.ts`).
- **Combobox.** `combobox()` takes `placement: "above" | "below"` (default `below`). `above` is
  for a box in the lower half of a fixed-height column, where the list has no room below it.
- **Registration.** `defineElements()` runs on the first line of each `mountX()`, never at module
  top level, because SSR and node tests have no `customElements`. Each element extends a base
  that falls back to an empty class when `globalThis.HTMLElement` is missing. Each connection
  owns one `AbortController`, so a double connect or a removed element leaves no listener.
- **CSS Modules.** `generateScopedName` in `astro.config.mjs` names a class
  `gmt-<file>__<local>`. The name has no hash, so it is the same in every build and readable in
  the DOM. Tests do not rely on it.
- **Layer order.** `src/styles/gmt.css` declares `starlight, theme, base, components,
  utilities, vendor, gmt.tokens, gmt.base, gmt.shell, gmt.content, gmt.controls, gmt.tools,
  gmt.chat, gmt.thirdparty, gmt.a11y`. Unlayered rules win over every layer, so CSS Modules and
  Astro component styles beat every global rule. Modules need no `!important`.
- **Browser target.** Baseline 2024. `build.cssTarget` is `chrome130`, `edge130`, `firefox132`
  and `safari18.2`, the oldest engines `browserslist "baseline 2024"` lists. Stylelint's
  `use-baseline` rule holds the CSS to the same line.

**Widget tests.** A widget test follows Testing Library guidance. It finds things by role, label
or text and asserts what a person sees.
- **Helpers.** `src/test/render-widget.ts` is the only place that touches the DOM by hand:
  `renderWidget`, `setRange` (the one sanctioned direct input event), `expectNoAxeViolations` and
  `flushWidget`. `userEvent` drives clicks and keys.
- **Every component test runs `expectNoAxeViolations`.** `src/widgets/axe-guard.test.ts` fails
  a kit test that does not.
- **Lint rules.** The oxlint plugin `dox-test` bans `dispatchEvent`, class queries, `data-role`
  and `gmt-` house classes in tests. The plugin `dox-src` bans hand-typed markup, `nth-*`
  selectors, module-level instance counters and element registration at import time. Stylelint
  bans `!important`, id selectors, colour literals in modules and shared module classes.
- **Legacy lists only shrink.** `lint/legacy-test-files.mjs`, `lint/legacy-src-files.mjs` and
  the `LEGACY_FILES` list in `stylelint.config.mjs` name files by path, with no globs. A
  migrated file leaves the list and never returns.
- **Measured in Chromium.** `color-contrast` and `target-size` are off in `expectNoAxeViolations`,
  because jsdom has no layout. The `a11y-axe` and `contrast-measure` gates measure them.

**Widget roots and element identity.** Every widget root carries `data-widget="<mount name>"`,
`role="region"` and an `aria-label` that is the tool page's title (the playground's is
`<function> playground`, the globe's "Zoned Earth", the zone planner's "Zone Planner"). The
`/dox` starter pills use `data-starter`, so `data-widget` names widgets only. Gates find a widget
by `[data-widget="…"]`, never by a `.gmt-*` class. A finding's `target` is the element's identity
key from `scripts/lib/element-identity.mjs`: `widget:<slug> › role "name"`, with digit runs
collapsed, a name cut at 60 characters and `[n]` only on true repeats. The name is an author's
(`aria-label`, a label, a fieldset's legend, a table's caption, a figure's figcaption) or the text
of a role that ARIA names from content (a button, link or heading); any other element is keyed
with no text, so a month, weekday or verdict cannot move the key (a sibling inserted before an
unnamed one shifts its `[n]`). It never reads an id, a class or an `nth-*` position, so a `useId`
change or a class rename leaves the weekly issue's key alone. `recordFinding` throws without a
`target`. A Canada script's labelled message names no element, so `recordLabelled` keys it
`page › <slug of the message with its numbers stripped>`: two failures on one page keep two
issues, and the same failure measured at other sizes keeps one.

**How gates find a control or a part.** No gate script names a style class or a `data-role`: the
component kit hashes class names, so a class is a style detail. A control is found by
`getByRole(role, { name, exact: true })` inside `[data-widget="…"]` (`scripts/lib/locate.mjs`). A
structural part with no role or name (a chart frame, a drawn region, a drag track, a zone of a
card, the wall-clock text a screenshot masks) carries a `data-gate` hook, a space-separated list
of part names, found with `gate("part")`. The hooks are in the table below. A new mount puts
`data-gate` only on a part a gate measures and no role describes. Each gate with a
`--resolve-only` flag loads its pages and checks that every control and part it needs is there,
so a rename shows as a missing locator before it shows as a measurement.

**Gate diagnostics (`DOX-G1`, #430).** A gate that cannot measure says so; it never reports a
number it did not measure.

- `emulation-not-applied`: `contrast-measure` waits for `prefers-*` and forced-colour emulation to
  take effect, and a timeout is this finding, not a contrast failure.
- `layout-moved-during-measure`: `contrast-measure` collects the glyph rects again after its
  screenshots. A rect that moved more than 0.5 px fails the cell and drops its contrast findings,
  because they were measured on stale geometry. The message gives the largest shift.
- `focus-obscured` names the cover, the scroller and the viewport. The `/dox/` scrollers set
  `scroll-padding-block`, so focus lands clear of the sticky bars.
- A load jump names the frame, the deepest resized element and the font state. Each widget
  reserves its size, or sits in `<gmt-grow>`, and the fallback font is metric-matched.
- Every card and section sits on one opaque `--gmt-surface-widget`, so stacked tints cannot drop
  contrast below 7:1. The footer has its own opaque surface.
- Local checks run Chromium on macOS. Firefox and WebKit run weekly in CI; the footer contrast
  on Linux shows only there, and a weekly finding is fixed in the product, never waived.

**Gate hooks.** Every builder and primitive in the kit takes an optional `gate` string and writes
it with `gateAttr()` (`src/widgets/builders/gate.ts`); a few templates write `data-gate`
literally. One element may carry several names (`drawn track`). The table lists every hook a gate
script reads. `scripts/lib/locate.mjs` and `scripts/readout-still.mjs` point here and keep no
list of their own. A widget root is `data-widget="<tool slug>"` (`widget()` in
`src/widgets/builders/layout.ts` writes it); in a test, `findWidget(root, name).part(local)`
(`src/widgets/root.ts`) reaches a part by its scoped id.

| Hook                                                        | What it marks                                                                                                    | Read by                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `frame`                                                     | The frame around a tool's drawing (a card, or the tool's own frame)                                              | `readout-still`                                                   |
| `hero`                                                      | A hero plate row (`plates`, `instantHero`, `fuseStatus`): the result that must hold still                        | `readout-still`                                                   |
| `drawn`                                                     | A drawn part whose marks move with the value: a lane, plot, axis or ledger row. Its box is measured; its insides are not | `readout-still`                                                   |
| `track`                                                     | The lane a pointer drag runs along (`ledgerLane`, `gnssLane`, the punctuality tolerance track, `drawn track`)    | `readout-still` (`track`)                                         |
| `rider`                                                     | The value chip a `<gmt-range>` draws on its thumb (`range()` writes it on every range)                           | `readout-still` (rows with `riders: true`: its left may move)     |
| `hold`                                                      | A hold: a live wrapper (its first child) over hidden sizers, so the height is the longest text                   | `readout-still`                                                   |
| `grid`                                                      | A month grid (`monthGrid` writes it by default)                                                                  | `readout-still`                                                   |
| `codeframe`                                                 | The call code frame (`codeFrame`'s `gate` option)                                                                | `readout-still` (its text boxes are as wide as their text)        |
| `instant`                                                   | One piece of a written-out instant (`instant`)                                                                   | `readout-still` (same)                                            |
| `live`                                                      | Text or drawing that follows the wall clock: clock rows, the planner's readout and marks, a tooltip's time       | `visual-snapshot` (masked)                                        |
| `live-face`                                                 | The analogue dial of a zone tile                                                                                 | `visual-snapshot` (masked and hidden)                             |
| `grow`                                                      | A result region that eases to its height (`grow`'s `gate`, `MountedWidget`)                                      | `grow-measure` (at rest at the end)                               |
| `globe-stage`                                               | The globe's drawing stage                                                                                        | `globe-smoke`, `data-credits-check`, `visual-snapshot`            |
| `globe-zoom`                                                | The globe's zoom button group                                                                                    | `data-credits-check`                                              |
| `globe-tooltip`                                             | The globe's tooltip                                                                                              | `globe-smoke`                                                     |
| `hero-stage`                                                | The home page's hero globe stage                                                                                 | `globe-smoke`                                                     |
| `credited-frame`                                            | The `/why-gmt/` map frame that carries the data credit                                                           | `data-credits-check`                                              |
| `keypoints`, `keypoints-card`                               | The key-points section of a clock-change page, and each card in it                                               | `canada-layout-check`, `canada-stored-still` (cards)              |
| `browser`, `probe-table`                                    | The browser-probe card, and its table of probe results                                                           | `canada-layout-check`, `canada-stored-still` (`browser`)          |
| `map-stage`, `pickcard`, `map-block`                        | The map row's stage, the pin panel, and the map block                                                            | `canada-layout-check`, `canada-stored-still`                      |
| `map-section`, `map-frame`, `map-svg`, `map-shape`, `map-label` | The map's section, its frame, the drawing, the zone shapes, and the labels laid over it                      | `canada-layout-check`, `canada-clock-still`, `data-credits-check`, `contrast-measure` (`map-label`, `map-section`, `map-svg`) |
| `map-pin`, `pin-cell`, `pin-zone`                           | The pin, a cell of the pin panel, and its zone cell                                                              | `canada-layout-check`, `canada-clock-still`                       |
| `clocks`, `clock`, `clock-time`                             | The live-clocks card, one clock, and its time text                                                               | `canada-layout-check`, `canada-clock-still`, `canada-stored-still` |
| `servers`, `minimums`, `help`, `stack`                      | The servers card, the minimum-versions card, the help card, and the page's card stack                            | `canada-layout-check`                                             |
| `changes`, `transitions`                                    | The changes list and the transitions table of a clock-change page                                                | `canada-stored-still`                                             |
| `stored`                                                    | The stored-times section                                                                                         | `canada-layout-check`, `canada-stored-still`                      |
| `stored-form`                                               | The form of that section                                                                                         | `canada-clock-still`                                              |
| `stored-steps`, `stored-head`, `stored-toggle`, `stored-table` | The worked steps, the heading row, the show/hide toggle, and the results table of that section                | `canada-stored-still`                                             |

Shared hooks come first, then the globe, then the clock-change pages.


`DOX-B1a`, `B2a`–`B2d`

- **Playground on every example.** The generator renders the first `@example` as a static
  block — for no-JS and Pagefind — plus one `PlaygroundForm.astro` seeded from
  `LIVE_PLAYGROUND_TEMPLATES`. The form holds one control per argument. It assembles the call
  from them, shows it in the call line, and evaluates each argument with `new Function`
  (`evaluateArg` in `src/lib/playground-client.ts`) before it calls the real library.
  `GMT_MODULES` (`src/lib/gmt-modules.ts`) holds one dynamic import per module subpath, and
  `playgroundModule` gives each function its own module's key, so a page loads gmt only where a
  playground renders, and only the module that playground calls. `gmt-modules.test.ts` keeps the
  keys equal to the exports map's module subpaths.
  An object parameter gets the one-unit control, an amount field beside a unit select, when
  every property is a number and its property names are exactly one of the key sets in
  `scripts/build-utils/build-utils.ts`: all ten duration units (`ALL_DT_UNITS`), the date units
  (`DATE_UNITS`), the time units (`TIME_UNITS`), or the exact units, days plus the time units
  (`EXACT_UNITS`, the keys `totalUnits` takes). A Temporal field object (`setDate`) gets the
  same control over its number fields. The select lists the units in the order the constant
  declares, because the checker's order changes with what else the program holds. An enum
  select lists its unit-name choices in the same order (`orderUnitChoices`), then its other
  choices as they were, then `""`. Any other object parameter is a field of source text.
  A union of string literals is an enum select, with number literals too, but beside an open
  member (`number`, `bigint` or an object type, `isOpenMember` in `build-utils.ts`) it is a
  source-text field (`expr`), seeded with the example's argument as written, because a select
  cannot hold the open member: `RolloverEra` (`number | "rolling" | { notBefore }`) is one.
  An enum select carries per-choice examples (`choiceSeeds` on the template, built by
  `buildChoiceSeeds`): for each choice, the first `@example` that writes it as a quoted literal,
  whose other arguments are literals the form can hold and whose documented result is not a
  sentinel, supplies the other fields' values. The unit control holds one unit, so a unit object
  with two keys is not such a literal. Choosing that value loads them and runs the call
  when every other field still holds what the form last loaded; a field the reader edited is
  never overwritten, and a choice with no example only re-runs (`createSeedLoader` in
  `src/lib/playground-client.ts`). A function whose examples do not vary by choice has no
  `choiceSeeds`.
  - **Trap: the first `@example` of a function that takes a unit object writes one key.** The
    playground seeds from it, and a two-key object seeds amount `1` in the first listed unit.
- **Sentinel-aware output everywhere.** `""` / `null` / `false` / `[]` from invalid input
  renders as `⟨ NO SIGNAL ⟩` in amber, and a correct empty result is shown distinctly
  (the `readout` element's sentinel state, `SENTINEL_TEXT` in
  `src/widgets/primitives/readout/readout.ts`, and `NO_RESULT` in `builders/plates.ts`). In the
  playground, `playgroundResult` (`src/widgets/tools/playground-result.ts`) sets `data-state` to
  `live`, `sentinel` or `empty`, and `classifyPlaygroundResult` (`src/lib/playground-client.ts`) makes that call for every
  form. The generator classifies `object | null` returns as `object`, from the TypeScript
  type flags rather than the printed type. `null` is the sentinel for every kind unless the
  function is in `NULL_IS_EMPTY` (`scripts/build-utils/null-is-empty.ts`), the interval
  functions whose `null` also means "no shared span". Those render `null` as empty. The
  generator refuses an entry that is missing or not an object.
- **Teaching widgets:** DST inspector (`B2b`), interval visualizer (`B2c`), the converter
  bench with format and regex tester (`B2d`), the Dwell Ledger (TRAN-8, the first a realm
  story shipped; its day cells come from Temporal's `startOfDay`, so a 23-hour day is drawn
  23 hours wide), the Free Time Ledger (INT-12, the same day grid with each day drawn
  as the tariff reads it, a pattern and a word for each state; it imports the Dwell Ledger's grid helpers rather than copying them),
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
  The Timetable Reader's rules:
  - **Three full-width sections, stacked:** the timetable, what each printed time means, and
    the call. Each is a wide `section` builder, because a day track and a chart need the whole row.
  - **Pictures left, values right, from a 76.25rem section.** Sections 1 and 2 each hold a
    split of two panes (track and frames; chart and table; `timetable-reader.module.css`),
    in DOM order. From `w` = 76.25rem (a 1902px viewport) a split is a two-column grid,
    `minmax(28rem, 1fr) minmax(47.25rem, 1fr)` with a 1rem gap, held in `--tt-cols` on the
    root so both sections share one seam (separate cards, so not a subgrid). 47.25rem is the
    table's minimum; 28rem is the legibility floor of the track and chart. Every pane is a
    container (`tt-pane`, inside the `tt-section` container), so each breakpoint under the band is written once
    against the pane and holds stacked and split alike. Under the band the layout is the
    stacked one.
  - **One local-day track, a handle per row.** The track is the local calendar day of the
    first row that holds a valid time, 00:00 to 24:00 on the "Printed in" clock. Each row
    has its own lane and its own handle, a `gmt-handle`
    (`primitives/handle/handle.ts`): a `role="slider"` element, with pointer and key listeners delegated on the root.
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
  - **Smaller choices that stay fixed.**
    - A row on another date than the track's gets no handle, and its lane and the summary say so.
    - Arrow keys step 5 minutes; Shift, PageUp and PageDown step 60. The pointer snaps to the
      finest of 5, 10, 15 or 30 minutes that is at least 2.5px wide, so every preset time stays
      reachable.
    - A repeated hour is purple and a skipped hour gold (the DST Inspector's pair, which the
      Cut-off Ruler also follows). A band differs from row 3's purple marks by edge, pattern and
      words, and the legend has one swatch for each kind of band.
    - A band's edges are `etaAtZone` at the transition's two offsets, which holds for 30-minute
      shifts, midnight changes and a skipped whole day.
    - The exact axis is labelled in UTC, so "exact" never depends on a zone's clock. The chart
      draws a fitted window (a few hours of a 26-hour domain) and refits on settle.
    - An Offset option's label is at most `OFFSET_LABEL_MAX` characters, because the narrowest
      frame's select cuts off anything longer. Offset chips are placed by the mount, by
      measurement. The table is a real table only where every column holds its value on two
      lines; under that it is stacked rows, and the note sits in the table, not the frames.
    - `reason-aside` is the last element of section 3, because it can appear while a handle moves.

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
  Their charts share the `families/cutoff/` modules (`bands`, `gate`, `rolled-marks`,
  `countdown-face`, `stack-fieldsets`, each with its own `.module.css`). The three TRAN-57 tools
  and the Timetable Reader's day track and two-clocks chart draw from the same kit, in these
  parts:
  - **The surface:** bevelled tint-and-hairline chart panels with no `backdrop-filter`
    (never glass within glass).
  - **The DST colours:** purple (`--gmt-dst-purple`) marks a repeated hour and gold
    (`--gmt-dst-gold`) a skipped one. This is the DST Inspector's pair, and the charts of
    these charts that draw a clock change follow it: the Cut-off Ruler and the Timetable
    Reader. In these charts gold has no other meaning. Purple is also series 3, so a DST mark
    differs from a series mark in form as well: the Ruler's DST mark is dashed, vertical and
    labelled beside solid horizontal stems, and the Timetable Reader's band is a translucent
    region between its own edges (double for a repeated hour, dashed with a hatch for a
    skipped one) under a chip that names it, beside solid numbered marks. Tools outside
    these charts do not all use the pair: the Crossing Clock marks both kinds in purple, with the
    same double and dashed edges, and the Dwell Ledger and the Free Time Ledger flag a 23- or
    25-hour day in gold either way.
  - **The marks:** the cut-off mark (`families/cutoff/rolled-marks.ts`), a glowing bevelled marker, with a hollow, dashed
    variant for an unrolled position; and the gate (`families/cutoff/gate.ts`), a bright line for a cut-off
    or departure.
  - **The text plates:** the label plate, an opaque `--gmt-surface` plate that every
    label inside a chart sits on, so no glyph touches a gradient, hatch or line.
  - **The closed hatch:** a teal hatch under a void veil, plus a "closed"
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
  Rules these transport tools keep:
  - **A permalink that carries a list uses flat, numbered string keys** (`legCount` and
    numbered leg keys, numbered departures), because `seedFromLocation` keeps only top-level
    strings. `readArgs` accepts both shapes, and the content-permalink test covers every MDX
    link. A content link uses the preset form; the flat list form exists only for state that no
    preset holds, such as a chat-seeded list. Radio groups carry a per-mount suffix on every
    `name`, because a tool page and the `/dox` rail can both hold one.
  - **Delivery Scheduler's `diagnose` mirrors the library's check order**, and its test asserts
    for each reason that the real library returns `null` for that state, so a reorder in the
    library fails there. Writing an offset picks the other pass only in a repeated hour; in a
    skipped hour every offset returns `null`, and the Timetable Reader says both. The Connection
    Checker's onward leg falls back to `PT0S` in the port zone when the chat omits it, which
    cannot change the verdict, and the hint and printed call say so. Four tools, not one: the
    Crossing Clock draws hours on an hour ruler and links the Dwell Ledger for the day count.
    A 2-hour dwell on a 15-day axis is under 1% wide, so a bar has a minimum visible width,
    labels sit outside bars, and the leg list carries every value.
  - **Cut-off Countdown is live only when `now` is absent.** The bare page opens pinned on the
    pill preset, and the template never reads the clock. The Stack maps each schedule row back to
    an entry by the first unused entry with the same name and the same per-entry `cutoffAt`
    result, and shades a closed day when `rollDate(date, "following", calendar) === date`.
    `cutoffAt` does not check order, so a row out of order says so from `isPastCutoff` and is not
    drawn as an error.
  - **Punctuality tools:** `nextDeparture` returns `""` for invalid input and for "no departure
    qualifies", and the probes in `…NullReason` decide which one a state is, never a guess.
    `estimateDrift` returns `null` with one estimate (EST) record, which renders `NO SIGNAL`
    with the `one-estimate` reason. Rows on the Punctuality Board are not editable: the
    tolerance is the manipulation, and a reader's own data arrives through the chat or a
    permalink. A tolerance is labelled by its number only ("15-minute", "60/120-minute",
    "day-based"), and the words "regulation" and "regulator" never appear. Each of the three
    shows one labelled naive value of its own, never presented as a result.
  - **Billing Deadlines' day strip** caps at `MAX_STRIP_CELLS` 120 and collapses by ISO week
    (at most 63 cells) because 90 day cells in one row would be under 8px wide. The widget's
    date schema is its own `plainDateSchema`, so the date-time schema is untouched, and a window
    reaches the widget as a string in a permalink. The jurisdiction mapping table lives once, in
    the INT-12 guide's closing section, and the billing guide links to it.
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
  `formatX12Date` and `formatX12TimeElement` (the time in the form it was sent), and a second section that classifies a `DTP` qualifier
  (1250) and reads its value (1251) with the parser of that kind. A code or value the library does
  not read is the sentinel with one plain sentence: for a two-digit-year code, the pattern parsers
  with a `yearWindow`; for `CET` under `303`, that the field holds a signed hour, `UTC` or `GMT`.
  Both import `edi-widgets.ts` and load through `edi-lib.ts`. They share the two-pane split
  (pictures left, values right, one seam, stacked below a derived boundary), the member grid, the
  zone table, the timeline, the verdict plate and the holds that reserve every region's height
  (the `edi-figure` and `edi-timeline` builders and their CSS Modules, with `edi-picture.ts` and `edi-render.ts` holding the pure helpers), and the zone code (`widestGap`, in
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
    text it can show, hidden, in the same grid cell (`families/edi/edi-hold.ts`), so its height is the
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
  - **The X12 time is written back by `formatX12TimeElement`, in the form named by the digits
    typed**: `HHMM` for four, `HHMMSS` for six, `HHMMSSD` for seven and `HHMMSSDD` for eight. The
    value comes back in the form it was sent, tenths and hundredths of a second included, so
    nothing is cut and there is no note.
- **The ledger family and the INT-14 tools.** The Dwell Ledger and the Free Time Ledger share
  one family folder, `widgets/families/ledger/`, and one module, `ledger-widgets.ts`: glass day columns
  placed by each day's real bounds, pinned result plates (`platesHtml`; a `quiet` plate holds a
  secondary result at the smaller size), the lane, the half-open bar, the gate and its chip, and
  the legend. A column drops its weekday, then its label, as it narrows (`dayColumnFit`). It also
  drops its chips when they would reach past its edge (`--bare`), which `fitDayColumns` measures,
  because a chip's word sets its width. `thinTickLabels` thins the axis dates. Four tools build on
  this and on the EDI and transport helpers:
  - **B/L Date Stamp** (`/tools/bl-date-stamp/`): `bolTimestamp` read in the place's zone and in
    up to three more, each on a lane of that zone's real local days under one UTC lane, with one
    gate at the instant through every lane. One plate holds the B/L date, captioned by the event.
    The other holds the UTC date with "one day later", "one day earlier" or "same date"
    (`isAfterDate`, `areDatesEqual`). An optional latest date allowed adds "on or before" or
    "after" in words. A native range moves the instant across the local midnight.
  - **Demurrage Clock** (`/tools/demurrage-clock/`): one rail of the container's events over four
    lanes, demurrage, detention, storage and combined. Each lane is its own `demurrageClock` call.
    The chosen scope is lit and feeds the plates (the start event, the end event, how long the
    clock ran) and the printed call. A bar's start is a solid edge and its end an open one. The
    display zone sets the day columns only; it is not an argument of the call. A link opens the
    Free Time Ledger with the interval and the zone.
  - **EPCIS Event Reader** (`/tools/epcis-event-reader/`): the third EDI tool. `parseEpcisEvent`
    reads the two fields, which are taken apart as the DTM Decoder takes a value apart, and the
    same moment is drawn on a UTC rail and a local rail. `formatEpcisEvent` writes it back. A link
    opens the B/L Date Stamp with the instant, and the offset as its zone.
  - **Journey Split** (`/tools/journey-split/`): `multimodalETA`'s totals, with
    `scheduleDelivery`'s per-leg times, as two ribbons on one scale. The first shows the legs as
    they happen, moving solid and waiting hatched; the second gathers the same segments into
    moving and waiting. Plates hold the ETA, the moving total and the waiting total. Its leg
    fields are the Delivery Scheduler's (`widgets/families/transport/leg-fieldset.ts`, which labels `dwellAfter` "Handling
    after"), and the two tools link to each other with the same leg keys.

  `ledger-lib.ts` loads the B/L Date Stamp's and the Demurrage Clock's functions. The Journey
  Split's loader extends `transport-lib.ts` and the EPCIS Event Reader's extends `edi-lib.ts`, so
  no tool loads a module it does not use. Billing Deadlines holds its three deadlines in plates.
- **The holiday family** (CORE-54): three Core tools that draw `@northguild/gmt/calendar/rules`.
  Shared modules, none computing a date:
  - `holiday-lib.ts`: the loader (`calendar/rules`, `calendar/validate`, `plain/compare`),
    throwing `WidgetLoadError`. Moving Feasts' `feasts-lib.ts` extends it with `plain/calculate`.
  - `holiday-codec.ts`: a policy as tokens (`6<5`, `7>1`, `7w`) and a rule as one `;` line, both
    ways. In a name, calendar, month code or date, a `\` escapes `;`, `,` and itself, and `\n` is
    a line break, so a name keeps every character. It only reads text; whether a rule means
    anything is the library's call. It imports types only, so it stays out of the heavy-module
    list.
  - `holiday-widgets.ts`: `attributeRules(lib, spec, year)`, the month grid, week rows, legend and
    the seven-select policy editor. `buildBusinessCalendar` returns closed dates but not which rule
    closed each or where it moved from, so `attributeRules` calls the library on the rules before
    each one, over `year - 1 .. year + 1` as the library expands, and returns per-rule rows plus
    the full calendar. Closed days come from the full calendar alone.
  - A grid cell carries five mark kinds, each a word and a pattern, never a colour alone: closed,
    weekend, moved-from (a ghost), moved-to and pick. A month always draws six week rows, and a
    cell reserves three chip rows, so a year change never resizes the grid.
  - The family's modules are in `src/widgets/families/holiday/` (`holiday-frame`, `month-grid`,
    `week-strip`, `policy-editor`, `rule-card`, `compare-matrix`, `signal-plates`, `held-text`,
    `reserved-text`, `year-stepper`, `holiday-legend`), each with its own `.module.css`. No string names a country, a statute or a body.
  - **Holiday Rule Builder** (`/tools/holiday-rule-builder/`, `holidays`): an ordered list of up to
    `MAX_RULES` (12) rule rows of the five kinds, a weekend, a zone and a year. A row shows the
    days it closes; plates count the year, twelve month grids draw it and the printed
    `buildBusinessCalendar` call is the library's answer. A new row has no observance policy and
    a blank policy is left out of the call. Rows redraw only when the list changes shape, so
    focus and IME composition stay in a field. A year outside 1900 to 2100 turns the rows, plates,
    year note, call and output to NO SIGNAL or empty and leaves the grid unmarked, so nothing of
    the last valid year stays on screen. It hands the calendar to the Free Time Ledger
    (`basis: "working"`) and a `fixed` row to the Comparator.
  - **Observance Comparator** (`/tools/observance-comparator/`, `observance`): one to three
    month-day holidays, a span of years, a weekend and two to four policy columns make a matrix of
    years by policies, each cell the day `observedDate` gives. A row where columns disagree says
    so in words and by a hatch. Picking a cell shows that year's weeks, one lane per column. A
    column links to the Builder as `fixed` rules carrying its policy. Given one policy (a link or
    the chat), `readArgs` adds a column from the preset and lists it in `presetColumns`; a note
    under the columns names it until the reader changes or removes it.
  - **Moving Feasts** (`/tools/moving-feasts/`, `feasts`): a year slider (the reader's year
    plus or minus 100) and typed year move the Gregorian and Julian Easter Sundays across February
    to June, the distance between them and the toggled offsets from each, labelled with offset
    and name ("Easter −2 (Good Friday)"). A second section gives `nthWeekdayOfMonth` for a month,
    weekday and ordinal, with every occurrence carrying the ordinals it answers to. An ordinal
    with no such day draws NO SIGNAL; a legitimately empty result is never drawn as one.
  - **Holiday family layout rules.** A month grid never collapses: it always draws six week rows
    and an empty month keeps its reserved line. The Comparator's cells are two lines and the table
    stacks under 34rem. The rule and holiday lists carry `data-grow="slot"`. The Builder's call
    frame reserves its worst case through `ruleCallSizerText` and `pairBound`, and Moving Feasts
    holds its nth-note and call frame with sizers, so no readout resizes.
  - **Links and notes.** The Builder's compare link appears only for a valid `fixed` rule
    (`compareHandoffHref` asks the library). The Comparator's `holiday-note` says which seeded
    holidays are not dates. The Comparator's permalink adds a `year` key and repeatable custom
    columns.
- **The GNSS and leap-second family** (MAR-16): three GNSS tools and two Core ones. Each pure
  module takes a loaded library (`GnssLib` from `gnss-lib.ts`, or `TimescaleLib` from
  `timescale-lib.ts`, both throwing `WidgetLoadError`) and draws its results; the site holds no
  table of library rules. Shared modules: `gnss-names.ts` (counters, RINEX systems, the six
  systems, modes, in RINEX tokens), `gnss-widgets.ts` (eras, leads, durations, the no-reading
  texts) and `timescale-widgets.ts` (the insertions, and the two dates the site holds,
  `INTEGER_UTC_FROM` 1972-01-01 and `CONTINUOUS_UTC_FROM`). `widgets/families/gnss/` holds the
  family's frame, lanes, rulers, peer tables and hatched "your reading" row; the plates, chip
  and series come from the punctuality and cut-off families. Each tool also has its own module.
  Each has one signature drawing, `role="img"` with an
  aria-label and a visually hidden list:
  - **GNSS Week Decoder** (`/tools/gnss-week-decoder/`): an odometer ring. The counter's weeks
    run round a circle, one lap per era (era 0 outside, four lap slots), each lap with its era
    plate, a hand at the reading's week and the week and modulus in the hub. A RINEX week does not
    wrap, so it draws as an unwrapped track. Plates hold UTC, the system clock with its lead and
    the RINEX week; two tables give the moment on every counter and every RINEX system.
  - **Satellite Clock Converter** (`/tools/satellite-clock-converter/`): a ladder of seconds ahead
    of UTC, TAI the top rail, each clock a row at its rung, lit from the UTC baseline to TAI. A
    clock with no place on the scale (no reading, or inside an inserted second) is a compact
    dashed row in an in-flow group under the ladder, "No place on the scale", which reserves the
    most rows any slider stop puts there (`offReserve`). NO SIGNAL is an amber pill in its own
    slot under the stage, always laid out and only made visible, so it never covers a rung.
  - **GNSS Rollover Checker** (`/tools/gnss-rollover-checker/`): a fuse timeline, one track per
    counter from 1980 to 2170 grouped by counter width, a tick per wrap (the next taller), the
    firmware's window as a lit bracket, a spark where it goes wrong, and the check date and today
    as pins. Each group heading sits on the surface above the year lines and the check-date pin,
    so no line crosses it. The server draws a skeleton with the library's group sizes.
  - **Leap Second Timeline** (`/tools/leap-second-timeline/`): a staircase of TAI - UTC, a riser
    per inserted second, a hatched run from `CONTINUOUS_UTC_FROM`, the date as a cursor, the
    counted span as a band, and a checked `23:59:60` as a lit riser or a struck-through ghost.
  - **ID Timestamp Decoder** (`/tools/id-timestamp-decoder/`, `iddecode`, core): one pasted
    identifier goes, exactly as typed, to all five decoders (`fromUuidTimestamp`, `fromUlid`,
    `fromObjectId`, `fromKsuid`, `fromSnowflake`). A hero names the format that read it and its
    instant (a UUID adds its `version` as a chip, read from the id's own 15th character because `fromUuidTimestamp` returns the bare instant string, or `""`), and a fixed table shows every call and what it
    returned. A Snowflake is called only when the reader gives an epoch and a shift; with no
    layout its row says "Give an epoch and a shift: a Snowflake has no default layout." and makes no call,
    because the library has no default epoch to offer. `NO SIGNAL` shows only when all five
    returned a sentinel; a text that two decoders read is "N of 5", not a verdict. A preset
    fills the fields, and typing switches the select to "Your values". Epoch, precision and last
    instant are static prose on the page, held to the library by `id-timestamp-decoder-prose.test.ts`,
    so no widget module holds an epoch, a unit factor or an ID grammar.
    - **A blank id survives a link.** `permalinkOf` always writes `id` for a custom state, and
      `EMPTY_KEYS_BY_KIND` in `widget-permalink.ts` lets `iddecode` keep an empty `id` through
      the drop-empty-string rule, so a link made from a cleared field opens cleared, not on the
      default preset. Other tools' permalink behaviour is unchanged.
    - **The id limit is 96 characters** (`ID_MAX_CHARS`, the schema `id.max(96)`, and `KIND_STRING_CAPS`
      for `iddecode` and `colbridge` in `widget-permalink.ts`), so a longest-format id round trips.
    - **Snowflake presets are labelled by their literal values**, never a vendor name, because
      the library ships no layout constants.
    - **Nothing moves as the reader types.** The hero's value, pill and chip are laid out in every
      state and hidden with `[data-off] { visibility: hidden }`; each call and returned cell is a
      hold sized by the 64-character Snowflake call and the widest instant. The table is
      fixed-layout, with a doubled class on the first column (as the Stored Time Audit) and a
      labelled stacked layout below `46rem`.
    - **The `instant` builder (`builders/instant.ts`)** breaks a returned instant only after a
      `T` or before a fraction.
    - **The loader is `identifier-lib.ts`**, the pattern of `stored-time-lib.ts`; the Column
      Timestamp Bridge follows it (`column-bridge-lib.ts`) and has its own `BRIDGE_LINKS`, whose
      first link is back to this tool, as `ID_LINKS`' first link is to the Bridge.
  - **Column Timestamp Bridge** (`/tools/column-timestamp-bridge/`, `colbridge`, core): two
    modes. Encode takes one instant (or a zoneless wall time), an Arrow unit and an optional
    zone, and shows four format cards (Parquet INT96, Arrow int64, protobuf Timestamp, protobuf
    Duration) under an exact-instant hero and a four-row precision ladder. Decode takes the
    stored values (INT96 as a record or as 24 hex digits, an Arrow int64, a Timestamp pair, a
    Duration pair) and reads each filled fieldset with one call. `isValidInstant` (or
    `isValidDateTime` for a zoneless Arrow column) runs first, and the converters run only when
    it is true, so an instant into a zoneless column is a card with the sentinel `0n` and the
    reason, never a silent `0`. A typed zone is checked first with `isValidTimeZone`; an unknown
    one gives the Arrow card the other tools' sentence ("X is not a time zone this browser
    knows.") rather than a blank. For the nanosecond unit the card also asks
    `isValidInt64NanosecondInstant` / `isValidInt64NanosecondDateTime`, so a value past int64 is a
    sentinel `0n` card with the int64 reason, never a 1970 read-back. Arrow has two pairs:
    `toArrowTimestamp` / `fromArrowTimestamp` (a zone: UTC `Z` string) and
    `toArrowLocalTimestamp` / `fromArrowLocalTimestamp` (no zone: a wall time). Every read-back is a bare
    string, `""` on failure. A zoneless Arrow read is marked with an ice chip, never amber; a
    zoned Arrow card also shows the same int64 read under a zoneless schema. The hero's pill shows only when the input is not an instant and
    no card read it. A card that returned `0n`, `null` or `""` is a sentinel with its literal; a
    legitimate `0n` (the epoch in seconds) is a value; the `past-proto-range` preset's Arrow card is a sentinel (year 10000 is past int64 nanoseconds).
    - **Files:** `column-timestamp-bridge.ts` (pure reading), `-presets.ts` (the only module
      with a library-fact literal), `-mount.ts`, `column-bridge-lib.ts` (loader, three modules)
      and `ColumnTimestampBridge.astro`. `BRIDGE_LINKS` is the counterpart of the Decoder's `ID_LINKS`; neither imports the other.
    - **`readArgs` infers, the schema refuses.** Stored keys with no `mode`, no `value` and no
      preset open decode; `bytes` with no `int96Form` and no preset reads as the bytes form.
      `int96Form` is an enum (`record` or `bytes`). `columnBridgeProblems` in `dox-tools.ts`
      is shared by the zod schema (`superRefine`) and the Worker `execute`, which also checks
      the zone with `unknownZones`: Worker tests call `execute` directly, so a rule only in
      the schema would never run there. A contradiction is refused, never dropped.
    - **`VALUE_MAX_CHARS` is 96**, with the `short` schema limit and the link cap.
    - **Hold-still:** every card slot, the hero and the ladder rows are laid out in every state
      and hidden with `[data-off]`; the hold grids are `minmax(0, 1fr)`; cards are two by two
      above `40rem` of container and one column below. `renderValue` prints a bigint as `5n`
      and a `Uint8Array` as `new Uint8Array([...])`.
  - **Elapsed vs. Clock Difference** (`/tools/elapsed-vs-clock-difference/`): a sum of three
    plates (clock difference + leap seconds = seconds that passed) over two vernier rulers, one
    cell per second at equal widths. An inserted second is a stretched `:60` cell the clock tape
    skips and the elapsed tape fills, so the ends misalign by exactly the seconds inserted; a long
    span keeps the seconds at each end, a slashed break and every inserted second.
  - **Canada 2026 clock-change checker** (`/check/canada-2026-clock-change/`, core): lives under `check/`,
    not `tools/`, so `build-tool-index.ts` and `build-industry-sidebars.ts` read both
    directories (each tool carries its `directory`, links use `/${directory}/${slug}/`) and
    `industry-tags.test.ts` scans `check/`. A probe table (five zones at `PROBE_INSTANT`, the
    2026e column from `PROBE_ZONES`, the browser column from `Intl` at `PROBE_EPOCH_MS`, the Worker
    column from `GET /gmt/api/canada-clock-change`), the 2026 and 2027 transitions, five
    crystal clocks, and a hidden map section for the Canada map. Every offset and transition is
    computed by the Worker at request time; the page holds only the cited 2026e facts. A 429
    shows the retry delay and a failed fetch shows "The Dox Worker did not answer."; the cells
    stay `NO SIGNAL`. The clocks tick on one `setTimeout` per second, update the hands in place and
    switch offset at the zone's next change. `PROBE_EPOCH_MS` is a number so no native date is
    built. Tests never assert a 2026e offset as something the runtime computed, because the Node
    that runs them can carry older tz data than 2026e; the 2026e match is checked only by
    `deploy-smoke.mjs` on the deployed Worker.
    - **The Canada map** (`lib/zone-map.ts`, plain DOM; `lib/canada-map.ts` holds the projection and `CANADA_MAP`). One shape per zone from
      `timezone-boundaries-canada.json` in EPSG:3347's parameters (Lambert conformal conic,
      parallels 49 and 77, central meridian 91.866667 W, origin 63.390675 N; IOGP registry, also
      Statistics Canada's), fitted by `fitExtent` to an 800x640 `viewBox` with a 16 px inset; the SVG
      scales with its box. Every zone is in one of three dated classes from the Worker's `kind`:
      `stopped` (series 1 colour with a diagonal hatch), `changes-after` (series 3 colour,
      solid), `none` (neutral surface with dots); the words keep the year, from the region's `stopYear`. Colour sits on marks only; the pattern
      and the words carry the class. A zone with no Worker row has the display kind `no-data`, is neutral and is listed as "no data
      from the Dox Worker".
    - **The list comes first.** `canada-zones.json` renders one `<button data-tz-id>` per zone on
      the server (id, class words, offset), with a roving tab stop: arrow keys, Home and End move,
      Enter or Space pins, `aria-pressed` marks the pinned zone. Shapes are `role="button"` with
      `tabindex="-1"`, so Tab never walks them; hover and focus on either mirror to the other.
      Pinning writes `?zone=<id>` with `replaceState` and reads it back on load.
    - **The pin panel has one size.** Clock, offset, last and next change (`none in 2025 or 2026`
      style when `null`) and, for a `stopped` probe zone, the tzdb release; every row reserves
      its height, so pinning another zone moves nothing.
    - **Probe script.** `CanadaProbeScript.astro`, last in the page, runs `probeInlineSource(canadaProbe("canada"))`
      once the table is parsed, so the verdict and the Yours column are final before first paint.
      `stored-results` and the zone-kind label reserve their height so the late fill moves nothing.
      The page lists it in `mdx-jsx.ts`'s dropped components.
    - **Narrow fallback.** Below 520 px of section width (a container query in `families/clockcheck/zone-map.module.css`) the map and
      legend are hidden, the boundary file is not fetched, and the panel stays below the list, outside its
      scroll box, and scrolls into view when a reader pins.
      Zone ids carry a `<wbr>` after each `/` and keep each segment on one line (so
      `Blanc-Sablon` never splits at its hyphen), and no `overflow-wrap: anywhere` on an id. A
      two-form legend phrase carries its count inside each form (`legendCount` in
      `families/clockcheck/zone-map.ts`), so the count flows after the last word; `lib/zone-map.ts`
      sets every copy. The file is fetched once, when the map nears the viewport.
    - **In the chat** (`mountCanadaClockChangeWidget`). The rail mounts the same markup with
      the same markup with ids namespaced by `idPrefix`; the map's data-credits button takes
      `<idPrefix>-data-credits` (below). The rail is narrow, so the zone list is the map and there
      is no credits button. The mount
      awaits the library (a failed load rejects with `WidgetLoadError`), starts the Worker fetch
      without awaiting it, pins `zone` once the answer is drawn (an id not on the map leaves the
      widget unpinned), reads and writes no `?zone=` on the chat's URL, and ends every timer on
      destroy. On the page, `?w=canadaclock&wa=…` pins the same zone through `seedFromLocation`.
    - **Did your saved events move?** (section 5 of the same markup, so page and chat share
      it). It opens with one lead sentence and a three-step worked example (booked before the
      change, new rule, result) derived from the Vancouver `PROBE_ZONES` fact
      (`lib/canada-saved-example.ts`: 09:00, -08:00, -07:00, shown 10:00), so it cannot drift from
      the data. Below it, a script-driven `<form>` of real controls: an editor-style
      `<textarea name="lines">` (sticky beside the results from 72 rem), `<select name="zone">`
      over `STORED_ZONES`, Check, Reset example, and a native segmented All / Only moved toggle. The
      form `POST`s `FormData` to the same endpoint; the Worker reads each field with
      `typeof value === "string"` (a `File` counts as `""`, never `String()`), answers `400` for a
      zone outside `STORED_ZONES` or a body that is not a form or ends early, `413` for a body over
      65,536 bytes (read as a stream; `content-length` is not trusted), and `429` from the same
      `canada:` bucket GET uses. HEAD answers as GET with no body; a `405` carries
      `Allow: GET, HEAD, POST`. `capStoredInput` (`lib/clock-change-stored-lines.ts`, imports only
      constants, so the Worker shares it) cuts text over `STORED_MAX_BYTES` UTF-8 bytes at the last
      line break at or before that byte, makes `\r\n` and `\r` into `\n` first, splits, skips blank
      lines (their numbers still count) and keeps `STORED_MAX_LINES` (25: 50 lines of
      `classifyStoredZoned` took 8 to 10 ms of CPU warm and 24 ms on a cold isolate on workerd,
      against the 10 ms of the Workers Free plan; 25 lines take 4 to 5 ms warm); `truncated` is true only when a
      dropped part holds a non-blank character. `completeStoredLine` adds a zone only from what the
      reader typed or picked: a `[` leaves the line as written, `<time> <Zone>` becomes
      `<time>[<Zone>]`, one token takes the picked zone, anything else is `null` (shown as
      `NO SIGNAL`). Each row is `classifyStoredZoned` on the Worker's tz data; an empty `lines`
      answers `rows: []`.
      - **Rows** reuse the audit's pure helpers, loaded with a dynamic import on the first answer
        (the page carries no polyfill until then). A row has a badge (ok = cyan, moved = purple,
        can't check yet = muted; amber stays sentinel-only), the full saved value (it wraps) and
        the fix: a copyable keep-local value, plus the old-instant alternative. The summary reads
        "N checked · M moved", or "1 checked · none moved · 3 can't be checked yet". A table
        above 48 rem of container width, bordered cards below it. No result sentence says "now".
      - **A Worker with old tz data cannot judge the four zones.** The page also reads the zones
        answer and `staleZoneIds` (`lib/zone-map.ts`) lists the `STOPPED_ZONES` members that
        do not come back as `stopped`. Rows in those zones show "Can't check yet" and
        "Try again after the update." in muted text; the one alert sentence
        (`staleCheckText`, muted, no box) appears once, in the summary. Rendering waits until the
        stale zones and the audit module are both known.
      - **Held layout.** The status line and the narrow summary reserve their height, so an
        answer moves nothing above it. `scripts/canada-stored-still.mjs` measures the form against
        a build, in document coordinates, and presses Option+Tab in WebKit.
        `scripts/canada-layout-check.mjs` measures the map row.
      - **The ready signal (both checkers).** The mount sets `root.dataset.state = "ready"` right
        after the first `clocks.tick()` that has the Worker's answer, and `"error"` where it
        shows the 429 or failure line (`showUnavailable` still sets `"unavailable"`). The
        browser gates wait for it and read no readout text. `canada-clock-still.mjs` keeps its
        fake clock paused before `goto`; `canada-stored-still.mjs` runs on the real clock. Both
        call `waitForState` (`scripts/lib/clock-check-harness.mjs`), which waits in real time for
        60 s and fails with the state it saw. The harness stubs the Worker by method (GET fixture, the
        saved-times fixture for POST) and takes the region from a table keyed by page path that
        throws on an unknown path. `blockOffSite` routes by a URL pattern (every `http(s)` URL
        outside the base's origin), so a same-site chunk is never intercepted. Serve a build with
        `scripts/lib/static-server.mjs` (`node scripts/lib/static-server.mjs <root> <port>`, a
        listen backlog of 1024): `python3 -m http.server` (backlog of 5) dropped a module request
        in one of eight runs under load (`ERR_SOCKET_NOT_CONNECTED`), and the page then never
        reached `ready`.
      - **The saved-times results reserve follows the example's row count.** The template sets
        `--stored-rows` on the stored section's results (`presetRows`, the preset's non-empty
        lines). The reserve is a base for four rows plus a per-row step, one pair per container
        tier: 27rem + 4.75rem a row (table), 40.5rem + 8.75rem (cards), 48rem + 11.2rem (narrow
        cards; WebKit lays the narrow cards out about 15 px taller than Chromium). Canada's four
        rows keep their old reserve; Morocco's eight fit at 1440, 1024 and 375 in both engines.
        A reader who types more lines grows the page only after their own press.
      - **The status line says "Checking…" while a request runs** (`role="status"`, in the
        row held for it), and holds the answer or error text after. A screen reader hears it; the
        spinner on the button is CSS and `aria-busy` alone is not announced.
      - **The status line has its own row.** the status line in `families/clockcheck/stored-section.module.css`
        takes the full row under Check again (`flex: 1 1 100%`, one line reserved), at every
        width. Beside the button it wrapped under it at 375 px once a message arrived and the
        card grew 35 px. `canada-stored-still.mjs` holds the GET until it has recorded every
        card, answers it 200, 503 and 429 at 1440, 1024 and 375 px, and fails if any card or the
        page height changed (the saved-times answer echoes a row for each line the page sent,
        so the table is as tall as the page's own example makes it).
      - **One term: "saved events".** Key points check 3 defines it (appointments, bookings and
        shifts the app saved) and every link to `#canada-stored-title` uses the heading's words
        (`canada-help-card.test.ts` asserts it). `Saved with an offset` and `Saved as UTC only` say
        how an event was saved.
      - **Function names in the page text** only in key-points step 3 (`classifyStoredZoned`,
        `convertPlainDateTimeToZoned`) and the How gmt helps card, each linked to its reference
        page. The stored section links nowhere to the audit; the Related list names it.
    - **The How gmt helps card** (`HELP` in `data/canada-key-points.ts`, drawn by `helpCard` in `src/widgets/families/clockcheck/help-card.ts`).
      Shaped like the home page's fault cards: a lede, a Verified strip (the tests run on the
      newest release of each supported Node, the hosted server is checked daily) with an absolute
      link to `oh-canada.test.ts`, which `withBase` leaves alone, then one case card per kind of
      saved event (tag, `input -> output`, one line of why) and a button-styled link to the
      checker. It uses cyan tokens (amber stays the sentinel's) and `align-self: start`, so it
      does not stretch to the taller list beside it. `canada-help-card.test.ts` runs its claims
      against the real library using values no tzdb release changes.
    - **The Upgrade to at least card** is shared: `data/clock-change-minimums.ts` holds the types, the
      `MinimumsText` shape (heading, intro, footer, note, rows) and `minimumsMarkdown`; the card is
      `minimumsCard` in `families/clockcheck/info-card.ts`; each checker keeps only its words and rows
      (`data/canada-runtime-minimums.ts` exports `CANADA_MINIMUMS`). Its style is
      `info-card.module.css`. The card ends with `note`,
      one plain line (a paragraph after the footer, and the last line of
      `minimumsMarkdown`): gmt uses the time-zone rules of the device it runs on, and a device
      without the October 2026 update gets the four zones wrong from 1 November 2026. It names no
      function. Every sentence on the page reads true before and after 1 November 2026: no "will",
      no "right now", no relative months.
  - **Clock-change checker parts** (shared by every dated tz-change checker; Canada is the first
    user). A checker is a config over these modules, never a copy of them. Nothing in a shared
    file names a checker: each has a second-config test (`clock-change-second-config.test.ts`,
    id prefix `x`, no "canada" in the output) that holds that line. The shared markup and style are the
    modules in `src/widgets/families/clockcheck/`, each with its own `.module.css`:
    `checker-page` (the page frame and `classLegend`), `probe-card`, `info-card` (`serversCard`,
    `minimumsCard`), `help-card`, `key-points`, `clocks-card`, `clocks`, `change-list`,
    `stored-section`, `stored-table`, `tense-slot`, `zone-map`, `marks`, `stack` and
    `wrong-list`. The map tokens are `--zonemap-*`. A checker keeps only its own words, rows and
    layout.
    - **Years live once.** Each region states a `stopYear` (`CANADA_STOP_YEAR`,
      `MOROCCO_STOP_YEAR`); the years of the 2026 and 2027 groups come from `yearsOf(stopYear)`
      (`clock-change-mount.ts`). A map zone's `kind` is `"stopped" | "changes-after" | "none"`
      (`displayKind` adds `"no-data"` for a zone without a row; `classText(kind, id, view)` gives the visible
      words). The Worker's `mapZone(zone, now, stopYear)` reads `CheckEndpoint.stopYear`.
    - `lib/clock-change-mount.ts`: the one shared mount module: `loadClockLib`, `ask`,
      `yearsOf`, `loadTenseView`, `wallText` and `clockChangeWidget(mountPage)` (the
      chat wrapper). Listed as heavy in `widget-graph.test.ts`. Both region mounts are configs over it.
    - `clock-change-common.ts` `ProbeFact {zone, offset, release}`: Canada's former `tzdb2026e`
      and Morocco's `MOROCCO_EXPECTED` are the one field `offset`
      (`MOROCCO_FACTS`, `expectedOffset(zone)`); the runtime canary reads it.
    - `savedExample(fact, wall)` (`clock-change-stored.ts`): the saved-events example's
      offset text and shown date, wrapping past midnight with plain calendar arithmetic (no
      native `Date`, see `date-ban.test.ts`). Both `*-saved-example.ts` files call it.
    - `worker/clock-change-shared.ts` `probeRows` and `transitionRows` build the two JSON lists
      both Workers return; `worker/clock-change-shared.test.ts` runs a demo endpoint through 405,
      HEAD, 413, 429, 400 and 200.
    - **The table in a narrow card.** The zone id carries a `<wbr>` after each `/`. In a card under
      21rem (a container query in `families/clockcheck/probe-card.module.css`; the natural table is 313 px at
      its narrowest) the probe table **stacks**: each row is a two-column grid with the place and
      zone id across the full width and the two offsets side by side under it, the header row is
      the same two columns and the "Place" head is visually hidden. No word breaks and nothing
      scrolls sideways at 300 px. `display` on table elements drops the native semantics, so
      `clock-change-probe.ts` writes explicit `role`s (`table`, `rowgroup`, `row`,
      `columnheader`, `rowheader`, `cell`) in the markup at every width; do not remove them.
      `canada-layout-check.mjs` (`--engine webkit` too) fails a probe table wider than its card's
      content box, or a cell that holds more than its own box.
    - **The live clocks in a narrow card.** The clocks card is 260 px wide at a 1366 px viewport
      (checker 1018 px, map column 466 px). Below 16rem (a container query in
      `families/clockcheck/clocks.module.css`) the face, the time and the offset shrink so the offset stays beside the
      time. Without that the offset dropped under the time, five clocks grew by about 21 px each
      and the map card beside them stretched with 109 px empty. `canada-layout-check.mjs` fails
      "map card leaves N px empty"; run it across 1300 to 1440 px when the clocks change.
    - **The changes list wraps.** The list in `families/clockcheck/change-list.module.css` is `grid-template-columns:
      minmax(0, 1fr)`, and only the "when" cell keeps `white-space: nowrap`; the
      shift and UTC text wrap. At a 300 px page the nowrap text was 1 px wider than its card.
    - `lib/clock-change-common.ts`: `Change`, offset and wall-time helpers, `changeText`, the
      NO SIGNAL / tick / cross marks and `nodeProbeCommand`. One place for the words and checks
      the Worker and the page must agree on.
    - `lib/clock-change-probe.ts`: `ProbeConfig {idPrefix, zones, instants}`, `VerdictText`,
      `expectedAt`, `readBrowserOffset`, `probeInlineSource(config)`; the cards are `probeCard` and `serversCard`. The inline script finds its
      card by id `#<idPrefix>-browser`, so a second checker on the same site cannot be filled by
      the first one's script.
    - `lib/clock-change-clocks.ts`: `wireClocks`; the markup is `clocks` in `families/clockcheck/clocks.ts`. One `setTimeout`
      per second; the zone's next change switches the offset.
    - `lib/clock-change-stored-lines.ts`: the pure line rules the Worker and the page share
      (`capStoredInput`, `completeStoredLine`, the badge and fix text). `STORED_MAX_LINES = 25;`
      stays its own statement, because `deploy-smoke.mjs` reads it with a regex.
    - **The tense of a dated checker's words** (`lib/clock-change-tense.ts`). A region states each
      change as a `Moment {at, from}` (UTC instant, offset in force just before) and never types a
      date, a time or a verb tense by hand: `momentWords` writes them with `formatZonedDateTime` and
      `formatUtc`; `changeTense(lib, nowMs, atMs)` asks `isBeforeUnix` and takes the library as a
      parameter (the module stays pure for the Worker). The wording is
      "Stopped changing clocks on 20 September 2026 at 02:00 local time (01:00 UTC)".
      - **Morocco is past tense only.** Its change has happened, so `moroccoClassText` and
        `moroccoKeyPoints(when)` give one past form (`classPhrase(..., past = true)`); there is no
        `changeTense` call, two-form cell or timer in the Morocco mount. It reads the words once from
        `tenseView(lib, MOROCCO_MOMENTS, now)`.
      - **Canada is conditional until 1 November 2026.** `CANADA_MOMENTS` holds one moment per zone and
        `REGION_KEY` (the latest, Vancouver's). Each tensed phrase is written in both forms in one
        grid cell (`tenseSlot` in `families/clockcheck/tense-slot.ts`, the inactive form `aria-hidden` and `visibility:hidden`,
        so the box never moves); `bindTense` sets the forms and one timer for the nearest moment still
        ahead, and `onChange` calls `map.retense()`. Key-point paragraphs with a tensed part are
        written whole in both forms (`KeyPart {tense, before, after, dated}`; `dated` is the wording
        for text that runs no code). A new region with a future change reuses all of this.
      - The page and the chat read the words with `loadTenseView`, so the
        server render and the chat's `renderTemplate` state what is true now.
    - `lib/clock-change-stored.ts`: `StoredConfig {idPrefix, endpoint, zones, preset, example}`,
      `wireStoredTimes`; the markup is `storedSection` in `families/clockcheck/stored-section.ts`. The endpoint goes through `withBase`.
    - `data/clock-change-text.ts` (`KeyCard`, `HelpCard`) and `lib/clock-change-help.ts`
      (`helpMarkdown`): the Key points and How gmt helps cards as data. The HTML is `keyPoints` and
      `helpCard` in `families/clockcheck/`.
    - `lib/zone-map.ts`: `ZoneMapConfig {idPrefix, height, boundariesUrl, projection, stopped,
      classText, releaseOf, releaseRange, mapLabel, markerMinPx?, markers?}` and
      `wireZoneMap(root, zones, signal, deps, config)`, which returns `retense()` for the words that follow a clock (`deps.tense`). It finds its parts by `data-role`, never
      by class, so a checker may restyle them. A map taller or shorter than 640 sets
      `--zonemap-map-height` on the map section in the markup, so the box and the row's
      height are reserved before the drawing arrives. `markerMinPx` and `markers` draw a ring on a zone whose largest
      drawn part is smaller than the threshold (see the Morocco map below).
    - `worker/clock-change-shared.ts`: `CheckEndpoint {prefix, policy, storedZones, compute}` and
      `handleClockChangeCheck`, which holds the method order, `HEAD`, `POST`, the caps and the
      `Allow: GET, HEAD, POST` answer. The rate-limit bucket is `<prefix>:<clientId>`.
    - `scripts/prepare-region-boundaries.py --region <name>`: one `REGIONS` row per region
      (zone.tab country codes or `"frame"`, `frame`, `land_frame`, `box`, `min_area`, `tolerance`
      and the two files written); `oxfmt` formats the output.
    - **Coastlines.** The map draws Natural Earth land, not timezone-boundary-builder's shapes as
      they come, and the land around the zones.
      - **Zones are cut back to Natural Earth `ne_10m_land`** (`NE_TAG`, public domain), because
        tbb includes each zone's territorial sea: the Canaries and the Arctic islands draw as
        blobs and Hudson Bay fills in.
      - **One `{"land": "other"}` feature, written first,** holds the land inside `land_frame`
        that no zone covers (the United States and Greenland on Canada's map; none inside Morocco's
        box, see its zone rule below), because land outside the list reads as sea. It is the difference, never all the land, so no coastline is
        stored twice (Canada's file goes over 400 KB otherwise). `zone-map.ts` draws it first as
        one `aria-hidden`, `pointer-events: none` path (drawn by `families/clockcheck/zone-map.ts`); it is not a zone, so
        every walk over the features goes through `isZoneFeature`, and `canadaProjection` fits to
        `zonesOnly(...)` so it never changes Canada's scale.
      - **`land_frame` covers the whole drawn box,** the longitude/latitude bounds of the box's
        edge rounded out, because a frame that ends inside the box leaves a straight land edge
        there (Algeria, Mauritania, Greenland). `boundary-data.test.ts` samples the box's edge
        every 10 px, inverts each point and checks it lies in the row's `land_frame`. A conic
        box reaches well past its frame: Morocco's sides lie 3.7 degrees outside it.
      - **Size is spent on `tolerance` and `min_area`, never the 400 KB limit:** Canada 0.08 and
        0.02, Morocco 0.005 and 0.
      - **The fill is a step between the sea and the "never changes" fill, a hairline coast one
        step lighter,** from the existing tokens (`--zonemap-land*`); every class stroke keeps 3:1
        against it (`canada-palette.test.ts`). Both maps' credits list "Coastlines" after "Time
        zone boundaries" (`COASTLINES` in `data-credits.ts`).
    - **Place labels** (`lib/zone-map-labels.ts`, `labelLayer` in `families/clockcheck/zone-map.ts`). Labels are
      HTML over the drawing (an `aria-hidden` layer, `pointer-events: none`), not
      SVG text, so the type stays 12px at every frame width and the sea halo is a `text-shadow`
      (3px at 85% of the sea, 4.5:1 or better in both themes; forced colours draw CanvasText on a
      Canvas halo).
      - The zones with a live clock (`labelled`) keep a label; every other zone shows one while
        hovered, focused or pinned, one passing label at a time, a pinned one stays.
      - A label is the city (display face, `_` as a space) over the offset (mono, tabular, from
        `offsetAt`, or the NO SIGNAL mark). It sits at a stated `[lon, lat]` in `anchors`, inside
        the land, and a zone with no anchor takes its largest part's pole of inaccessibility.
      - Each label reserves its width and height, so showing or hiding one moves nothing.
      - A new anchor needs `zone-map.test.ts` (no overlap, none past the frame, from a 400px frame
        up) and `canada-layout-check.mjs` (the real boxes) to stay green. Reason: a label that
        covers a neighbour or a coast teaches the wrong zone.
    - **The map row** is one row of three (map, zone list, live clocks) from 62rem of the
      checker's own width (a container query, so the chat rail stacks too), with the pin panel as
      a full-width strip under it; below that the cards stack in that order and the stacked map
      stops at 70vh.
      - The pin panel is one size for every zone: `canada-clock-still.mjs` pins all 23 against a
        fixture with the longest texts and checks nothing moves.
      - The row's height is `--gmt-zonemap-row`, a registered `<length>`, `clamp(max(22rem, a 400px
        frame), 32cqw, 28rem)`, and the frame keeps the drawing's own aspect (800 by the
        `--zonemap-map-height`). The map's column is the frame plus the stage's padding and
        border. The cards are `inline-size` containers, so a `max-content` column would collapse.
      - Reason: the map's width must not set the row's height (a tall Morocco map made a 1000px
        row), and a frame that drifts from the drawing's aspect letterboxes the sea.
      - `canada-layout-check.mjs` holds the arrangement, the aspect within 2%, and at most 48px of
        empty space under any card's content.
    - Crystal-clock ids are `<idPrefix>-<zone>`, and each mount takes the prefix its template
      was rendered with, so the page and a chat widget share none.
  - **Morocco map** (`lib/morocco-map.ts`, `morocco-region-zones.json`,
    `public/timezone-boundaries-morocco.json`; a config over the shared map, no map code of its
    own):
    - **Zones: every zone whose shape meets the box, so no land in the box is left without a
      zone** (a bordered patch with no zone reads as a lost region; Mali was one). The region row
      says `"countries": "frame"`: the script takes every tzdb 2026e `zone.tab` row, whatever its
      country, whose timezone-boundary-builder 2026e shape meets `land_frame`, then drops each
      zone with no land inside the drawn box and names it in its output (`Africa/Niamey` and
      `Africa/Tunis` lie outside the box). That leaves fifteen zones: the ten of Morocco, Western
      Sahara, Algeria, Mauritania, Spain, Portugal and Gibraltar, plus `Africa/Bamako`,
      `Europe/Andorra`, `Europe/Monaco`, `Europe/Paris` and `Europe/Rome`. Canada's map keeps its
      country rule: land outside Canada reads as abroad. `zone.tab`, not `zone1970.tab`, because
      `zone1970.tab` folds Mauritania into `Africa/Abidjan`, a shape that covers twelve countries.
      The row's `box` states the projection that draws the box (the same parallels, central meridian
      and origin as `moroccoProjection`); the script rebuilds the box outline from it.
      `boundary-data.test.ts` checks that no pixel of the drawn box lies on the land feature and
      that every zone has land inside the box, using the real projection.
    - **Classes of the new zones** come from the Worker as for any other: Mali never changes
      clocks, France, Andorra, Monaco and Italy change in both years like Spain. Nothing types a
      year. The new zones get a passing label (hover, focus, pin) at their pole of
      inaccessibility; `zone-map.test.ts` checks every zone's label point lies inside its land.
    - **Frame:** 19 W to 5 E, 20.5 N to 44.5 N, so the Canary Islands, Madeira, Iberia, Morocco
      and Western Sahara fit. The script clips the land and the shapes to the row's `land_frame`
      (the box's bounds, see Coastlines above); the drawing's `clipExtent` cuts them at the box.
    - **Projection:** Lambert conformal conic with two standard parallels (EPSG method 9802, in
      IOGP Guidance Note 7-2): parallels 24.5 and 40.5 N, central meridian 7 W, origin 32.5 N,
      fitted to the frame (not to the data). Conformal, so shapes keep their form. No EPSG
      projected CRS covers the whole frame (EPSG v12.029 searched by area; the nearest, EPSG:3034,
      ends at 24.6 N), so the parameters are the frame's own. The box is 800 by 860.
    - **Small shapes:** a zone whose largest drawn part is under `markerMinPx: 12` also gets a 12
      px ring at its `zone.tab` coordinate (`markers`, written by the script as `coords`), so a
      pointer reaches `Europe/Gibraltar` and `Africa/Ceuta`. The test is on the largest part, not
      the whole shape: Ceuta and Melilla are two specks that span far more together. The ring is
      `tabindex="-1"`; the list stays the keyboard path.
    - **No country layer:** each country is one zone, so its zone outline is its border (Spain's
      islands and enclaves and Madeira are zones of their own), and the only line inside Morocco
      is tzdb's Casablanca / El Aaiun split. A country layer would add no line a reader needs and
      a second data licence.
    - **Stopped zones** come from the page's 2026c facts (`MOROCCO_ZONES`), not from the runtime,
      as Canada's do; every other zone keeps the class its row carries.
  - **Morocco 2026 clock-change checker** (`/check/morocco-2026-clock-change/`, core): the second
    user of the shared parts; `MoroccoClockChange.astro` and `MoroccoProbeScript.astro` are the
    Canada pair with `idPrefix: "morocco"`, and `lib/morocco-clock-change-mount.ts` is a config
    over them (its own layout is `tools/` CSS Modules and the shared `families/clockcheck/` modules). The rows
    are: Key points and the browser card; the map section (map, legend, pin panel, two clocks);
    the servers card and the **Upgrade to at least** card; **Clock changes your data gets wrong**
    and the help card; the 2026 and 2027 clock changes; saved events. A test fixes that order.
    - **Two instants, one verdict.** The browser card reads each zone at `MOROCCO_PROBE`'s
      `verdict` instant (2026-11-02, the Canada instant, where tzdb 2026c gives +00:00 and older
      data +01:00) and at its `blind` instant (2027-02-22, inside the 2026b data's Ramadan weeks,
      where old and new data both give +00:00). The verdict comes from the verdict row alone,
      because a browser with old data is right at the blind instant and a check there cannot tell
      old from new. The blind rows (`tr[data-blind-zone]`, so `tr[data-zone]` finds only verdict
      rows) show a plain offset, never a tick or cross, under one fixed sentence. The shared probe
      adds them only for a config with a `blind` instant (`blindInstants`), so Canada's inline
      script and markup are byte-identical.
    - **Stated changes** (`MOROCCO_CHANGES`, per zone): the 2026c stop (2026-09-20T01:00:00Z, +01:00
      to +00:00) and the two 2026b Ramadan changes it removed (2027-02-07 and 2027-03-14). The
      facts are the `Zone` and `Rule Morocco` lines in the tz source, quoted in the file's
      comments; `recordedBy` says which release holds each. The Worker reports `present` per
      zone from `getDstTransitions`, and the page words it as this server's data, never a verdict
      about the reader. A Worker with older data shows the flags inverted; the page states them
      as read.
    - **Preset** (`MOROCCO_PRESET`): four Moroccan lines whose kind changed in 2026c and four
      `[Europe/Lisbon]` lines that give one of each kind on any data. The labels never claim a
      kind: the kinds depend on the Worker's tz data.
    - **Map:** above. A Gibraltar and a Ceuta ring sat 8.9 viewBox units apart at r = 6, so
      `MARKER_NUDGE` moves each 0.12 degrees apart (north and south of its `zone.tab` point), and
      a test fails if any two drawn rings touch.
    - **Unique ids per instance.** Both mounts read the prefix their template was rendered with
      (`idPrefixOf`, from the browser card's id) and pass it to the clocks, the map and the stored
      form, so a page and a chat widget, or two widgets, share no id
      (`morocco-clock-change-mount.test.ts` checks a document holding two of each checker). This
      replaces the Canada literal `"canada"` that made the crystal-clock `clipPath` ids collide.
    - **The Upgrade to at least card** (`data/morocco-runtime-minimums.ts`, `MOROCCO_MINIMUMS`):
      - The release is 2026c or later, because 2026c is the first tzdb with Morocco and Western
        Sahara on +00 from 20 September 2026; a row that names an older tz is wrong for this page.
      - A line with no release that has the data is left out, never filled with "not fixed yet": that
        kind of row goes stale, and the card names only what exists.
      - Every row needs a primary source (release notes, the commit with the first release tag
        that contains it, or the distribution's package page), because a blog or tracker may be
        wrong about the tz version and the row exists to state it.
    - **In the chat** (`showMoroccoClockChange({ zone? })`, widget kind `moroccoclock`): the same
      markup with `renderMoroccoClockChangeWidgetTemplate(idPrefix)`; the zone must be in
      `morocco-region-zones.json`. Text surfaces get `keyPointsMarkdown(MOROCCO_KEY_POINTS)`, the
      servers, minimums and help markdown, and `MoroccoProbeScript` is dropped.
  - **Stored Time Audit** (`/tools/stored-time-audit/`, `storedaudit`, core): a textarea of
    stored zoned strings (12 lines of 80 characters), a fixed table with one row per line (kind
    badge, readings as nowrap tokens) and a two-lane strip for the selected line, the zone's
    clock over the exact timeline. A gap or an overlap draws a **day strip** (one
    `getDstTransitions` call, the band from `getTickerWindow`); an offset mismatch draws a
    **since strip**, the last clock change at or before `atZoneOffset`, looked up in the wall
    year and then the year before (at most two calls, so a Sao Paulo line stored in January
    2020 finds the 2019 change). A valid or unreadable line draws no strip and says why in a held
    reason slot. `classifyLocal` is not called: the DST Inspector's local-day grid fits only a
    gap or an overlap, so a mismatch has its own strip. A host note says the answer depends on
    the runtime's tzdb. Results are drawn at mount only; the `values` permalink key is exempt
    from the 64-character cap (`LONG_STRING_KEYS`, 1000).
    - **Readings wrap only at set points.** A reading breaks directly after a `T` that precedes
      a digit, or before the `.` of a fraction. Each segment is a nowrap span,
      joined by `<wbr>` (`families/stored/audit-table.ts`). The 33-character worst-case reading cannot fit whole beside the Line and
      Kind columns, so a token as a whole is not nowrap, and it can also break between its name
      and its value.
    - **The table needs a box of at least 736 px.** The container breakpoint in
      `families/stored/audit-table.module.css` is 46rem; a narrower box gets the labelled stacked layout.
    - **The Line column's width is set in the module**, and out-ranks
      `gmt-content.css`'s `th:first-child { width: 1% }`.
    - **The reason slot reserves its box**, so selecting another line never moves section 3.
    - **In the stacked layout the selected-row `td` has `background: none`.** The row already
      carries the tint, so there is no double tint and the 7:1 contrast holds.
    - **Definition of done, "nothing moves" (the bounding-box test).** jsdom has no layout, so
      the owner accepted a jsdom structural test plus the browser measurement taken in
      verification.
    - **Gate and live clocks.** `visual:diff` masks every element that reads "now" on the
      Zoned Earth and Zone Planner pages (`LIVE_CLOCK_SELECTORS`: the clock list rows, the
      planner's reference field, dials, times, dates, offsets, DST badges, readout and marks),
      and hides the planner's dials in the capture, because the "Your time zone" dial is
      drawn above the mask. The `tools-index-*` snapshots change when a tool card is added,
      and a new page has no baseline until the first snapshot.
  - **Duration Parser Bench** (`/tools/duration-parser-bench/`, `durationbench`, core): a text
    input (`maxlength` 64, never trimmed, so a leading space is a refusal the reader sees), a
    locale select and eight Try buttons. Section 2 reads the typed string with `parseDuration`
    then `parseHumanDuration` and shows which one accepted it, the ISO result, ten unit cells
    (`getDurationUnit`, years to nanoseconds; lit when non-zero), `formatHumanDuration`, the
    round trip back through `parseHumanDuration`, `formatDuration` in the chosen locale, and
    every call with its return in a call frame. Section 3 holds two fixed tables drawn at mount:
    seven spellings of a minute, a month and a millisecond (including `P1M`, which the human
    parser refuses), and a laytime table (`3 days` and `72h` from two Rotterdam start times).
    A widget draws the library's results and computes none, so `benchView` only calls `lib`.
    - **Table B's hours come from `totalDuration`** with a zoned `relativeTo`, never from a
      number written in the widget. `P3D` is 71 and 73 hours, `PT72H` is 72 and 72; the test
      asserts what the library returns. The note cites BIMCO Laytime Definitions 2013, no. 8
      (a laytime day is 24 consecutive hours).
    - **Layout is fixed.** Both tables are `table-layout: fixed` and override
      `gmt-content.css`'s `th:first-child { width: 1% }` (`families/duration/bench-parts.module.css`); below 46rem (a container query in that module) each row stacks into a labelled block. A
      locale change re-draws only the `formatDuration` cells of table A, and typing re-draws
      section 2 only. The ten-cell strip picks its
      columns from the container, not the viewport (a container query in `families/duration/bench-parts.module.css`: 10 from 60rem, 5 by
      default, 3 to 30rem, 2 to 20rem), so every value keeps room for 10 tabular digits
      (`min-inline-size: 10ch`) and nothing is clipped or ellipsised; a `title` tooltip is no
      help on touch. Labels wrap rather than truncate. Below 46rem the stacked table's
      `<caption>` is `display: block` at full width with `--gmt-space-3` padding, because a
      bare caption shrinks to fit, wraps word by word, and has its first letter clipped by the
      table's bevelled corner.
    - **Sentinel versus a plain answer.** A string neither parser reads shows
      `⟨ NO SIGNAL — invalid input ⟩` and a static refusal line. In a string one parser reads,
      the other parser's `""` is a plain answer (`""`), as in the Stored Time Audit's call frame.
      Table cells whose call returned `""` (such as `parseDuration` on `1m`) show `⟨ NO SIGNAL ⟩`
      because that is what the library said.
    - **The bench makes six calls** (`parseHumanDuration`, `formatHumanDuration`,
      `parseDuration`, `formatDuration`, `getDurationUnit` and `totalDuration`), not only the
      three the story first named. The pure module and the loader are in the `heavy` list of
      `widget-graph.test.ts`. No drag handle, so it is not in `readout-still`'s `TOOLS`.
    - **The bench links the `parseHumanDuration` page, not a grammar anchor.** That page has no
      heading for the grammar: the EBNF and the unit table are bullets of the behaviour list
      under "Signature", and the page's headings are Signature, Parameters, Returns, Examples
      and Source. So there is no anchor to link, and the bench copies no grammar and points at
      the page.
    - **The EBNF is a `text` fence** (decision: Shiki has no EBNF grammar, and an unknown
      language would render as plain text with only a log line). The bullet's prose names the
      notation, "ISO/IEC 14977 EBNF", so the reader knows what the block is.

  The decoder links to the converter and the checker, the converter to the decoder and the
  timeline, the checker to the decoder, and the timeline and the elapsed tool to each other and
  to the converter; `gnss-tool-links.test.ts` runs each link through `seedFromLocation` into its
  target. States are words and patterns, never a verdict colour.
  - **The six constellations are peers, with the scope said once.** The short form is "IMO
    recognises GPS, GLONASS, BeiDou, Galileo, NavIC (IRNSS) and QZSS as components of the
    Worldwide Radionavigation System" (the Maritime Safety Committee, 104th session, October
    2021). The full citation is the policy of IMO resolution A.1046(27) (2011), whose annex
    MSC.599(111) (2026) revised, with GPS and GLONASS by A.860(20), BeiDou by SN.1/Circ.329,
    Galileo by SN.1/Circ.334, IRNSS by SN.1/Circ.340 and QZSS by SN.1/Circ.341. A.1046(27) names
    no system, so it is never cited alone for the six. Wherever a page or tool says "peers" it
    says recognition is not equal everywhere: BeiDou and IRNSS are recognised for ocean waters,
    and IRNSS only within 55°E to 110°E and 50°N to 5°S. IEC 61108 is cited per system only
    (parts 1, 2, 3, 5 and 6; it has no QZSS part), and IEC 61162-1:2024 only for the sentence
    format shipboard equipment uses. No market report is cited for the GNSS layer.
  - **GLONASS is the RINEX and BIPM `GLO` scale only.** Where a page says what `GLO` is, it says
    "GLONASS time as RINEX and the BIPM report it, in UTC's own hours, and the library reads no
    other GLONASS scale". No string on the site mentions UTC+3, Moscow time, MSK or a three-hour
    shift, and there is no GLONASS week mode. A RINEX `BDT` week counts from 2006-01-01 BDT;
    `GPS`, `QZS`, `GAL` and `IRN` count from 1980-01-06.
  - **Firmware is modelled as a build-date pivot** (`{ notBefore }`, the default, as real
    receivers behave) or as a fixed era, and the Rollover Checker shows when it starts
    reporting wrong dates. The decoder's era input accepts the pivot too. The two dates the site
    holds are cited constants: `1972-01-01T00:00:00Z` (whole-second UTC from 1972, BIPM and
    ITU-R TF.460-6) and `2027-05-20` (continuous UTC, CGPM 2026 Resolution 5).
  - **Tags and tool placement.** The Leap Second Timeline and Elapsed vs. Clock Difference are
    tagged Core, in the chat area "Leap seconds and TAI"; the three GNSS tools and the GNSS
    scenarios are `gnss`; the duty scenarios are `workforce`. `mistakes/duty` is
    `mistakes/workforce`, with a redirect. Maritime and Transport link the `gnss` pages from their
    hub's `solves` list. The "By industry" chart is stacked: each industry's own functions solid,
    the layers it draws on lighter and named, and no function counted twice in any total. The
    industry order follows what builds on what: Workforce, Transport, Intermodal, GNSS, Maritime.
    Maritime owns no namespace yet and draws on `gnss` and `timescale`; Intermodal draws on
    `transport`.
  - **Industry overview text lives on `/industries/<id>/`**, in a top-level "Industries" sidebar
    group after "Start here", and each namespace index under `/reference/` keeps a one-line
    pointer. `space` is never an industry, area, kind or namespace name, because a planned spatial
    expansion takes the word.
- **Cron in a Zone** (CORE-84, `/tools/cron-in-a-zone/`, `cronzone`): a Core tool that draws
  `@northguild/gmt/recurrence`. The reader types a five-field cron line and picks a zone, a year
  and one of that year's clock changes.
  - **What it draws.** The night of the chosen change: two lanes, `crontabMatch` and
    `daemonCatchUp`, on one exact-time axis, the change as a rule with its offset chip, a mark per
    run (runs that share an instant stack as one mark) and, per lane, up to 8 rows of runs at a
    skipped or repeated wall time. A sentence says whether the two policies agree that night.
    Below: the parsed fields, the next 12 runs under each policy joined by instant (never by
    index), and every call printed.
  - **Calls.** `isValidTimeZone`, `parseCronExpression`, `getDstTransitions(zone, year)`, then
    `cronRuns` once per policy for the night window and once per policy for
    `{ after, count: 12 }`, through `cron-lib.ts` (heavy, throws `WidgetLoadError`). `after`
    defaults to the night window's start, or to 1 January of the year when the zone has no
    change. `cron-in-a-zone.ts` computes no run: it arranges what comes back and places ticks and
    marks with the polyfill.
  - **Hold-still.** Every slot (field rows, plates, the 8 touched rows, the 12 list rows, the NO
    SIGNAL pill) is laid out in every state and hidden with `data-off`. Plates use tabular
    numerals and a reserved width; the lanes and the axis band have fixed heights.
    `readout-still.mjs` steps the year on `london-spring` and `sydney-every-five`.
  - **The night window is `[T − 3 h, T + 3 h)`** around the change, built with the polyfill and
    printed in the call: every gap the daemon catches up (under 3 h, as cron.c does) falls inside
    it, and a `*/5` line draws at most 72 marks per lane.
  - **`[]` from `cronRuns` after a valid parse reads "No runs", never NO SIGNAL**: the call runs
    only once the line, the zone and the window are valid, so an empty list is the answer
    (`0 0 30 2 *`), not a refusal.
  - **A change is named by `change`, a 1-based ordinal digit string into that year's
    `getDstTransitions` list, plus a required `year`**, because `seedFromLocation` keeps only
    strings and years. An ordinal past the list opens on change 1, and a note says so.
- **Leap-Day Birthday** (CORE-102, `/tools/leap-day-birthday/`, `leapday`): a Core tool that
  draws the month-day functions of `@northguild/gmt/plain`. The reader types a yearly date (a
  month-day, a date of birth or a date-time), picks a locale and a year.
  - **What it draws.** Three plates (Stored as `--MM-DD`, Reads as in the locale, In the year) and
    a table of eight consecutive years from the chosen one: the library's date, a verdict word,
    the year pasted onto the string and a 1 March rule. A moved year is a word, a hatch and a
    bottom edge on its verdict cell, never a coloured left edge. Below: one reason line and the
    printed calls.
  - **Calls.** `isValidMonthDay`, then the first of `parseMonthDay`, `parseMonthDayFromDate`,
    `parseMonthDayFromDateTime` that does not return `""` (a dispatch, so the site never inspects
    the string with a regex of its own), `formatMonthDay`, `monthDayToDate`, `parseMonthDayFromDate`
    on the result with `areMonthDaysEqual` and `compareMonthDays` for the verdict, `isValidDate`
    and `addDate`, through `month-day-lib.ts` (heavy, throws `WidgetLoadError`). The widget
    compares no digits and checks no leap year.
  - **The 1 March column is the caller's policy**, built from library calls (`isValidDate` on the
    pasted year, else `addDate(monthDayToDate(...), { days: 1 })`), because Temporal's constrain
    rule takes no option and gmt has no such mode. It only moves a date the library moved, so a
    year outside 0 to 9999 (refused for its width, not its day) is not shifted.
  - **Hold-still.** All eight rows and five cells are laid out in every state; a verdict word and
    the "Reads as" plate sit in a hold sized by hidden twins (the four verdict words; the longest
    of 12 month texts, measured at mount and on a locale change, never during a drag). A date
    reserves 13 characters. The reason is a hold over its five static texts, and the calls frame
    reserves its widest print (`callsSizerText`). The table is `table-layout: fixed` with a
    doubled class on the Year column, and under a `40rem` container it becomes labelled blocks
    (mirrored in `gmt-a11y.css`; the 732 px box of a 1440 px viewport shows the real table). `readout-still.mjs` drags `year-slider` and steps the typed year
    on all five presets; only the range chip moves.
  - **NO SIGNAL is not "no result".** A value no reader accepts, or a year the library cannot place,
    is NO SIGNAL; the pasted-year cell is NO SIGNAL for `2023-02-29` because `isValidDate` refuses
    it, which is the lesson. `--02-30` alone is told apart ("the month has no such day"), by the
    `not-a-day` preset's own `noSuchDay` flag, because the library gives `""` for every refused
    input alike and the widget computes nothing; other junk gets the generic text. A kept date is a correct answer and never amber.
  - **Permalink.** `{ preset }` alone while the state matches a preset, else the strings `value`,
    `year` and `locale` (a year as a string, because a number outside 1900 to 2100 is dropped).
    `value` is in `EMPTY_KEYS_BY_KIND` so a cleared field round-trips. The chat schema takes a
    year of -271821 to 275760 and a BCP 47 `locale`; the default locale is `en`.
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
  per industry. A tag is a label, not a link. The tags are `core` plus the declared industries
  (`src/data/industries.json`, read through `src/lib/industry-tags.ts`). Index pages carry no
  tag. The Markdown export states the tag as an `Industry:` line under the title
  (`pageToMarkdown`), so `ToolLayout` takes only a use case. `/tools/` lists the tools by
  industry; `scripts/build-tool-index.ts` generates it from the same frontmatter as plain
  Markdown (gitignored, like the scenarios index). A new industry is one entry in
  `industries.json`, one glyph in `INDUSTRY_ICON_PATHS` and one hub text in
  `industry-overview.ts`; it gets a tag when its first page ships.
  - **A page is tagged by the one industry whose own namespace it runs**, so it sits in one menu
    section. The Dwell Ledger is Transport (`dwellTime`); the GNSS tools and scenarios are
    `gnss`; the duty and hours-of-work pages are `workforce`; a page that runs only Core
    functions, `timescale` included, is `core` (the Leap Second Timeline, the Elapsed vs. Clock
    Difference tool, the leap-seconds guide). An industry that draws on a layer links that
    layer's pages from its hub's `solves` list instead of tagging them, so the Maritime guide is
    the only `maritime` page. The chat-rail area matches the tag.
  - **The test allows; authoring picks one.** `industry-tags.test.ts` reads each page's used
    modules (`/reference/<ns>/<mod>` links, and `@northguild/gmt/<ns>` or
    `@northguild/gmt/<ns>/<mod>` imports) and fails when a page has no tag, an unknown tag, or a
    tag outside `allowedTags`: the industries that own or draw on a used module, plus `core` only
    when no own namespace is used. It also fails when a page carries more than one tag. It
    cannot tell the owner from an industry that only draws on the layer, since an industry's own
    guide (Maritime's) rightly takes its own tag over the layers it draws on; authoring picks the
    owner.
  - **Cross-industry layers are industries.** A function several industries need lives in the
    cross-industry layer for its domain (`workforce`, `gnss`), or in Core when it is truly general
    (`timescale`), never in a grab-bag namespace and never in one industry's namespace. On the site
    that layer is an industry like any other, and each industry that uses it lists it in `drawsOn`
    (Transport draws on `workforce`, Maritime on `gnss`). The rule is
    `context/coding-standards.md`, "Core namespaces, industry layers, cross-industry layers".
  - **Trap: a `core` page never links an own namespace's reference pages.** The test reads
    `/reference/<ns>/` or an import from `@northguild/gmt/<ns>` in a page's source as use of that
    namespace, and a page that uses an own namespace cannot be tagged `core`. The Standards guide
    is `core`, so it names `parseEdifactDateTime` and the other EDI functions as inline code and
    links the EDI guide, never `/reference/intermodal/`.
- **A widget that cannot load says so.** A mount whose `GMT_MODULES` import fails throws
  `WidgetLoadError` (`src/lib/widget-mount.ts`); it never returns an inert handle, which
  left controls that looked live and did nothing. Every `.astro` shell — every teaching
  widget, the globe, the scrubber and the timezone map — catches its mount and calls
  `showUnavailable(root, error)`: `data-state="unavailable"` dims and disables the
  server-rendered markup (`gmt-widget-reset.css`), and one amber notice offers a reload.
  `widget-load-error.test.tsx` runs every library-backed mount against a `GMT_MODULES`
  whose imports all reject.
  - **Trap: the notice covers a failed gmt import, not a failed page script.** The shell's
    `<script>` imports the mount statically, and most pure widget modules import
    `@js-temporal/polyfill` statically for drawing (`transport-widgets.ts` and
    `timetable-reader.ts` among them). If that import fails, the script never runs, so the
    mount is never called and nothing catches: the server-rendered markup stays, inert, with
    no notice. A dev server that answers `504 (Outdated Optimize Dep)` does exactly this
    (§ Tier 6, Runbooks).
- **One control system for every widget.** The controls are the kit's elements and builders
  (§ Tier 2, Component kit): `range` (a native `input type="range"` in `gmt-range`, with its
  fill, value chip and end labels), `handle` (`gmt-handle`, a `role="slider"` element), `chips`
  (`gmt-chips`, bevelled toggles), `select`, `button`, `textInput` and `field` (the label, the
  "(optional)" text, the hint and the field grid). Their styles are CSS Modules beside each builder; no global form sheet exists. A new tool composes these and adds no
  control CSS of its own. Rules and traps:
  [reference/design-system.md § Form controls](reference/design-system.md#form-controls).
  - **Every widget root carries `not-content`** and `container-type: inline-size`, so
    Starlight's prose spacing never reaches widget internals.
  - **A disabled input or select has one shared style**
    (the `textInput` and `select` CSS Modules): dimmer text, a dashed border, no fill and a not-allowed
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

    A disabled range (`gmt-range`, the Cut-off Countdown's and the ETA Drift Chart's
    sliders) is a different control with its own rules.
  - **The Cut-off Countdown's axis is inset by half a thumb width.** Its "now" marker and the
    range thumb then share an x. One property, `--gmt-countdown-inset`, sets the inset for
    both the axis and the drag field. It is defined on the countdown's root (`tools/cutoff-countdown.module.css`) because the
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
  the `card` builder on purpose: that wrapper is the widget's one layer of glass. The trap is a
  part inside it, such as a readout, a plate or a row, whose class also holds the substring: it
  becomes a second blurred panel inside the first. Name widget parts without it, or override all
  three rules on purpose, as the Cut-off Ruler's card does (`tools/cutoff-ruler.module.css`).
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
- **Trap: an unnamed `@container` query on anything inside the field grid resolves to
  the grid.** The `fieldGrid` builder's grid is a container itself, so a width rule for a label
  or a control in it reads the grid's width, not the section's. Name the section and query
  it by name, as the Timetable Reader does (`tt-section`).
- **The prose list dash stays out of widgets.** `gmt-content.css` gives a list item on a content
  page a dash (`::before`), left padding and a bottom margin, and every one of those rules skips
  a list inside a `.gmt-widget` (`ul:not(:where(.gmt-widget *))`). A widget's legend, verdict
  row or key draws no dash and needs no reset. `content-list-rule.test.ts` guards it.
- **Trap: the live wrapper in a hold cell must stretch.** A cell that holds its size stacks
  a hidden sizer and a live wrapper in one grid cell (`families/ids/hold.ts`, `families/edi/edi-hold.ts`, `families/holiday/held-text.ts`). The wrapper
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
  `epcisEventTime`, `epcisTimeZoneOffset` and `plainMonthDay` are three such chips. Read that
  diff as expected; it is not a regression.
- **Trap: `Date.parse` is banned in tests too.** `date-ban.test.ts` and `oxlint` reject it
  in test files as well as source. Use `Temporal.Instant.from(…).epochMilliseconds`.
- **Result regions ease through `.gmt-grow`.** Sections after the first, and elements marked
  `data-grow="slot"`, change height smoothly: one shared observer and a frame loop with one step
  budget (32 px a frame in total, however late the frame) keep every step under the 48 px gate,
  where a CSS transition would double its step on a dropped frame, and the markup is wrapped at runtime so a reader without JS sees the server
  render. Section 1, the controls, is never wrapped, so popovers and focus rings do not clip.
  A list inside section 1 whose row count follows a preset (the Holiday Rule Builder's rules,
  the Observance Comparator's holidays) therefore carries `data-grow="slot"` itself, or
  grow-measure sees the whole list arrive in one frame.
  Rules: [reference/design-system.md § Smooth growth](reference/design-system.md#smooth-growth).
- **Tool pages:** `/tools/dst-inspector/`, `/tools/interval-visualizer/`,
  `/tools/converter-bench/`, `/tools/dwell-ledger/`, `/tools/free-time-ledger/`,
  `/tools/billing-deadlines/`, `/tools/delivery-scheduler/`, `/tools/connection-checker/`,
  `/tools/timetable-reader/`, `/tools/crossing-clock/`, `/tools/cutoff-stack/`,
  `/tools/cutoff-ruler/`, `/tools/cutoff-countdown/`, `/tools/punctuality-board/`,
  `/tools/eta-drift/`, `/tools/departure-board/`, `/tools/dtm-decoder/`,
  `/tools/x12-time-reader/`, `/tools/bl-date-stamp/`, `/tools/demurrage-clock/`,
  `/tools/epcis-event-reader/`, `/tools/journey-split/`, `/tools/gnss-week-decoder/`,
  `/tools/satellite-clock-converter/`, `/tools/gnss-rollover-checker/`,
  `/tools/leap-second-timeline/`, `/tools/elapsed-vs-clock-difference/`, `/tools/stored-time-audit/`,
  `/tools/holiday-rule-builder/`, `/tools/observance-comparator/`, `/tools/moving-feasts/`,
  `/tools/duration-parser-bench/`, `/tools/id-timestamp-decoder/`, `/tools/column-timestamp-bridge/`,
  `/tools/cron-in-a-zone/`, `/tools/leap-day-birthday/`, plus the Tier 4
  `/tools/zoned-earth/` and `/tools/zone-planner/`. Permalinks (`?w=&wa=`) seed a widget through `seedFromLocation`,
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
  key is ignored. The B/L Date Stamp carries `value`, `event`, `timeZone`, `zone2`…`zone4` and
  `latest`; the Demurrage Clock `eventCount`, `type1`…`at6`, `scope`, `direction`, `startEvent`
  and `zone`; the EPCIS Event Reader `eventTime` and `eventTimeZoneOffset`; and the Journey Split
  the Delivery Scheduler's `legCount` and numbered leg keys. The MAR-16 kinds are `gnssweek`
  (`mode`, `counter`, `system`, `week`, `timeOfWeekSeconds`, `rolloverEra` or
  `rolloverNotBefore`, `utc`), `satclock` (`value`), `rollover` (`counter`,
  `firmwareNotBefore` or `firmwareEra`, `date`), `leapline` (`date`, `check`, `from`, `to`) and
  `elapsed` (`start`, `end`), `colbridge` (`mode`, `value`, `unit`, `zone`, `duration`, `int96Form`, `julianDay`, `nanosOfDay`, `bytes`, `int64`, `seconds`, `nanos`, `durSeconds`, `durNanos`, or `preset` alone) and `iddecode` (`id`, `epochMs`, `shift`, `timestampBits`, or
  `preset` alone while the state matches a preset), all strings, each passed as the reader gave it. The decoder and
  the checker write `{ preset }` alone while the state still matches a preset.
  - **Trap: build a permalink written into a page with `encodeWidgetPermalink`, never
    `encodeURIComponent` and never by hand.** A `DTM` segment ends in `'`, which
    `encodeURIComponent` leaves raw. The content-permalink test matches a link with
    `/\?w=([a-z]+)&wa=([^)"'\s]+)/` (`widget-permalink.test.ts`), so a raw `'` ends the match
    early and the test reads a cut-off link; a raw `+` in a query string decodes as a space.
  The three holiday tools use a preset form (`{ preset }` plus every scalar): the Builder's
  `rules` (one `;` line per rule, joined), `weekend`, `zone` and `year`; the Comparator's
  numbered `holiday1`… and `column1`…, `from`, `to`, `weekend` and `year`; Moving Feasts' `year`,
  `offsets`, `computus`, `month`, `weekday` and `ordinal`. `rules` (the Builder) and `holidays` (the
  Ledger link the Builder sends) are in `LONG_STRING_KEYS`, each with a regression test, because a
  year's calendar runs past 64 characters and the link would otherwise drop the holidays silently.
  `holidays` is capped at 1000 characters. `rules` is capped at 95,000, the longest list the chat
  schema accepts once every name and date is escaped. An empty `weekend` or `offsets` is kept as no
  weekend or no offsets (`EMPTY_LIST_KEYS`), not dropped.
- **`escapeAttr` on every template interpolation.** Values come from a model or from a URL
  someone else wrote, and a hand-written template string escapes nothing.
- **Interval visualizer:** the timeline is a `TimelineScale` value. Presets use the fixed
  calendar-year scale, because switching presets is only comparable against a still frame.
  Seeded and typed values fit their own scale with 10% padding, and drag snap and keyboard
  step derive from the span. The adjacent preset's copy follows the closed `*Zoned` functions: a
  shared instant overlaps.
- **`/why-gmt` "Correct at the edges":** every claim links at least one named `packages/gmt` test
  and claims nothing beyond what those rows exercise. Its only figure comes from `gmtStats`
  (`formatCount`); no count is typed. It justifies with specs only (TC39 Temporal, ISO 8601, RFC
  9557, RFC 5545, SQL:2011, EWD831, ECMA-262), names no peer library and calls no library buggy.
  It does not say "every time zone", and names only the zones the cited tests cover.
- **DST inspector:** opens on `Europe/London` 2024 (a spring gap and an autumn overlap).
  `getDstTransitions` returns `…Z` instants.
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
  in the Departure Board, Punctuality Board, ETA Drift Chart, Timetable Reader, Free Time Ledger,
  Dwell Ledger, B/L Date Stamp and the five MAR-16 tools (their ranges) by keyboard and pointer, in Chromium
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
  such as the DTM Decoder, the X12 Time Reader, the Demurrage Clock, the EPCIS Event Reader, the
  Journey Split, Billing Deadlines, the Stored Time Audit, the ID Timestamp Decoder and the Column Timestamp Bridge, is not in `readout-still`. Its definition of done measures
  the same boxes across every preset instead: each plate keeps its size, and a held region keeps
  its height. A result region may grow from one preset to the next through `.gmt-grow`, which
  `grow:measure` gates: the reason aside under a sentinel, a second lane for a second zone, or a
  chart that moves down because section 1 shows more fields.
  `scripts/html-diff.mjs` compares built widget markup (✗ the widget changed,
  ~ only the page around it did, + a new widget page with no baseline); `visual:diff` is the
  pixel gate.
  - **The runner.** `pnpm --filter dox gates` (`scripts/gates.mjs`) runs all of them from one
    build and one static server, and prints one screen (§ Runbooks, "Run the gates"). The gates are
    data in `scripts/gates/registry.mjs` (`id`, `script`, `tier`, `browsers`, `fullBrowsers`,
    `themes`, `needs`, plus `args`, `base`, `browserArg`, `pages`); `select.mjs` turns the changed
    files and the import graph (`graph.mjs`) into the pages to check; `screen.mjs` prints the result.
    Tiers nest: `pr` (contrast-measure, grow-measure, readout-still, data-credits-check,
    canada-layout-check) is inside `weekly` (adds canada-clock-still, canada-stored-still and
    table-fit), which
    is inside `local` (adds globe-smoke, html-diff and visual-diff, the three that need a GPU or a
    baseline).
  - **`table-fit`** (`scripts/table-fit.mjs`, tier `weekly`, all three engines) opens every built page
    that holds a `<table` (`listTablePages` in `scripts/lib/table-pages.mjs`, read from `dist`, never a
    fixed count) at 1440 x 900 with every `<details>` open and every tab panel shown, and fails when a
    table's scroll box (the table or its nearest `overflow-x` ancestor) is wider than it shows. A
    table with no scroll box is measured two ways and fails on either: against the content box of the
    nearest block that holds it and against `main`'s (a table with automatic layout grows with its
    content), and by its own `scrollWidth` against its `clientWidth` (a `table-layout: fixed` table
    keeps its width and its content spills out of its cells). A table
    not drawn at that width is skipped, and a run that measures no table at all fails. A
    finding names the page, the first three headers, the overflow and the widest unbreakable piece
    (`.gmt-cw`, `code:not(.gmt-codebreak)`, `.gmt-nobreak`). Rule `table-scrolls`. The same check runs
    in the `consistency` job as `dox-tables` (`scripts/lib/affected.mjs`, after `dox-dist`), in
    Chromium, whenever a Dox file or page changes.
  - **The PR job.** `dox-gates` in `.github/workflows/ci.yml` ("Dox gates (changed pages, Chromium)")
    runs on pull requests when `determine-affected` reports `dox_changed`, on Node 22: `gates --tier pr
    --browsers chromium --themes dark,light --against origin/<base>`, so the `pr` tier only, on the
    pages the diff selects; the weekly sweep covers the rest (Firefox, WebKit, the clock-still gates). The
    runner appends its screen to `$GITHUB_STEP_SUMMARY` in a fenced `text` block
    (`gates/step-summary.mjs`); a failed job uploads `apps/dox/.gates/` (without `vite-cache/`) as the
    `dox-gates-<run id>` artifact. It is **advisory**: the owner makes it a required check after about
    10 clean Dox PR runs. A PR that touches nothing under `apps/dox/` or `pnpm-lock.yaml` skips it;
    a lockfile change alone runs it, since it can bump Playwright or axe-core.
  - **The page contract.** Every gate script answers `--list-pages` (a JSON array of site paths,
    no `/gmt`, without a browser), takes `--pages <path,...>` (an unknown path exits 2, so a typo is
    never an empty run) and, when it loads pages, `--base <url>`. With `GATE_REPORT` set, each
    failure is also appended through `recordFinding` as `{ gate, rule, page, selector, browser,
    width, theme, message }` (`rule` is a short stable id such as `readout-moved`, `grew` or
    `contrast-below-7`, never prose), and the run ends with `recordMeasured(gate, n)`, the pages x
    browsers x widths it measured (`scripts/gates/findings.mjs`, `contract.mjs`). A gate that exits 0
    without that line, or with `n = 0`, is `FAIL measured nothing`; one that exits 0 with findings is
    a FAIL. `contrast-measure --only` takes a comma list. `grow-measure`, `readout-still`,
    `data-credits-check` and the three Canada scripts accept `firefox` in `--browsers`;
    `canada-layout-check` takes `--browsers` as well as `--engine`. `contrast-measure` is
    Chromium only.
  - **Selection.** A changed file selects the pages whose import closure holds it (`.mdx`, `.astro`,
    `.ts`, `.tsx`, `.mjs`, `.css`; relative paths and the `~/` alias); a change under
    `packages/gmt/src/<ns>/<module>/` selects the pages that import
    `@northguild/gmt/<ns>/<module>` and the sample, since a page that reaches the module through
    another one, or imports the package whole, is not in the graph. Chrome (`src/styles/*`, the
    Starlight component overrides, `astro.config.mjs`, `apps/dox/package.json`, `pnpm-lock.yaml`),
    any other library change, and any other `apps/dox/` file no page's closure holds (a component
    the chrome imports, the `/reference/` generators, `public/`) select the sample (`SAMPLE` in the
    registry; `registry.test.ts` asserts each path is in `dist`). A changed gate script runs that
    gate on the sample, and a changed runner file (`scripts/gates/`, `gates.mjs`, `gate-checks.mjs`,
    `scripts/lib/`) runs every gate on the sample. Over 12 pages, the run keeps the sample plus 6 picked evenly from the rest (the
    screen's context line says so under `--plan`); `--all` lifts the cap. With no changed file under
    `apps/dox/` (other than `*.test.ts`), `packages/gmt/src/` or `pnpm-lock.yaml`, the runner prints
    `gates: PASS  nothing to check` and does not build.
  - **The MAR-16 tools measure the whole widget** (`scope: "widget"`, frame `.gmt-gnss-frame`).
    Only their drawings (`GNSS_DRAWN`: lanes, bars, strip, plot, rulers and a hold's live
    wrapper) may move; the range chip is a `riders` element (its left moves, nothing else), and
    `textBoxes` excuses the width of the call frame's code spans and an instant's unbreakable
    pieces, never the frame or a plate.
  - **How they hold still.** Every region is sized to the tallest thing it can show: a hidden
    sizer of the longest call list, output, footnote or reason (`CALL_LINES` is the most calls
    any preset or slider stop makes), a fixed count of slots that are always drawn (four lap
    slots, five chips, eight table rows, the off-scale rows `offReserve` measures), plates that
    reserve their widest value, and a NO SIGNAL slot that is laid out and only made visible. The
    server HTML hides exactly the fields the initial state hides (`hiddenAttr` and `shownFields`
    in the decoder, the checker's model and date fields), so mounting hides nothing and the form
    keeps its height from the first paint.

## Tier 3 · HUD chrome

`DOX-D1`, `D2`

- **Glass:** `blur(24px) saturate(1.4) brightness(var(--gmt-brightness))` — `0.72` dark,
  `0.97` light, measured 11–16:1 for body text. A tinted fill, a hairline gradient border
  and a 1px inset highlight. There is no grain.
- **Corner brackets:** two L-shaped corners, top left and bottom right, on a few frames only
  (when one is right: [visual-design.md § Panels](reference/visual-design.md#panels)).
  `.gmt-brackets` (`gmt-primitives.css`, cyan) is on the home page's hero stage and on each
  `GridSection.astro` panel of the home page and `/why-gmt`. The transport tools draw the same
  frame in the frame's own colour (`--leg-color`, else `--series`) from
  `families/transport/leg-fieldset.module.css` (the Delivery Scheduler's legs and the Timetable
  Reader's rows).
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
  - **The control stack.** `renderGlobeTemplate` (`src/lib/globe-mount.ts`, shared by
    `Globe.astro` and the rail) draws one `role="group"` named "Globe controls" in the stage's
    bottom-right corner: `+`, `−`, `⊙` and the data-credits info button, in that tab order, all
    native `<button>`s of one size and one look (`tools/globe.module.css`; `data-gate="globe-zoom"`). Every globe draws the
    boundaries and the imagery, so every globe carries the button; there is no option to drop it.
    Its popover id is `<idPrefix>-data-credits`, unique per mount. See *Data credits* below.
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
      records all three. The credit is the `EARTH_IMAGERY` row of the data-credits panel
      (below) on the pages that draw the imagery — "NASA Earth Observatory (Blue Marble Next
      Generation)." — with no logo. July, because the
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
      `[data-theme="dark"]`. No unit test reads those rules; `pnpm globe:smoke` checks them by
      comparing the computed colours of every element in the hero across the two
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
      it; the photograph is opaque. `pnpm globe:smoke` checks both switches.
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

- **Boundary data (`CORE-88`).** Three public files hold time-zone shapes, all from
  timezone-boundary-builder (tbb) and all derived from OpenStreetMap: `timezone-boundaries.json`
  (the 10 CI zones, 0.02°, 3 decimals), `timezone-boundaries-globe.json` (every zone, 0.2°) and
  `timezone-boundaries-canada.json` (Canada, 0.08°, 3 decimals). The two region files (Canada,
  Morocco) also carry Natural Earth land: `NE_TAG` in the script and in `data-credits.ts` is
  `v5.1.2`, `ne_10m_land` from `nvkelso/natural-earth-vector` (public domain), named in the
  file's `landSource` member and credited as "Coastlines".
  - **One pinned release.** Every `prepare-*-boundaries.py` reads `releases/download/<TBB_TAG>/`
    (today `2026e`), never `releases/latest`, so each file names the release it came from.
    `TBB_TAG` in `src/lib/data-credits.ts` is the same tag; `scripts/boundary-data.test.ts` holds
    the files to it.
  - **The Canada set is `zone.tab`, not `zone1970.tab`.** Rows whose country column is exactly
    `CA` in the pinned tzdb (23 today). `zone1970.tab` lists `America/Toronto` (CA,BS),
    `Panama`, `Puerto_Rico` and `Phoenix`, whose shapes cover other countries, and tbb has no
    country outline to clip with. The comprehensive set gives each Canadian locality its own
    Canada-only feature. The script exits non-zero if a selected id has no feature.
    `src/lib/canada-zones.json` (`{ tzdb, zones }`, sorted) is generated with it, so the map's
    zone list is never typed.
  - **The ODbL notice is in the file.** The files are derived databases offered to the public
    (ODbL 1.0 §4.2–4.4), so each carries `source`, `attribution`, `license: "ODbL-1.0"` and
    `licenseUrl` as GeoJSON foreign members (RFC 7946 §6.1). The wording follows tbb's README
    § Licenses at the pinned tag ("The outputted data is licensed under the … ODbL").
  - **Budget.** The Canada file stays under 400 KB; 0.02° gives about 98 KB compact and 184 KB
    after `oxfmt`, which the repo's format check requires of these files. The scripts run
    by hand (`uv run --with shapely python scripts/prepare-*-boundaries.py`), then
    `pnpm exec oxfmt --write` on the output.
- **Data credits (`CORE-88`).** The credit sits on the drawing it credits: an info button that
  opens a small popup, one row per source, label left, credit right. Nothing else on the page
  names the sources, and no page carries a footer button or frontmatter list.
  - **One renderer.** `renderDataCreditsHtml(credits, { id, placement })` in
    `src/lib/data-credits.ts` returns the native `<button popovertarget>` and its `popover`
    panel, so the Astro shells and the plain-DOM mounts (the chat) render the same markup. `id` is
    unique per mount. Placements are `stack` and `corner`.
  - **Globe: the fourth button of the stack** (`stack`). `+`, `−`, `⊙`, `ⓘ` in one group named
    "Globe controls"; the stack's own rule (`tools/globe.module.css`) sizes and
    colours the button, so it matches its siblings in size, bevel, hover and focus fill, and tab
    order, and it fades in with them. Credits: boundaries and Earth imagery, on `/`,
    `/tools/zoned-earth/` and the chat's `globe` widget alike.
  - **Maps with no button stack: a glass square in the corner** (`corner`). The same 2rem square
    as the stack's buttons (`--gmt-surface-2` fill, `--gmt-border` edge, bevel), bottom-right of
    the drawing, where the land and the zone dots do not reach. Credits: boundaries only.
    `TimezoneMap.astro` (`/why-gmt/`) renders it in its HTML, in the credited frame (`data-gate="credited-frame"`) beside the
    chart host (which the chart code empties); the zone map (`zone-map.ts`) adds it to
    the zone map shell's frame (`zoneMapShell`, `families/zones/zone-map-shell.module.css`) when it draws the shapes, so a section narrower than 520 px, where no map is
    drawn and no file is fetched, has no credit. The chat's `canadaclock` widget follows the same
    rule; the map frame's `data-credits-id` carries its `idPrefix`-based id.
  - **`aria-expanded` is kept by script.** WebKit's accessibility tree does not report a
    `popovertarget` button as expanded when its panel is open (a bare button and popover show it
    too), so the button carries `aria-expanded="false"` and `watchDataCredits()` (one capturing
    `toggle` listener on the document, called by `mountGlobe`, `zone-map.ts` and
    `TimezoneMap.astro`) sets it from the panel's `newState`.
  - **Closed by default, native `popover`.** Escape, an outside click and focus return come free
    and need no script. The popup is anchored to its button (`position-anchor: auto`, the
    popover's implicit anchor; Chromium resolves `anchor()` only with it set): a stack's opens
    beside the stack, to its left, bottom edges aligned; a corner button's opens above it. Both sit
    12 px inside the viewport, shrinking to the room there is (a left inset and `justify-self: end`),
    never over the buttons, and flip to the other side of the anchor when they would leave the
    viewport. Without anchor positioning the panel pins to the viewport's bottom edge.
  - **Colour.** The glyph is `--gmt-ice` on `--gmt-surface-2`, the stack's own pair, with
    `--gmt-void` on `--gmt-cyan-ink` for hover, focus and open. `data-credits.test.ts` recomputes
    both pairs from the tokens in each theme (WCAG 2.2 SC 1.4.11 asks 3:1). Forced colours: system
    button colours and a `Highlight` focus outline (`gmt-a11y.css`).
  - **Gates.** `scripts/data-credits-built.test.ts` asserts what the HTML holds: the globe's
    button last in its stack on `/` and `/tools/zoned-earth/`, the map's on `/why-gmt/`, none on
    the Canada page (drawn by the client), and none anywhere else.
    `scripts/data-credits-check.mjs` asserts the rest on a served build at 1280 and 375 px, in
    Chromium and WebKit: Tab reaches the button inside its group (WebKit presses Option+Tab,
    because Safari on macOS leaves buttons out of plain Tab for every site), Enter opens it with
    the accessible expanded state true, Escape closes it and returns focus, the panel is inside the viewport and covers no control
    button, and the button covers no text, no other focusable element and no drawn shape; at 375
    px the Canada page has no button.

## Tier 5 · Scenarios and pitfalls

`DOX-A4b`–`A4d`

- **Scenario pages** (`src/content/docs/scenarios/`): the naive approach → a live widget
  showing it break → why → the gmt approach → the same widget working. The scenarios index
  (`scenarios/index.mdx`) is generated from their frontmatter by
  `scripts/build-scenario-index.mjs` during `generate`, and is untracked; never edit it.
- **Mistakes** (`src/content/docs/mistakes/`): the domain `SKILL.md` Common Mistakes, ported
  with severity and live proof.
- **A task-first index of the guides**, `guides/index.mdx`: the guide groups by task, then three
  guides to read first. It is written by hand. Three of its groups share a name with a domain in
  `packages/gmt/skills/_artifacts/domain_map.yaml`, but no script reads that file, so a new guide
  or group is added to the page by hand.

---

## Tier 6 · Dox, the chat

`DOX-C0`–`C4`

### Shape

- **One surface: `/dox`** (`src/pages/dox.astro`, `<DoxPage client:load />`), under the site
  header, with no page title. `noindex`, reached from the header's "Chat with Dox" button,
  which carries `aria-current="page"` there. The header is Astro with no JavaScript, so no
  React reaches another page (WCAG 2.2 SC 3.2.3: the navigation is the same on every page).
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
  - The maths plugin needs KaTeX's stylesheet; `message.tsx` imports `katex/dist/katex.min.css`
    so it loads with the island only. Without it formulas render twice and `\sqrt` svgs overflow.
- **Tailwind v4** exists only in the island. See [reference/design-system.md](reference/design-system.md).
- **Worker (`apps/dox/worker/`):** `POST /gmt/api/chat`, `GET /gmt/api/brains`; everything else goes
  to `ASSETS`.
  - The `.md` prompt sources load as Text modules (a `wrangler.jsonc` rule); Vitest
    mirrors this with a `markdownAsText` plugin.
  - `createChatHandler` takes vocabulary, core rules, model factory, ledger and clock as
    injected dependencies.

### Retrieval

- **Chunks** are built at `astro build` into `/retrieval-chunks.json`
  (`src/lib/retrieval/corpus.ts`): one per reference entry, function, type or regex (name,
  signature, description, examples, URL) and one per guide `##` heading (`github-slugger` anchors). Guides load through
  `import.meta.glob`, not `fs` — `fs` breaks once Astro bundles the endpoint. The Worker
  fetches the chunks same-origin, through the Cache API (`fetch-chunks.ts`).
- **Once per isolate, not once per request.** `fetchChunks` keeps the parsed array in
  memory for the Cache API's TTL (300 s) and returns the *same array* until it expires, so a
  warm request no longer re-parses 750 KB of JSON. `search.ts` memoises the MiniSearch index
  in a `WeakMap` keyed on that array; building it over every chunk costs tens of milliseconds,
  which used to be paid on every question. A new array — a test fixture or a refreshed corpus — always gets
  a fresh index, and `searchChunks` stays a pure function of its inputs.
- **A chunk carries the words a reader uses.** A type chunk adds each member's name and
  description; a function chunk adds `Name: description` for each documented type its signature
  names (`function-chunks.ts`), because the type, not the function, says "GLONASS".
- **Search:** MiniSearch BM25 (`src/lib/retrieval/search.ts`) with a stopword list,
  `MIN_RELEVANCE_SCORE`, and up to 15 chunks.
  - The index splits camelCase identifiers and keeps the whole one (`isLeapSecond` is also
    is, leap, second; runs of capitals stay together). Only the index side splits: a query that
    types an identifier stays one narrow term.
  - Without stopwords, "format a date for display" matched most of the corpus.
  - Without the score floor, off-topic questions got padded results.
  - The threshold is tuned to this corpus; re-verify it if the corpus or boosts change
    materially.
- **Namespace bias, not a filter.** `DoxChat` sends the same-origin referring page
  (`src/lib/page-context.ts`), and `worker/namespace-from-page.ts` turns
  `/reference/<ns>/…` or `/guides/<ns>/…` into a retrieval bias.
- **Why retrieval and not the whole corpus in the prompt:** the corpus is several hundred
  thousand tokens, far past a prompt budget (`measureCorpus` in `tokens.ts` reports it).
- **Corpus counts on the empty screen** are generated (`scripts/build-corpus-counts.ts`) and
  checked by `corpus-summary.test.ts`.

### Request pipeline

`worker/index.ts` → `worker/chat-handler.ts`:

| Step | Failure |
| --- | --- |
| Method | `405` |
| Burst limiter — key `chat:<clientId>`, per isolate, 20/60 s; blunts casual abuse, not a determined attacker | `429` + `Retry-After` |
| JSON body | `400` |
| Envelope (zod) + `safeValidateUIMessages` with the real tool set; roles `user`/`assistant` only | `400` |
| Sanitise invisible characters, **then** apply length and conversation caps | `400` |
| Per-visitor daily cap (KV, hashed IP; dev cookie exempt) | `429` |
| No configured brain | `500` |
| Retrieve → assemble prompt | mapped error, never a raw upstream payload |
| Open the stream, then in-request failover, writing transient `data-status` progress per brain | pool spent, or every brain busy → transient `data-refusal` |
| Write the retrieval trace part, then merge `toUIMessageStream` (`sendReasoning: false`, `onError` on both layers) | mapped error text, never a raw upstream payload |

- **The rate limiter takes a policy.** `checkRateLimit(key, now, { max, windowSeconds })`
  (`worker/rate-limit.ts`) keeps one bucket per key in a module-scope `Map`, so it is per
  isolate: blunt protection, not a global limit. Chat passes `chat:<clientId>` with
  `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_SECONDS`; the Canada checker passes
  `canada:<clientId>` with `CANADA_RATE_LIMIT` (20 per 60 s, `src/lib/canada-clock-change.ts`), and
  the Morocco checker passes `morocco:<clientId>` with `MOROCCO_RATE_LIMIT` (same policy,
  `src/lib/morocco-clock-change.ts`). The prefixes keep the counts apart: each checker has its
  own count, so one page cannot spend another's.
- **`GET /gmt/api/canada-clock-change`** (`worker/canada-clock-change.ts`) computes the
  probe offsets, the 2026-2027 transitions and one row per Canadian zone at request time on
  workerd, from the library only. Every answer is `cache-control: no-store`, because a cached
  answer would hide the live tz data the page exists to show. Other methods answer `405` with
  `Allow: GET, HEAD, POST`; over the limit it answers `429` + `retry-after` and `{ error, retryable: true }`.
  The year scans and the `now`-free probe and transition tables are memoised per isolate (tz
  data cannot change inside one): a GET otherwise costs ~80 scans, too much CPU for a Free-plan
  request. `last` and `next` search the UTC years Y-1..Y+1, because the library groups by the
  zone's local year.
  `deploy-smoke.mjs` checks the five probe offsets against tzdb 2026e on the deployed Worker.
- **`GET /gmt/api/morocco-clock-change`** (`worker/morocco-clock-change.ts`) is a thin config on
  the same `handleClockChangeCheck`: methods, caps, `no-store`, `405` and `429` are Canada's. It
  answers `probe` (2 zones x 2 instants), `changes` (each stated change per zone, `present` from
  `getDstTransitions`), `transitions` (2026 and 2027) and one `zones` row per id in
  `morocco-region-zones.json`. The `now`-free tables are memoised per isolate. Its POST zone
  allowlist is `Africa/Casablanca` and `Africa/El_Aaiun`.
- **Deploy smoke for Morocco.** `deploy-smoke.mjs` runs against the deployed Worker, which carries
  tz 2026e, and never against `wrangler dev`: the workerd that `wrangler dev` runs locally
  (1.20260825.1) carries tz data older than 2026c, so a local Morocco Worker answers as old data.
  The rows make four calls to the `morocco:` bucket per run (the PUT answers 405 before the
  bucket counts it): the probe (all four offsets
  `+00:00`; no `recordedBy: "2026b"` change `present`; every `"2026c"` change `present`), HEAD
  (`no-store`, empty body), PUT (`405`, `Allow: GET, HEAD, POST`), a report-only stored-times
  POST that prints each line's kind, and a POST of `STORED_MAX_LINES` lines that must answer 200
  with `truncated: false` (Error 1102 is a failure). Two more rows fetch the page and the
  boundary file (`license` `ODbL-1.0`). The expected offsets are literals in the row, cited to
  tzdb 2026c; when a later tzdb changes Morocco again the row fails on purpose and the page needs
  updating.

- **The stream opens before a brain is chosen.** Measured 2026-09-24: two busy brains
  took 2.8 s of a 6.7 s answer, and the reader saw nothing but "Searching corpus…". Now
  each step arrives as a transient `data-status` part ("Gemma 4 26B is busy — trying the
  next model…") and shows in the pending card.
- **The badge counts arrive in the stream.** Once a brain answers, the Worker writes a
  transient `data-usage` part (`USAGE_PART_TYPE`): the `/api/brains` payload built from the
  snapshot read at the start of the request, plus this question and every brain the walk
  marked out (`withRecordedRequest`, `worker/brains-payload.ts`). `DoxChat` hands it to
  `useBrains().apply`. Re-reading `/api/brains` after the answer raced the ledger write,
  and KV can take a minute to show it, so the badge kept its old count. A refusal or a
  stream error still re-reads `/api/brains`.
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
  answer's retrieved URLs) · Vocabulary (the consumer `SKILL.md`s this question needs) · Core rules
  (`worker/core-rules.md`, pinned by `core-rules.test.ts`) · Retrieved context · Available
  tools · Refusal instruction. The order is pinned by `system-prompt.test.ts`.
- **The prompt is cut to the question.** It used to be 145–200 KB on every question:
  ~100 KB of `SKILL.md` vocabulary, ~60 KB of tool text and schemas, then up to 15 chunks.
  Most of a model's wait before its first token was reading that. Now:
  - **Vocabulary** (`worker/select-vocabulary.ts`): each consumer skill's frontmatter
    `sources:` (modules, guide pages, or a guide folder as `*.mdx`) are matched against the
    top ten retrieved chunks. A chunk votes for each skill that lists it, by rank, split
    evenly between them. The best skill always goes in; another joins when it scores at
    least half the best and fits `VOCABULARY_BUDGET_CHARS` (16,000). A skill's "When to
    load" and "References" sections are dropped. A question that matches no skill gets
    "(none for this question)". Averages ~13 KB a question.
  - **Tools:** at most eight — see "Widget tools".
  - **Chunks** (`worker/fit-chunks.ts`): at most 10, and at most 24,000 characters, best
    first; the best chunk always goes in. The linking allowlist and the trace come from the
    same list, so the reader is never shown a source the model did not see.

  A chunk no skill lists votes for nothing. A rule that also counted a neighbouring page in
  the same guide folder gave the conversion guide to the Integration skill, so it was
  dropped. When a skill's guide coverage looks thin, add the page or folder to its
  `sources:`.
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
  first token — restarted by each progress line, then 30 s of silence between chunks,
  reset on every chunk. The Worker gives each brain its own start deadline
  (`BRAIN_START_TIMEOUT_MS`), so a walk past several slow brains reports each one and is
  not cut off by the client.
- **Warnings are not errors.** A rate limit, a refused send or a stall renders a warning
  (`chat-warning.tsx`), not a message, so it never reaches the history. `retryable` drives
  "Try again".
- **Composer:** a real `<textarea>` from `prompt-input.tsx`. The vendored file defers
  `form.reset()` to the success paths so a refused send keeps the reader's text — keep that
  on any AI Elements re-sync.
- **Accuracy note** (`.gmt-hive-accuracy-note`): one standing line under the composer. Free
  AI models write the answers and can get things wrong, so the reader should check them. The
  widgets and tools run `@northguild/gmt` itself, and the line cites its test count from
  `src/data/gmt-stats.json`, formatted in `en-US` so the server and browser renders match.
- **Fine print on a phone** (`ChatInfo.tsx`): below 60rem the accuracy note and the shell's
  licence footer (`.gmt-hive-licence`) are `display: none`, and an info button
  (`.gmt-hive-info`, named "About Dox's answers and licences") at the start of the composer's
  control bar opens both in one native `popover="auto"` panel, anchored above the button. Send
  stays at the end of the bar. Above 60rem the button is hidden and both notes show inline. CSS
  picks the form, so the server render is already right. `AccuracyNote` and `LicenceNote` are
  the single source for both forms.
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
  - `showBlDateStamp({ value, event, timeZone, zone2?, zone3?, zone4?, latest? })` (INT-14):
    `value` is a moment, never a bare local time, and `timeZone` is the place where the event
    happened. A zone is passed only when the reader named it, never chosen from a port or a place.
  - `showDemurrageClock({ events, scope, direction, startEvent? })` (INT-14): `direction` is
    required, as the library requires it.
  - `showEpcisEventReader({ eventTime, eventTimeZoneOffset? })` (INT-14): both values pass as the
    reader gave them. A missing offset is left out, never filled and never read as UTC.
  - `showJourneySplit({ legs, startTimeZone? })` (INT-14): the Delivery Scheduler's schema.
  - `showGnssWeekDecoder({ mode, counter?, system?, week?, timeOfWeekSeconds?, rolloverEra?, rolloverNotBefore?, utc? })`
    (MAR-16): `mode` is `broadcast`, `rinex` or `utc`. A broadcast counter needs exactly one of
    `rolloverEra` (digits, or `rolling`) and `rolloverNotBefore`, the receiver's own setting;
    neither is chosen for the reader.
  - `showSatelliteClockConverter({ value })` (MAR-16): the value exactly as the reader gave
    it, a UTC instant or a string ending in `TAI`, `GPS`, `GAL`, `BDT`, `QZS`, `GLO` or `IRN`.
  - `showGnssRolloverChecker({ counter, firmwareNotBefore? | firmwareEra?, date? })` (MAR-16):
    exactly one firmware field, as the receiver's documentation states it.
  - `showLeapSecondTimeline({ date?, check?, from?, to? })` (MAR-16): at least one field.
  - `showElapsedVsClock({ start, end })` (MAR-16): both instants exactly as the reader gave
    them.
  - `showStoredTimeAudit({ values, line? })` (CORE-83): the stored strings exactly as the
    reader gave them, one per line, and the 1-based line to draw.
  - `showHolidayRuleBuilder({ rules?, weekend, year, zone })` (CORE-54): one to twelve rules of
    the five kinds, each with an optional observance policy. A rule moved by its policy closes
    only its observed day; to close both days, list the rule twice, once with no policy. Pass only
    rules, dates and policies the reader gave; never supply a place's holidays or its observance
    policy from memory.
  - `showObservanceComparator({ holidays, years, weekend, policies, year })` (CORE-54): one to
    three month-day holidays and one to four policies, all the reader's; never name a place's
    policy. The same "never from memory" rule applies.
  - `showMovingFeasts({ year, offsets?, month?, weekday?, n? })` (CORE-54): the reader's year and,
    where asked, the Easter offsets and the month, weekday and ordinal; nothing is chosen from a
    place's calendar.
  - `showCanadaClockChange({ zone? })` (CORE-88): one id from `canada-zones.json` to pin on the
    map; the Worker's `execute` and the registry's `validate` refuse any other id. The widget
    kind is `canadaclock`, its permalink `/check/canada-2026-clock-change/?w=canadaclock&wa={"zone":…}`.
  - `showDurationParserBench({ text, locale? })` (CORE-85): the reader's duration string
    exactly as given (never trimmed or corrected, at most 64 characters), and a locale only
    when the reader names one.
  - `showIdTimestampDecoder({ id, epochMs?, shift?, timestampBits? })` (CORE-56): `id` exactly
    as the reader gave it, never trimmed or corrected; the layout fields only when the reader
    gave a Snowflake layout.
  - `showColumnTimestampBridge({ mode?, value?, unit?, zone?, duration?, int96Form?, julianDay?, nanosOfDay?, bytes?, int64?, seconds?, nanos?, durSeconds?, durNanos? })`
    (CORE-56): needs a `value` or a decode field; each string exactly as the reader gave it.
  - `showMoroccoClockChange({ zone? })` (CORE-89): one id from `morocco-region-zones.json` to pin
    on the map; the Worker's `execute` (`accept("morocco-clock-change")`) and the registry's
    `validate` refuse any other id. The widget kind is `moroccoclock`, its permalink
    `/check/morocco-2026-clock-change/?w=moroccoclock&wa={"zone":…}`.
  - `showLeapDayBirthday({ value, year?, locale? })` (CORE-102): the date the reader gave, exactly
    as typed (a month-day, a date or a date-time, at most 64 characters), a year only when asked
    and a locale only when the reader names one; never infer a birth date or a locale from a name or
    a place. The Worker's `execute` is `accept("leap-day-birthday")`; the registry's `validate`
    refuses a locale tag the runtime cannot read. The widget kind is `leapday`.
- **Count:** `ENABLED_TOOL_NAMES` and `CHAT_STARTERS` hold the numbers, one starter card per tool;
  re-derive them from there, and never write a literal in a test or a page. The Leap Second
  Timeline, Elapsed vs. Clock Difference, Stored Time Audit, the Canada and Morocco clock-change
  checkers, the Duration Parser Bench, the three holiday tools, the ID Timestamp Decoder, the
  Column Timestamp Bridge and the Leap-Day Birthday are core.
- **Parity:** `ENABLED_TOOL_NAMES` equals the widget registry's keys
  (`widget-registry.test.ts`), and every enabled tool has a `CHAT_STARTERS` card
  (`chat-starters.test.ts`). A tool nobody can mount or discover cannot ship.
- **Offered per question, not all at once** (`worker/select-tools.ts`). Every tool travels
  twice — a `Call when` line in the prompt and a JSON schema beside it — and all of them
  came to ~60 KB a question. Each question gets at most eight:
  - the widgets of the first five `CHAT_STARTERS` (`CORE_TOOL_COUNT`), so **the order of
    the first five starters decides the core tools**;
  - the best three matches from a small MiniSearch index over each tool's name, purpose and
    `Call when` line, plus a bonus for a tool whose description names a function the
    retrieval ranked near the top;
  - every tool the conversation has already called, since a provider can reject a history
    that calls an undeclared function.

  `select-tools.test.ts` checks that every starter's own widget is offered for its own
  question. A new tool whose starter misses needs better `Call when` wording, not a larger
  set.
- **Example cards open their widget on the click.** The `CHAT_STARTERS` live in the widget
  rail, not the empty chat, as a scrolling panel of bevelled cards (`ExamplesPanel.tsx`)
  grouped by area. The areas are industries: `EXAMPLE_AREAS` is Core, Transport, Intermodal and
  GNSS, each heading carries its industry's icon (`INDUSTRY_ICON_PATHS` through `industryTag`),
  and a card's `area` is its tool page's tag. An industry with no tool has no area (Workforce and
  Maritime gain one with their first tool). `startersByArea()` returns the groups in that order.
  `chat-starters.test.ts` asserts each area is an industry with that industry's label and icon,
  no area exists for an industry without a tool, every starter has a known area, every area has
  a starter, and the grouping covers each starter exactly once.
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
    line, prompt, composer) and the sheet takes the rest, at least 7rem; a started conversation
    or an open widget gets the usual 55% sheet.
    Once it starts, the sheet collapses (`data-collapsed`, `display: none`) and an
    `Examples · N` bar (`ExamplesBar.tsx`, `aria-expanded`, `aria-controls` the rail) sits above
    the composer and toggles it. N is `CHAT_STARTERS.length`. Picking a card collapses the sheet
    again. The bar is hidden by CSS above 60rem. `DoxPage` renders the bar whenever no widget is
    open; CSS decides when it shows, so the server render is already right.
  - **Short phone:** below 44rem tall the empty state starts folded behind the bar as well, with
    its block padding dropped. Below 35rem (landscape phones) the chat keeps a 30rem floor and
    the shell scrolls as a page.
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
- **One step, unless the widget came alone** (`WIDGET_THEN_PROSE`, `worker/brains.ts`): the
  tool runs inside step 1, and an answer that wrote text, or called no tool, ends there.
  A step 1 that called a tool and wrote nothing gets one more step with every tool switched
  off (`prepareStep` → `activeTools: []`), so the model can only write. Gemma 4 and GLM 4.7
  with thinking off mostly answer a widget question with the call alone. Step 2 runs after
  the stream has opened, so it cannot fail over; if it fails, the reader keeps the widget
  and sees the error after it. It costs a second read of the prompt.
- **Tool calls written as text become real ones** (`toolCallMarkupMiddleware`,
  `worker/tool-call-markup.ts`, wrapped round each brain's model with `wrapLanguageModel`).
  GLM 4.7 Flash sometimes writes `<tool_call>showGlobe<arg_key>…</tool_call>` into its
  answer instead of calling the tool. The middleware takes everything from `<tool_call>` to
  `</tool_call>` out of the text, across deltas and unclosed, and drops a text block that
  held only markup. When the step made no real call, each complete written call to a tool
  on offer is sent as a real `tool-call` at the end of the step, so the widget opens and
  step 2 writes the prose. A string argument keeps its text; any other is read as JSON.
  When the step also made a real call, the written ones are only dropped, so a widget never
  opens twice. `scripts/probe-brains.ts` fails an answer that still carries the markup.
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
  - **Width** (`RailResizer.tsx`, `rail-width.ts`): a `role="separator"` handle on the rail's
    left edge. Drag it, or focus it and use ← → (Shift for bigger steps), Home and End.
    Double-click resets it. The narrowest is the default `clamp(22rem, 34vw, 34rem)`. The widest
    is half the page body, and the transcript keeps at least 28rem. The width is one CSS
    property, `--gmt-hive-rail-width`, on `.gmt-hive-body`, so a widget swap keeps it. The
    reader's width is kept in `localStorage` (`gmt-dox-rail-width`) and applied after mount.
    The CSS clamps it again, so a window resize needs no script. Below 60rem the rail is the
    bottom sheet and the handle is hidden.
- **Tool prompt wording matters.** "When the question matches a `Call when` line, call that
  tool" works; "Prefer prose; call a tool only when seeing beats reading" took the converter
  to 0 calls in 3. Prose first, at most one tool, no default widget, never invent a zone.

### Brains and budget

- **`BRAINS`** (`src/lib/chat-constants.ts`), in preference order. `BRAINS[0]` is the
  default:
  - `cf-gemma-4-26b` and `cf-glm-4.7-flash` on Workers AI, badge 40 a day each;
  - `gemini-3.5-flash-lite` (5 of 5 correct at 2.9 s mean in the probe), then
    `gemini-3.6-flash` and `gemini-3.5-flash` (6–10 s), ~20 requests a day each.

  Workers AI leads because it answers: Gemma with thinking off answers in ~2–3 s, GLM in
  ~4–5 s. The Gemini models kept are the ones that answered 200 in a live probe; the
  rest, and the reasons, are listed above `BRAINS`.
- **Two kinds of allowance** (`BRAIN_PROVIDERS`):
  - **Gemini** — per project, per model, resets at midnight Pacific.
  - **Workers AI** — 10,000 Neurons/day per account, shared by every Workers AI model,
    resets at 00:00 UTC. On the Workers Free plan exhaustion fails rather than bills, so
    **stay on Free.**
- **Ledger (`worker/usage.ts`, KV `DOX_USAGE`):** advisory only — it drives the badge; the
  provider's error is the gate. A brain's `model:` and `state:` keys bucket by its
  provider's day and expire at its provider's midnight; the visitor cap is on the UTC day
  (`VISITOR_CAP_TIME_ZONE` in `src/lib/pt-day.ts`). Writes are best-effort, and visitors are hashed IPs.
- **Failover inside one request** (`openFirstWorkingBrain`, `worker/brains.ts`):
  - The walk waits for the first content part (`onChunk`: text, reasoning or a tool call),
    racing `result.warnings`. `warnings` settles only when the whole answer is done, but
    it rejects at once on a failed call, so a 429 is caught before any stream opens. The
    walk returns on the first content, so the answer streams to the reader as it is
    written. A failure after that reaches the reader through `onStreamError`.
  - That rejection is a contentless `NoOutputGeneratedError`, so `onError` captures the
    real provider error; unwrap `RetryError` and `NoOutputGeneratedError` before
    classifying.
  - 429 → `spent`; 404 / 400 (and a Workers AI 403) → `unavailable`; anything else
    rethrows.
  - **The reader's pick leads** (`orderCandidates`), even when the ledger has it as out:
    the progress line names each brain as it is asked, and a pick moved to the back read
    as Dox ignoring the selector. Then registry order, with known-out brains last, never
    pruned — the ledger can be stale.
  - **A brain that does not start in time is skipped** for this question, with outcome
    `slow` and nothing in the ledger: `BRAIN_START_TIMEOUT_MS` is 15 s for Gemini and
    20 s for Workers AI. One silent Gemini model once held the whole request for 60 s.
    The deadline covers only the start: a brain that has begun keeps going, however long
    the answer takes. If no brain started and none was busy, the walk throws
    `BrainsTimedOutError`, which `mapUpstreamError` turns into a retryable 503, never
    "allowance used".
  - Workers AI allocation exhaustion (3036, or the unmapped 4006) retires every Workers AI
    brain at once. A capacity 429 (3040, "no more data centers") is transient: the request
    moves on and nothing is marked.
  - `maxRetries: 0`. The SDK's retry backs off from 2 s, which put a pause in front of
    every failover; the next brain is the retry.
  - **A busy model moves on, and is not marked.** Gemini answers 503 "This model is
    currently experiencing high demand" (seen 2026-09-24, on two brains in a row). That
    used to be rethrown, failing the whole answer. `isTransientOverload` (503, 529) now
    tries the next brain with outcome `busy` and writes nothing to the ledger; if every
    brain was out or busy, the last overload becomes a retryable refusal, not "allowance
    used". A 500 still stops at the first brain: an error in the request would fail on all
    of them.
- **Thinking.** Thinking before the first word is most of a model's wait, so every brain
  turns it down:
  - Each Gemini brain carries `thinkingLevel` (`chat-constants.ts`), passed as
    `providerOptions.google.thinkingConfig`. All are `"low"`; left unset, Gemini 3 thinks
    dynamically over the whole prompt. A brain that stops calling its widget under `"low"`
    moves to `"medium"` on its own.
  - Each Workers AI brain carries `enableThinking: false`, sent as
    `chat_template_kwargs: { enable_thinking: false }` (`worker/workers-ai-settings.ts`,
    forwarded by `workers-ai-provider` to the model's inputs). It is the only switch that
    works for Gemma 4 and GLM 4.7: `reasoning_effort` set to `null`, `"none"` or `"low"`
    still thought for 4–21 s and often returned an empty answer.

  Confirm with `probe-brains.ts` after changing any.
- **Workers AI wiring:** `workers-ai-provider@4` over the `AI` binding (`remote: true`).
  - `worker/index.ts` offers only configured brains — Gemini needs the key, Workers AI the
    binding — so a missing provider shrinks the list instead of failing requests.
  - Each Workers AI brain sets `maxOutputTokens: 2048` (the default 256 truncates answers).
  - Every answered request logs `dox-usage` with token counts.
- **Workers AI model choice** (`scripts/probe-brains.ts` through the Worker, 10–19k input
  tokens a question; measured 2026-10-27):
  - Kept: `gemma-4-26b-a4b-it` — mean 2.6 s, ~130–180 Neurons a question — and
    `glm-4.7-flash` — mean 4.6 s, ~80–110 Neurons. Both called the widget 4 of 4 times and
    refused the absent question.
  - Dropped `llama-3.3-70b-instruct-fp8-fast` and `mistral-small-3.1-24b-instruct`:
    `workers-ai-provider@4.0.0` emits every delta twice, so tool JSON is unreadable and
    prose stutters. Re-probe when the provider fixes it.
  - Dropped `gpt-oss-120b`: widget with no prose, once printed its raw channel markup,
    ~410 Neurons a question.
  - Dropped `qwen3.8-27b` and `nemotron-3-120b-a12b`: ~600 Neurons a Dox prompt, about 16
    questions a day for the whole site.
  - Paid-plan models (5035) are out while Dox stays on Free.
  - Probe: `npx tsx scripts/probe-brains.ts --base http://localhost:8799/gmt --log <log>
    --starters 4 --brains cf-gemma-4-26b,cf-glm-4.7-flash`. A local `wrangler dev` spends
    the Neurons of the account Wrangler is logged into.
- **`VISITOR_DAILY_MAX` is 5.** Recompute it whenever `BRAINS` changes.

### Traps

- `/gmt/api/brains` must stay `private, no-store`: it carries one visitor's counts and dev
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
- Static assets bypass the Worker, so `?key=` only works on `/gmt/api/*`.
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
  - **The a11y gates.** Three gates, tier `pr`, run on the sample in every engine and on all pages in Chromium only (`fullBrowsers`): `a11y-axe`
    (`scripts/a11y-axe.mjs`, `@axe-core/playwright` 4.13.0, tags `wcag2a`, `wcag2aa`, `wcag21a`,
    `wcag21aa`, `wcag22aa`, at 1440 and 390, both themes), `a11y-tab-walk` (Tab through each page: every focusable
    shows a focus indicator, nothing traps, each `[role=slider]`/range moves on arrow keys and no
    interactive element is skipped) and `a11y-media` (the preference media queries:
    `prefers-reduced-transparency` needs no `backdrop-filter` and a fill alpha of at least 0.9,
    forced colours keep an edge on every control). **The WCAG 2.2 answer:** axe-core 4.13.0 tags 0
    rules `wcag22a`, and `wcag22aa` holds `target-size` only, so `wcag22aa` is what the gate adds;
    2.2 criteria axe cannot test (focus not obscured, dragging alternatives, consistent help) stay
    with `a11y-tab-walk` and the Tier 3 pass. `scripts/a11y-axe-exclusions.json` (empty) is the
    only place a rule or selector may be waived, and a change to it runs `a11y-axe` on the sample
    (`inputIndex()` in the registry). `scripts/lib/a11y-sweep.mjs` settles transitions before each
    read, because a clock row mid-fade reads as a false colour finding, and `settle()` waits for every
    `.gmt-grow[data-growing]` to release, because a region still easing to its height is clipped at a
    stale one and the text after it sits over it (a false `target-size` and `focus-obscured`).
    `a11y-tab-walk` runs both themes like the others; it collects candidates once their count is
    stable, counts the up to eight Tab presses through one date field's segments as one stop (more
    is a trap: `collapseStops`, `SEGMENT_CAP`), tests the centre of every box of a wrapped link, and
    looks again 300 ms after a `focus-obscured` before reporting it. Standing fixes the first sweep
    forced, which a change must not undo: scrollable `pre` and `.gmt-widget table` get
    `tabindex=0`, `role=region` and a label while they overflow (`src/lib/scroll-regions.ts`, and the
    same for the `/dox/` transcript in `DoxChat.tsx`); running prose links are underlined
    (`gmt-content.css`, `dox.css`); `--sl-color-text-accent` is `--gmt-cyan-ink`; the globe list's
    `aria-activedescendant` only ever names a rendered row (`syncActiveDescendant`); the dwell-ledger
    handles are 24px wide and lean 8px outward; the light hero has its own `background-color`
    because axe cannot read a `border-image` band; the `/dox/` licence note lives inside the chat
    shell (`.gmt-hive-licence`) and the Starlight footer omits it on that page. `contrast-measure`
    (the 7:1 gate) only measures text coloured `--gmt-ice-dim`, which is why it never saw the
    cyan accent text; `a11y-axe` `color-contrast` (4.5:1) now covers all text.
- **Run the gates.** `pnpm --filter dox gates` builds `packages/gmt` only when its `dist` is
  missing, builds the site with `DOX_VITE_CACHE_DIR=apps/dox/.gates/vite-cache` (unless the
  variable is set), serves `dist` on a free port, and runs the selected gates one after another
  (the clock-still gates flake under load), each with `GATE_REPORT=.gates/<gate>.ndjson` and its log
  at `.gates/<gate>.log`. A failed gate runs again once on its failing pages (`--retries`): a pass
  there is `FLAKY`, a second failure `FAIL`. Everything lands in `apps/dox/.gates/` (git-ignored),
  with `summary.json` and a `lock` that a second run refuses (exit 2). Exit 0 means no FAIL
  (`FLAKY` and `SKIP` pass); 1 a gate failed or measured nothing; 2 usage, a live lock, a failed
  build or a gate that exited 2.
  - `--plan` prints the selection and exits without running a gate; it builds only when `dist` is
    missing. `--only <gate,...>`, `--pages <path,...>` (replaces the diff selection),
    `--browsers`, `--themes`, `--tier pr|weekly|local` (default `local`), `--shard i/n` (every
    n-th page of each gate's sorted list), `--no-build` (needs `dist/gmt/index.html`) and `--json`
    (the summary as JSON) narrow or reshape a run. `--against <ref>` is the diff base (default
    `origin/main`, else `main`).
  - `--all` selects every page of every gate. `globe-smoke` is `SKIP needs a GPU` when `CI` is set.
    `html-diff` and `visual-diff` are `SKIP` without `--baseline <path to a built base apps/dox>`
    (see the next entry): with it, `html-diff` captures in the base and compares here, and
    `visual-diff` serves the base `dist` on a second port for `before`, runs `after` here, then `diff`.
  - **Measured on this machine (2026-10-26), `--all --tier pr --browsers chromium`: 125 minutes**
    (51 pages; build 37s, contrast-measure 37m, grow-measure 24m, readout-still 62m, data-credits-check
    36s, canada-layout-check 57s). That first sweep found six text runs under 7:1 on
    `/tools/cron-in-a-zone/` and `/dox/`, since fixed; every other gate passed. A child process that runs 90
    minutes is stopped and shows `timed out after 90m`. A diff-driven run takes minutes: one page with
    `--only` is about 4 minutes, 36s of it the build; `--plan` shows what a run would do.
  - **Firefox does not launch on the author's machine.** The five scripts accept `firefox`, but
    those legs have not run here (see "Owed verification").
- **A gate baseline is a clean worktree of the commit the branch is based on.**
  `html-diff.mjs capture` and `visual:before` run in a detached worktree at
  `git merge-base HEAD origin/main`, with its own install, library build and site build;
  `html-diff.mjs compare`, `visual:after` and `visual:diff` run in the branch. It is not the
  local `main` branch, which can lag `origin/main`, and it is not the working tree with changes
  set aside: a stash is shared by every worktree, and a baseline built over leftover generated
  files is not clean. Build the baseline and the branch in private trees under the session
  scratchpad (`$SP`; `$W` is the worktree) and never touch port 4321, `apps/dox/dist` or the
  worktree's own `packages/gmt/dist`:

  ```bash
  BASE=$(git -C "$W" merge-base HEAD origin/main)
  mkdir -p "$SP/base" && git -C "$W" archive "$BASE" | tar -x -C "$SP/base"
  mkdir -p "$SP/after" && rsync -a --exclude node_modules --exclude dist --exclude .git \
    --exclude .astro --exclude .visual --exclude .wrangler "$W"/ "$SP/after"/
  # In each tree (the branch's library may be rsynced from "$W/packages/gmt/dist" instead):
  # (The base tree may predate the Node pin, so keep the fnm prefix for it.)
  cd "$SP/<tree>" && eval "$(fnm env)" && fnm use && pnpm install --frozen-lockfile \
    && pnpm --filter @northguild/gmt build \
    && DOX_VITE_CACHE_DIR="$SP/vite-<tree>" pnpm --filter @gmt/dox build
  # Serve the branch build for the browser gates, then stop the server:
  python3 -m http.server 48391 --bind 127.0.0.1 --directory "$SP/after/apps/dox/dist"
  # The site is under the base: open http://127.0.0.1:48391/gmt/
  ```

  Re-run the `rsync` and the site build of `$SP/after` after any change. Firefox does not
  launch on the author's machine; record it as blocked and do not bypass the sandbox.
- **The weekly gate sweep** (`.github/workflows/dox-gates-weekly.yml`). Every page, three browsers,
  both themes, filed as `dox-gate` issues.
  - **Triggers.** A Sunday cron (`41 4 * * 0`) and `workflow_dispatch` with `force_finding` (also
    file one `[dry run]` issue). The sweep always runs: there is no skip rule. The workflow stays
    disabled until the owner says to enable it; Claude never enables it, and dispatches a run only
    when asked.
  - **Legs.** `pnpm --filter dox gates --all --tier weekly --browsers <b> --themes dark,light
    --retries 1 --shard i/n`, `timeout-minutes: 90`, `fail-fast: false`. `--shard` splits each
    gate's sorted page list round-robin, not the gates, so every leg of a browser runs every gate
    on its share of the pages. Under `--all`, Chromium gets every page of every gate; WebKit and
    Firefox get every page of `grow-measure`, `readout-still`, `data-credits-check` and
    `canada-layout-check`, and the six-page sample of the three a11y gates (`fullBrowsers`);
    `contrast-measure` is Chromium-only; the two clock-still gates have one page each (shard 1 only).
    Layout: **chromium 6 legs, webkit 3, firefox 3** (12). Sizing, from the local sweep on the
    author's Mac (a runner is assumed 1.5 to 2 times slower; each leg also builds the site, about 40 s
    locally): Chromium is 125 min for `readout-still` (62), `contrast-measure` (37), `grow-measure`
    (24) and the rest, plus the three a11y gates over 1,092 pages and both themes, measured at 77
    (`a11y-axe` 38, `a11y-media` 33, `a11y-tab-walk` 6): about 202 min, so 202 / 6 is 34 per leg and
    the worst shard (extra single-page gates, rounding up) about 37. WebKit and Firefox are about
    90 each (`readout-still` 62 plus `grow-measure` 24 plus a few), so 90 / 3 is 30 per leg and the
    worst about 34. That keeps every leg under 40 local minutes and about 75 on a runner at 2 times;
    the slowest real leg is recorded here after the first runs. Chromium on 5 legs would be about 44
    local at the worst shard, which leaves no margin under the 90-minute timeout at 2 times.
  - **Report.** Job `report` (`issues: write`) downloads the newest `dox-gates-<leg>-<run id>` artifact of
    each leg (`summary.json`, `*.ndjson`) and runs `apps/dox/scripts/gates/file-issues.mjs --legs <all
    twelve>`. Only `FAIL` rows file; `FLAKY` (failed, passed on the retry) is listed in the step
    summary. The key is `<gate>:<rule>:<page>:<target>`; the target is the element's identity key (see
    "Element identity" below), never a class or an `nth` position;
    browsers, widths and themes are not in it, so one issue tables every place the finding was seen.
    A leg with no readable `summary.json` is sorted by its job in the run's job list (`gh api
    …/runs/<id>/jobs`, read only when a summary is missing): if its `Check the summary was written`
    step passed, the runner wrote the file and the upload or download lost it, and the leg joins the
    one `dox-gate:not-uploaded:all:` issue, which points at those two steps. Otherwise it files
    `dox-gate:could-not-run:<leg>`, naming how the job ended and the first step that did not
    succeed. A failed gate run and a lost upload both end with the gates step failed and the upload
    step passed (`if-no-files-found: warn`), so the check step is the only signal that separates
    them. If the job list cannot be read, the leg is filed as could-not-run, saying the cause is
    unknown. A `FAIL` with no structured finding files `<gate>:unstructured:all:` with its log tail.
  - **Issues.** Label `dox-gate` only (created when missing, with `dox-gate-dry-run`), and no issue
    type; first body line `<!-- dox-gate key="…" -->` (`"`, `>` and `--` in a key are written as
    entities). An open `dox-gate` issue whose first line equals the marker gets a comment on the
    lowest-numbered match; otherwise a new issue opens. **Flood guard:** more than 10 new issues in one
    run opens none and files one `dox-gate:flood` issue listing every held-back key (a comment if it
    is already open); comments on already-open findings still go out. Nothing is closed
    automatically: whoever fixes a finding closes its issue.
  - **Dry run.** `node apps/dox/scripts/gates/file-issues.mjs --print --dry-run-finding <summary.json>`
    plans against the live open-issue list, prints one line per action (`open  <key>  <title>` or
    `comment #123  <key>`) and a count, and files nothing; it needs `gh` signed in. Outside GitHub
    Actions (`GITHUB_ACTIONS` not `true`) it only plans: without `--print` it exits 2 with "run with
    --print locally; issues are filed by the weekly workflow". A summary path that is unreadable (without
    `--legs`) or has no leg folder is also exit 2, before any `gh` call; with `--legs`, the legs with no
    summary are the `--legs` entries with no readable summary, including when no summary arrived at
    all. Locally (no `GITHUB_RUN_ID`) there is no job list, so they plan as could-not-run. Use a summary with
    no `FAIL` row, since a local `--all` summary's hundred findings plan as one flood issue. In CI,
    dispatch with `force_finding`: one `[dry run]` issue appears (key `dry-run:synthetic:/:body`,
    label `dox-gate-dry-run` instead of `dox-gate`), and a second dispatch comments on it.
- **Local dev:** `pnpm dox:dev` (site + chat Worker) or `pnpm dox:dev:site` (site only), both at `http://localhost:4321/gmt/`.
  A warm start is ~10 s: the gmt dev build (`build:dev`) rebuilds `dist/` in place in ~5 s, every `generate` step
  skips when its inputs are unchanged, and `upstream refresh` makes no network calls
  while its live file is under 6 h old (`UPSTREAM_REFRESH=force`). No site build is
  needed — the Worker reads `/gmt/retrieval-chunks.json` from `astro dev` through
  `DOX_ASSETS_ORIGIN`. Content edits hot-reload; gmt source edits regenerate the
  reference in place (`src/lib/gmt-reference-watch.ts`); a new export needs a restart.
  `dev-all.mjs` only ever stops its own children. If another `astro dev` holds this
  project's lock (per project, not per port) it exits instead of replacing it — stop that
  one with `astro dev stop` first. A taken Worker port needs `DOX_WORKER_PORT`.
  Astro proxies `/gmt/api/…` to the Worker (`src/lib/dev-worker-proxy.ts`, port from
  `DOX_WORKER_PORT`, default 8787). The proxy key is `^/api`, not `/gmt/api`: Astro's dev base
  middleware strips `/gmt` before Vite's proxy runs, so a `/gmt/api` key never matched and every
  API call got Astro's 404 page. `rewrite` puts the base back, as the Worker expects the full
  path. `dev-worker-proxy.test.ts` starts the real `astro dev` CLI (`--ignore-lock`, clean
  env) against a stub Worker; Astro reordering its middleware fails it.
- **Local chat:** `pnpm dev:chat` (build, then `wrangler dev`), or `npx wrangler dev --port
  8799` with `dist/` already built. `.dev.vars` holds `NORTHGUILD_GMT_GEMINI_API_KEY` and
  `DOX_DEV_KEY` (`.dev.vars.example`).
- **Dev bypass:** `npx wrangler secret put DOX_DEV_KEY` in production, the same value in
  `.dev.vars` locally, then visit **`/gmt/api/brains?key=<secret>`** once per browser. It
  exempts you from the visitor cap, never from the shared pool.
- **Probe brains** (spends real quota):

  ```bash
  cd apps/dox
  npx wrangler dev --port 8799 --var DOX_DEV_KEY:probe --var NORTHGUILD_GMT_GEMINI_API_KEY: \
    > /tmp/dox-wrangler.log 2>&1 &
  npx tsx scripts/probe-brains.ts --base http://localhost:8799/gmt \
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
  - the Firefox legs of `grow-measure`, `readout-still`, `data-credits-check`, `canada-clock-still`,
    `canada-stored-still` and `canada-layout-check` (`--browsers firefox`, or `chromium,webkit,firefox`
    through `pnpm --filter dox gates`): the scripts accept the engine and Firefox's sandbox blocks the
    launch on the author's machine, so run them on a machine where it launches;
  - the runner's `--baseline` path for `html-diff` and `visual-diff` end to end on a real base tree
    (the contract of each script is checked; the base-tree wiring is exercised with the working tree as
    its own baseline);
  - `html-diff` and `visual:diff` after the interval visualizer's `data-role="axis"`
    attribute — both need a baseline captured from a clean worktree of the commit before that
    change (see the baseline runbook above);
  - the Tier 3 keyboard-only, reduced-preference and Firefox/Safari pass;
  - the Firefox and WebKit legs of `a11y-axe`, `a11y-tab-walk` and `a11y-media` (`--browsers
    firefox`): the scripts accept the engine, but Firefox cannot launch on the author's machine;
  - **the `dox-gates` PR job** (`ci.yml`, "The PR job"): a run passes in under 15 minutes (record
    the time in the "The PR job" bullet), and a PR that touches nothing under `apps/dox/` or
    `pnpm-lock.yaml` shows the job as skipped;
  - **the weekly gate sweep** (`dox-gates-weekly.yml`, "The weekly gate sweep"), which can only be
    dispatched once the file is on `main`:
    - a `force_finding` dispatch finishes every leg, Firefox included, and files one `[dry run]`
      issue with the marker on line 1; a second dispatch comments on it;
    - every leg finishes inside its 90 minutes; record the slowest leg's time in the runbook entry.

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
  - a second discovery page beside the guides index;
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
