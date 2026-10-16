## B. Industry layers: declared, not inferred (continued)

### B5. The generator (`scripts/build-reference.ts`, `scripts/build-utils/index-pages.ts`)

- `industryOf(namespace)` (line 3153) becomes `industryOwning(namespace)`. `withIndustry` and
  `typeIndustry` (line 2804) read the own namespaces: a shared type is tagged only when every
  function that reaches it is in one industry's own namespace. A `gnss` type is tagged GNSS; a
  `timescale` type is general.
- `buildSidebar(…, industries)` receives `OWN_NAMESPACES`. The divider, its label and each own
  namespace group's `Overview` link with `data-gmt-industry` are unchanged; `workforce` and `gnss`
  now sit under the divider.
- `industryIndex()` (line 2814) returns every declared industry with its `namespace` and `drawsOn`.
- **`/reference/` root** (`renderIndexPages`): "For any industry" lists every namespace that is no
  industry's own (`timescale` among them). "By industry" lists every declared industry: its `Icon`,
  `[Label](/industries/<id>/)`, its definition, then its own namespace as a link when it has one
  and "Draws on [`gnss`](/reference/gnss) and [`timescale`](/reference/timescale)." (each module
  linked to its own index). Its lead sentence: "Each industry has a namespace of its own, draws on
  the layers above it, or both."
- **`/reference/<own namespace>/`** keeps its tag and its module lists. The pain-point block
  (`industryIntro`) leaves it for the hub. In its place, one line: "The Transport industry's own
  namespace. What it solves, and the guides and tools that show it, are on
  [Transport](/industries/transport/)." The URLs of `transport` and `intermodal` are unchanged.
- `industryIntro` and `painPointItem` move to `scripts/build-utils/industry-pages.ts` (B6).
  `firstSentence` and `listItem` are exported from `index-pages.ts` for it.
- `referenceInputs()` lists `src/data/industries.json`, `build-utils/industry-pages.ts` and
  `build-utils/moved-pages.ts` (M3).

### B6. The hub pages

**New:** `scripts/build-industry-pages.ts` (a `generate` step) and the pure
`scripts/build-utils/industry-pages.ts`.

- **Step order** in `apps/dox/package.json` `generate`: after `build-tool-index.ts`, before
  `build-industry-sidebars.ts`. It reads `src/generated/reference/gmt-corpus.json` (the one
  extraction; it never walks `packages/gmt/src`) and the frontmatter of every page under
  `guides/`, `tools/`, `scenarios/` and `mistakes/`, using `readSectionPage` from
  `build-utils/industry-sidebar.ts` (extend it to read `description` for the lists).
- **It writes**, through `writeIfChanged`, deleting a stale hub as `syncTree` does:
  - `src/content/docs/industries/index.mdx`: title `By industry`, one item per industry: label as
    a link to its hub, definition, its own namespace, and "Draws on" its modules.
  - `src/content/docs/industries/<id>.mdx` per industry (`workforce`, `transport`, `intermodal`,
    `gnss`, `maritime`), frontmatter `title: <Label>`, `description: <definition>`,
    `industries: [<id>]`, then:
    1. the overview's `about` paragraph;
    2. `## What these functions solve`: each pain point, its `{{name}}` tokens linked to the
       function's corpus `url`. A token naming a function outside the industry's own namespace and
       drawn-on modules stops the step with a message naming `src/lib/industry-overview.ts`;
    3. "Start with the guide: [title](guide)." with the guide's own title;
    4. `## Its own functions` (when it has a namespace): `### [`ns`](/reference/ns)`, each module
       as a bold link to its index and its functions as `listItem`s;
    5. `## Functions it draws on`: per drawn-on module in declared order, a whole namespace as
       `### [`ns`](/reference/ns)` with its modules, a sub-module as
       `### [`ns/module`](/reference/ns/module)` with its functions. A shared industry layer's
       heading is followed by "Part of the [GNSS](/industries/gnss/) industry layer." (its own
       hub);
    6. `## Guides`, `## Tools`, `## Scenarios`, `## Mistakes`: every page in that section whose
       `industries` holds the id, by title, each `- [Title](/section/slug/): description`. An empty
       section is left out.
  - `src/generated/industries-sidebar.ts`: `industriesSidebar`, `{ label: "Overview", slug:
    "industries" }` then one link per industry, `{ label, slug: "industries/<id>", attrs:
    { "data-gmt-industry-link": "<id>" } }`.
- **Plain Markdown only** in the hubs: no component import, so `stripMdx` and the `.md` twin need
  nothing new.
