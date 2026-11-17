# Tiers 0–1 · Reference generator, tables, industries, pages

Rules and traps for generated content and the hand-written pages. Index: [index.md](index.md).

## Reference generator

- `scripts/build-reference.ts` (TypeScript compiler API) writes everything under `src/generated/`
  and runs in `pnpm run generate` before `test`, `check` and `build`. `reference/corpus.ts`,
  `reference/gmt-corpus.json` and `reference/route-manifest.ts` predate the ignore rule and stay
  tracked, so regenerating them produces a diff to keep. MDX pages are ignored.
- It skips when `.inputs-hash` matches and writes only changed pages, deleting only stale ones
  (`build-utils/generated-files.mjs`). **Never go back to `rm -rf` and rewrite**: every file event
  reaches `astro dev`, VS Code's watcher and its TypeScript server.
- Every `build-utils` module the generator imports is listed in `referenceInputs()`, or editing it
  does not regenerate.
- Page dates come from `build-utils/commit-dates.mjs` (`newestCommit`); the input hash includes them.
- **A type is documented by use**, not by directory (`build-utils/type-usage.ts`): two or more
  functions reach it, it gets `/reference/types/<Name>`; one function, it is inline on that page;
  none, the generator stops (fix in `packages/gmt/src`). The graph reads type nodes, never printed
  signatures (the printer inlines union aliases). Duplicate type names (also by case), an
  unannotated return and a generic public function stop the generator. Two exports whose paths
  differ only by case are one file on macOS and Windows; the fix is a rename in `packages/gmt/src`.
- Anchors come from `github-slugger`, one slugger per page; the generator stops if a rendered
  page's headings differ. Every type link goes through `typeUrl` in `build-utils/reference-urls.ts`.
- A behaviour bullet may hold a fenced `text` or `ts` block; any other language, none, or an
  unclosed fence fails the build (Expressive Code falls back to `txt` with only a log line).
  `outsideFences` matches indented fences too. The block never reaches the corpus or chunks.
- **The doc gate** (`build-utils/doc-gate.ts`, `pnpm dox:docs-check`) lists every public type,
  member and option without a description, every optional input without `@defaultValue`, and
  rules like `return-description` and `param-lists-options`. A gap fails generation before any
  page is written, and `pnpm run validate` runs it first. **The fix is always JSDoc in
  `packages/gmt/src`, never a fallback string.** TypeScript does not attach a `/** */` on the same
  line as the `{` before it, and `//` comments are not JSDoc.
- `## Options` expands an inline literal or intersection, or a named object type on a parameter
  named `*options*` or `props`. `Intl.DateTimeFormatOptions` members collapse to one row.
  Nested literals are rows with dotted paths.
- One table renderer, `build-utils/render-table.ts`: `mdText` escapes prose outside code, `mdCode`
  only what breaks a span or cell (entity-escaping inside backticks prints the entity). Unions
  split into chips only at the top level (`topLevelUnion`).
- **Unit names print largest first** (`orderUnitUnions`; `reference-unit-order.test.ts` scans every
  page and fails on a union out of order). A `@param` description that lists unit names is held to it.
- Index pages use the block form `sidebar:` / `order: 0`: `ensure-sidebar-order.mjs` rewrites any
  other form on every run, which defeats `syncTree`.
- The corpus keeps one entry per public type (`url` to cite, `page` that serves it, `inlineOn`).
  `scripts/api-surface.mjs` accepts a `/reference/…#fragment` link only as a corpus `url`.
- **Redirects** are generated (`src/generated/_redirects`, ignored): three `301` rules (bare,
  slash, `.md`) per moved type, per renamed function (`build-utils/renamed-functions.ts`) and per
  moved page (`build-utils/moved-pages.ts`); generation fails unless the new path is live and the
  old one is not. Astro's `redirects` is not used (it emits meta-refresh pages). `astro dev` does
  not apply the file.
- **Unreleased badge.** A page whose export is not in the newest stable `@northguild/gmt@X.Y.Z` tag
  gets a caution aside and sidebar badge (`build-utils/released-exports.ts`, `git grep` at the
  tag). No tags (shallow checkout) means no badge. `deploy-dox.yml` runs after Release so a
  release's functions are not badged. Locally the new tag does not exist yet.
- `@example` is one inline line, `fn(args) // result (note)`; the one multi-line example is
  `getDstTransitions`. `plain/calculate/weekOfYear.ts` is the only file exporting two functions.
  The source has no `@category` / `@see` / `@since`; `src/regex/*` uses `//` comments.

## Tables

- One plain style for every prose table, in `gmt-content-tables.css` and nowhere else; the kit
  tables (DST Inspector transitions, Stored Time Audit) are the model. Body cells are weight 400
  in the body font; a row header differs by `--gmt-ice` against `--gmt-ice-dim`, never weight.
- A status word is a kit chip: components call `badge()` and render with `set:html`. Settled is
  `spring`, open `neutral`, guard `purple`; nothing here is `danger`. Colour never carries state.
- Below `@container gmt-ref (max-width: 34rem)` every prose table stacks into entry cards from
  `data-col`. `data-layout="entries"` is cards at every width; a Markdown table opts in with an
  MDX comment `table: entries` directly above it. **A table CI reports as scrolling gets the
  entries layout, never smaller padding or a pinned width.** Layout-only rules stay in the
  component; weight, font and label rules do not.
- Not in this style on purpose: kit and widget tables, and the chat's Markdown tables (`chat.css`).
- Row groups (`rehype-table-scroll.ts`) mark rows whose first cell repeats; they use colour, never
  opacity, to dim (a dimmed chip measured 6.2:1).
- **A label drawn into a table cell is out of its accessible name.** Declare it twice:
  `content: attr(data-col);` then `content: attr(data-col) / "";`.
  `src/lib/table-cell-label.test.ts` fails on a table-cell label without the pair.
- Code in a cell breaks only at set points (`src/lib/code-break.ts`): at spaces and after a `/`
  that joins two names. `rehype-table-scroll.ts` and the component helpers (`codeSpans`,
  BehaviourMatrix, BundleSize, CodePairs) all use it. A hyphenated quoted token in prose gets
  `gmt-nobreak`.
- `.gmt-ref-table` (focusable, named region only while it overflows) is the box for every table.

## Industries

- `src/data/industries.json` declares each industry (`id`, `label`, `definition`, `icon`, `guide`,
  `namespace`, `drawsOn`); each owns at most one namespace. `src/lib/industry-tags.ts` reads it;
  `industryOwning` is the only namespace-to-industry map. `core` and `space` are reserved ids.
  No generator types a list of industries, so a new one needs no generator edit.
- Sidebar: Core namespaces, then a text divider `By industry` (a link with
  `attrs: { "data-gmt-divider": "true" }` that `Sidebar.astro` draws as a span; Starlight's sidebar
  holds only links and groups), then own-namespace groups. `SidebarSublist.astro` copies
  Starlight's file of that name: **compare them on a Starlight upgrade**.
- The tree is lean (`src/lib/lean-sidebar.ts`): a page keeps its own namespace whole and every
  other namespace collapses to its Overview link (the full tree was over half of every page's
  HTML and ahead of `<main>`). Pagination is computed before the trim; `skipDividers` moves it
  off the divider. `scripts/sidebar-reach.test.ts` holds the reach rules.
- Tools, Scenarios, Mistakes and industry guides get the same dividers from
  `scripts/build-industry-sidebars.ts`; a page with no `industries` stops the step.
- Hubs (`/industries/<id>/`) come from `scripts/build-industry-pages.ts` and the hand-kept
  `src/lib/industry-overview.ts`; its `{{functionName}}` tokens outside the industry's own and
  drawn-on modules stop the generator. `industry-overview.test.ts` rejects a digit, a law or the
  word GMT in a sentence.
- Every docs page shows Core or its industries under its title. A hand-written library-wide page
  declares `industries: [core]`; a page with no tag fails `page-industries-coverage.test.ts`
  (never Core by default). Tags are computed in `route-data.ts`, never written into frontmatter.
- The README "By industry:" line must link exactly the declared industries
  (`namespaceLinkProblems` rule 2 in `scripts/stats.mjs`).

## AI surface

- `llms.txt`, `llms-full.txt` and a `.md` twin for every page come from the corpus. The root
  `llms.txt` stays **at or under 64 KiB** (`scripts/llms.test.ts`); fix a failure by moving detail
  into a per-namespace file (`src/pages/reference/[namespace]/llms.txt.ts`), never by raising the
  budget. `namespaceSummary` (`src/lib/namespace-summary.ts`) is the one summary text, also the
  namespace index description; a namespace without a line throws.
- Twin routes: `src/pages/[...slug].md.ts`, path rule `src/lib/md-twin.ts`. `llms.test.ts` checks
  every link resolves in `dist/gmt`.

## Landing carousel