- `.gitignore`: `apps/dox/src/content/docs/industries/`, beside the tools index line.
- `astro.config.mjs`: import `industriesSidebar`; a top-level group
  `{ label: "Industries", collapsed: true, items: industriesSidebar }` after "Start here".
- **`SidebarSublist.astro`**: a link entry carrying `data-gmt-industry-link` shows the tag's glyph
  as an inline `aria-hidden="true"` `focusable="false"` SVG before its label, in the label's own
  colour, through the helper that draws a divider's icon (generalise `dividerIcon` to take the
  id). The attribute is not `data-gmt-industry`, because the group-icon rule
  (`details:has(> ul > li > a[data-gmt-industry])`) would then paint the "Industries" group's own
  summary.
- **`llms.txt` and `llms-full.txt`** (`src/pages/llms.txt.ts`, `llms-full.txt.ts`): an
  "Industries" section after "Start here" listing `/industries/` and each hub.
- `guides/industries/index.mdx` (step D3): one sentence under its intro: "Each industry also has
  an overview page under [By industry](/industries/)." Its frontmatter description stops naming
  the layers: "Guides for the industry layers built on the core primitives, with real-world
  scenarios." Its "Layers" list gains the Workforce, GNSS and Maritime guides.

### B7. Overview text (`src/lib/industry-overview.ts`)

- `IndustryOverview` keeps its shape. A `{{name}}` token resolves against the industry's own
  namespace and its drawn-on modules (`moduleCovers`).
- Wording is the builder's, under `/plain-english` and the test's rules: no digit (so no "1024",
  no "L1NV"), no "GMT", no law or named regime, no UTC+3 or Moscow, three to five pain points.
- **Workforce** (step DU): `about`: people's working time is counted in duty days, rolling
  windows and rests that may be split; a regime is a set of numbers the caller states. Pain points
  from the hours-of-work pages: a duty day that does not start at midnight (`{{dutyDayFor}}`); a
  sliding window that is not a calendar day (`{{evaluateDutyLog}}`, `{{dutyTotals}}`); a split rest
  that does or does not qualify (`{{qualifyingRestPairs}}`); a log that must be checked before it is
  counted (`{{isValidDutyLog}}`). "See" links: the Workforce guide, `mistakes/workforce`, the three
  scenarios.
- **Transport** gains one pain point (step DU) for crew hours of work: tokens name `workforce`
  functions, which resolve because Transport draws on `workforce`; "see" links to the Workforce
  guide and the driver-shaped scenarios.
- **GNSS** (step D3): `about`: every satellite system keeps its own continuous clock, counts weeks
  on a counter that wraps, and differs from UTC by a number of seconds that grew with every leap
  second; this layer reads those clocks and weeks without a hand-kept offset. Pain points:
  1. "A receiver's week number repeats." → `{{gnssWeekToUtc}}` takes the counter and the rollover
     era by name, and `{{utcToGnssWeek}}` returns the week, the time of week and the era. See the
     decoder, the rollover checker and the wrapped-week scenario.
  2. "Satellite time is not UTC, and the gap grew with each leap second." → `{{utcToGnss}}` and
     `{{gnssToUtc}}` read each system's gap from the built-in leap-second table, for every system
     alike. See the clock converter and the hard-coded offset scenario.
  3. "A week in a RINEX navigation file is not the week a satellite sends." → `{{rinexWeekToUtc}}`
     and `{{utcToRinexWeek}}` read the continuous count. See the RINEX scenario and the decoder.
  4. "A logged second sixty may not be a real leap second." → `{{isLeapSecond}}` checks the table,
     and `{{toTAI}}` and `{{fromTAI}}` carry an inserted second through (drawn on from
     `timescale`). See the leap-second scenario and the leap-seconds guide.
- **Maritime** (step D3): `about`: ships and their shore systems take time from satellite
  receivers, carry it between instruments in standard sentences, and keep logs that outlive a
  receiver's week counter. Pain points: a receiver that starts reporting dates a counter period
  early (`{{gnssWeekToUtc}}`, the rollover checker); a log that mixes satellite time and UTC
  (`{{gnssToUtc}}`); a leap second in a ship's record (`{{isLeapSecond}}`). "See" links: the
  Maritime guide, the GNSS guide, the rollover checker and the clock converter.
- `guideTitle` of each: its guide's own title, read from its file.

### B8. Tests

- **`industry-tags.test.ts`**:
  - "has a tag for core and for every declared industry": `INDUSTRY_TAG_IDS` equals core plus the
    JSON ids in order; no id is in `RESERVED_INDUSTRY_IDS`; every icon exists.
  - **The declaration rules of B2** that need no corpus, and those that do against the generated
    corpus.
  - **The used-layer rule.** For each page, `used` = the `(namespace, module)` pairs whose
    `/reference/<ns>/<module>/…` pages it links or whose `@northguild/gmt/<ns>/<module>` barrel it
    imports, plus `(namespace, *)` for a link to `/reference/<ns>/` itself or an import of the
    namespace barrel. `allowed` = `industriesUsing` over `used`, plus `core` when no own namespace
    appears in `used`. A page's declared tags are a non-empty subset of `allowed`. So the Core
    timescale guide (`[core]`) passes; a GNSS tool (`[gnss]`, links `/reference/gnss/…`)
    passes; a duty scenario (`[workforce]`, links `/reference/workforce/…`) passes; and a
    page that links `/reference/transport/` or `/reference/gnss/` cannot be `core`.
  - The sidebar-icon tests count the industries with an own namespace.
  - New: a hub link in `SidebarSublist.astro` draws its icon `aria-hidden` and `focusable="false"`.
- **`industry-overview.test.ts`**: text for every declared industry and nothing else; tokens name
  functions of the own namespace or drawn-on modules; the generated reference tests tag every page
  of an **own** namespace (so every `workforce` and `gnss` page), tag no page of any other namespace
  (so no `timescale` page), and tag a shared type only with an industry.
- **`gmt-stats.test.ts`**: re-derives `industryLayers`, `industryNamespaces` and
  `industryFunctions` from the corpus and the JSON, and asserts no function is counted in two own
  namespaces and `coreFunctions + industryFunctions === functions`. A fixture row checks one
  industry's own namespace drawn on by another (Intermodal's `transport` segment equals
  Transport's own count, and the distinct total counts it once).
- **`index-pages.test.ts`**, **`build-reference.test.ts`**, **`industry-sidebar.test.ts`**: follow
  the rename and the new root page, with fixtures of an industry that owns a namespace and draws on
  another industry's, one that draws on a sub-module, and one that owns none.
- **New `scripts/build-utils/industry-pages.test.ts`**: a hub's sections and order; a shared
  industry layer's heading links its hub; a sub-module lists only its own functions; a token outside
  the own namespace and drawn-on modules throws; an empty section is left out; the index lists
  every industry; the sidebar source holds `data-gmt-industry-link` and never `data-gmt-industry`.
- **A stats test is not added** (root `scripts/` has none); `node scripts/stats.mjs check` is the
  gate (I3).

### B9. The stacked "By industry" chart (`/why-gmt`)

- **Data:** `gmtStats.industryLayers` (B3), never a figure typed in the page or the chart module.
- **Marks** (`industryDefinition` in `src/lib/why-gmt-charts.ts`): one column per industry, in
  declared order, stacked with `@tanstack/charts`'s stacking (`stackRowsY` or the `barY` stack
  option; look it up in the installed version's documentation with `ctx7` before writing). The
  bottom segment is the industry's own functions, in the spring gradient, solid. Above it, one
  segment per drawn-on module, in a lighter tint of the same hue with a hatch (`--gmt-spring` at
  reduced strength plus a pattern, so the difference never rests on colour alone). An industry with
  no own namespace (Maritime) has only shaded segments.
- **Tooltip** (`industryTooltip`): the industry, its own functions, and one row per drawn-on module:
  "draws on `gnss` (GNSS industry layer): n" or "draws on `timescale` (Core): n".
- **Legend**, under the chart: a solid swatch "the industry's own functions" and a hatched swatch
  "a shared layer it draws on". Swatches are marks; the words carry the meaning.
- **Caption** (`why-gmt.mdx` line 131): "`{industryFunctions}` functions across
  `{industryNamespaces.length}` industry layers; lighter segments are shared layers an industry
  draws on." The figures come from `gmt-stats`. **No total counts a function twice**: the caption's
  number is the distinct functions of the own namespaces; a drawn-on segment repeats functions
  already counted in their own column (Workforce's, GNSS's) or in Core, and is never added into a
  total. The `industries` share in the tooltip ("Share of industry layers") divides by that
  distinct total and is shown for the own segment only.
- **The no-JS render** (`scripts/render-charts.ts`, `industryDistributionSvg`) draws the same stacked
  marks and the legend, so the server SVG and the live chart agree.
- **Accessibility:** the chart has no table fallback today, so none is added; its `aria-label`
  ("Public functions by industry layer, own and shared") and a visually hidden list under the
  chart give each industry's own count and each drawn-on module's count in words.
- **Design system:** no card or legend item carries a left-only accent; tokens only; the hatch is
  drawn with `background-color` plus `background-image` per the hatch trap; contrast at 7:1 for
  every label and tick and 3:1 for the shaded segment's edge against the chart surface, in both
  themes (`contrast:measure` on `/why-gmt/`).