- `arrival.ts` sets `data-home-carousel="wait"` before first paint; every paged rule in
  `gmt-home-carousel.css` keys on that attribute. On a landscape screen at least 64rem wide the
  landing never scrolls (`HOME_LOCKED_QUERY`).
- The licence note is the last row of the Earth's data-credits popover on `/`; every other footer
  is a closed `<details class="gmt-licence">`.
- While a page moves, its backdrop blur is off (`[data-motion]`): blur behind a moving mask drops
  frames.
- `.gmt-theme-dark` is listed last in the token block's selector list; `zone-map.fixture.ts` finds
  it by that literal. The contrast gate hides the sky star layer.

## Hand-written pages

- Guides under `src/content/docs/guides/` hold every feature's explanation; READMEs hold none, so
  a story that changes a function adds to a guide, never to a README. Industry guides are the
  generated `guidesIndustriesSidebar`.
- DST walkthroughs and holiday presets lead with London and Sydney; New York appears only as a
  labelled peer or where the subject is a US code.
- How-to guides carry `industries: [core]` and avoid generic words in titles and descriptions
  (the refusal tests in `search.test.ts` count weak matches).
- `/compare/` and its text twin render from the same builders (`library-compare-tables.ts`,
  `mdx-jsx.ts`); figures come only from `gmt-stats.json` and `library-measurements.json`
  (`src/data/library-measurements.json` is the one source; a re-measurement edits it alone, then
  `pnpm stats:sync`). Its card list is `gmt-compare-grid`, not `-cards` (the site frames every
  class holding `card`).
- Migration pages draw data and compute nothing. Facts and links only, no adjective about another
  library; clauses cite tc39.es, rfc-editor.org, unicode.org or iso.org only. The date-fns and
  Luxon pages say `isValidDate("20240212")` is `false` on purpose. A page quotes a behaviour case
  by id (`checkedLine("<id>")`), never by retyped result. Migration pages are not in the chat corpus.
- **Behaviour matrix runner.** `scripts/behaviour-matrix/` is outside the workspace with exact
  pins and its own `pnpm-workspace.yaml`; run it by hand with `TZ=Asia/Kolkata pnpm matrix`. It
  exits 2 when the polyfill and native Temporal disagree or `TZ` is UTC. `date-ban`, oxlint's
  date-library rule, fallow and Renovate skip it.
- `agent-prompt.test.ts` keeps `AGENT_PROMPT` equal to the fenced prompt in `README.md`,
  `packages/gmt/README.md` and `CONTRIBUTING.md`; change all three in one edit.

## Upstream and Pulse

- `/upstream/` filings live in `src/data/upstream-filings.json` on four trackers (`github`, `jira`,
  `chromium`, `bugzilla`); pages name a filing only through `filingKey`, `filingRef`,
  `filingGroup` and `UpstreamFilingRefs.astro`. A reader that does not recognise a response
  throws; the caller keeps the last state and warns. `pnpm upstream:sync` fills fields from `gh`.
- A "Beyond Temporal" listing is a PR or issue GMT opened elsewhere; it lives in the `listings`
  array, is never counted in the tally, and is added by hand (`repo`, `number`, `kind`,
  `summary`). `upstream check` rejects a listing whose repo is in `REPOS`. A summary says what it
  asks for and names no other library. **Trap:** retrieval tests treat off-domain words
  ("recipe", "best") as a refusal probe; keep them out of a summary.
- The defect table reads each group's `state` from `temporal-compat.json` (the canary owns state;
  the page never reads `failing`, `through` or a version to pick a badge). A reason never says
  "probe". The label is "Kept on purpose" ("Guarded" means the `gmtGuard` join).
- Filing badges are derived from the filing's own fields (`src/lib/upstream-badges.ts`), never
  hand-kept. Icons are inline Octicons (`src/lib/octicons.ts`), no icon font or CDN.
  `frame-check` measures card heads: an icon more than 2 px off the title's first line fails.
- `/pulse/` lists every scheduled check from `scripts/lib/pulse.mjs`. `pnpm pulse:check` (CI Story
  consistency) fails on a scheduled workflow with no entry, a missing `Pulse check:` line, an
  unclaimed workaround or a stale `context/canary/overview.md` table (`pnpm pulse:sync` writes it).
  Run history is read at build only. No history, or one more than 8 days old, is NO SIGNAL.
  Results are words with a pattern, never green or red. The browser uses gmt, not `Date`.
- `apps/dox/src/lib/bevel-border-widths.test.ts` fails any bevelled box whose border sides differ
  in width (Chromium paints the thick side's colour along the opposite edge); use an inset
  `box-shadow` for extra thickness.
