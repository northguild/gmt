## B. Industry layers: declared, not inferred

Today an industry layer *is* a namespace: `scripts/stats.mjs` `industryLayers()` (line 215) takes
the prefix of each `guides/industries/<prefix>-….mdx` file and throws when no such namespace
exports a function; `gmt-stats.json` `industries` lists those namespaces;
`src/lib/industry-tags.ts` builds every tag id from that list; the API Reference's "By industry"
group, the overview text at `/reference/<namespace>/`, the page tags, the `/why-gmt` industry chart
and the README's "By industry:" line all key on it. A Maritime guide therefore makes
`stats.mjs` throw ("`maritime` exports no function"), and nothing can say that Transport uses the
duty engine or that Maritime uses `gnss`.

### B1. The rule

- **An industry is declared** in `apps/dox/src/data/industries.json`: its own namespace, when it
  has one, and the modules it **draws on**. A drawn-on module is a subpath of the exports map at
  one of two depths: a whole namespace (`workforce`, `gnss`, `timescale`), meaning every module in
  it, or one sub-module (`<namespace>/<module>`), meaning that module alone.
- **An industry's own namespace is named for it** (`@northguild/gmt/<id>`): `transport`,
  `intermodal`, `workforce`, `gnss`. Maritime has none yet; MAR-17 creates `maritime/`.
- **A cross-industry layer is an industry** (decision 16, `context/coding-standards.md` line 230).
  `workforce` and `gnss` are recognised domains that other industries draw on; on the site each is
  an industry with its own namespace, hub, guide and tag, and the industries that use it declare
  it in `drawsOn`. `timescale` is Core: no industry owns it, and GNSS and Maritime draw on it.
- **An own namespace is an industry namespace:** it sits under the reference sidebar's "By
  industry" divider, its reference pages carry its industry's tag, and its functions are that
  industry's solid segment in the `/why-gmt` chart (B9). A drawn-on Core module stays general
  everywhere: the reference sidebar, `/reference/`, the README, its pages' tags.
- **Every industry gets a hub page** at `/industries/<id>/`, generated, and every industry is
  listed at `/industries/` and on the `/reference/` root page.
- **The tags on a tool, scenario, guide or mistakes page** name the layer that owns the functions
  the page runs, or `core` when the page uses no industry's own namespace. A page sits in one
  section of each menu, never two: an industry that draws on that layer links the page from its
  hub's problem list instead of carrying its tag, as Intermodal does for Transport's tools. So a
  GNSS tool is `[gnss]`, the duty scenarios are `[workforce]`, a timescale-only page is `core`, and
  Maritime, which has no namespace, tags only its own guide until it has tools of its own.

### B2. `apps/dox/src/data/industries.json` (new, tracked)

An array in display order. **The order follows what builds on what**, so a reader meets a layer
before any layer that uses it: **Workforce** (draws on nothing), **Transport** (draws on
`workforce`), **Intermodal** (draws on `transport`: its legs and day counts, decision 21),
**GNSS** (draws on Core `timescale` only), **Maritime** (draws on `gnss`). Today's order is
intermodal before transport, an accident of the function count, so the tools index, the three
section sidebars, the reference "By industry" groups and the README line change order; read that
diff as intended.

```json
[
  {
    "id": "workforce",
    "label": "Workforce",
    "definition": "People's working time: duty logs, hours-of-work limits, rest and rolling windows, for any crew, shift or rota.",
    "icon": "industry-workforce",
    "guide": "/guides/industries/workforce-hours-of-work/",
    "namespace": "workforce",
    "drawsOn": []
  },
  {
    "id": "transport",
    "label": "Transport",
    "definition": "Legs, dwell, cut-offs, punctuality and crew hours of work, shared by road, rail, sea and air.",
    "icon": "industry-transport",
    "guide": "/guides/industries/transport-legs-and-dwell/",
    "namespace": "transport",
    "drawsOn": ["workforce"]
  },
  {
    "id": "intermodal",
    "label": "Intermodal",
    "definition": "<today's text from industry-tags.ts>",
    "icon": "industry-intermodal",
    "guide": "/guides/industries/intermodal-free-time-and-demurrage/",
    "namespace": "intermodal",
    "drawsOn": ["transport"]
  },
  {
    "id": "gnss",
    "label": "GNSS",
    "definition": "Satellite navigation time for any receiver: the six system times, week numbers and their rollovers, and RINEX navigation weeks.",
    "icon": "industry-gnss",
    "guide": "/guides/industries/gnss-system-time-and-week-rollover/",
    "namespace": "gnss",
    "drawsOn": ["timescale"]
  },
  {
    "id": "maritime",
    "label": "Maritime",
    "definition": "Satellite time at sea and in ships' records: the clocks receivers on board read, their week rollovers and the leap seconds between them.",
    "icon": "industry-maritime",
    "guide": "/guides/industries/maritime-gnss-time-and-week-rollover/",
    "drawsOn": ["gnss", "timescale"]
  }
]
```

D1 writes Workforce, Transport and Intermodal (with the library's `workforce/` move landed, P1).
The GNSS and Maritime entries are added in step D1b + D3, right after their guides are written (the
overview test requires each guide).

Rules, each enforced (B3 for `stats.mjs`, B8 for the tests):

- `id` is a lowercase word, unique, and never `core` or `space`. `industry-tags.ts` exports
  `RESERVED_INDUSTRY_IDS = ["core", "space"]` with a comment: `core` is the tag for core-only
  pages; `space` is taken by a planned spatial and geo expansion.
- `namespace`, when present, equals `id` and exports a function. If a namespace named `<id>`
  exports a function, industry `<id>` declares it as its `namespace`.
- `drawsOn` has no duplicate and does not hold the industry's own namespace. Each entry is a whole
  namespace or a `namespace/module` that exports a function (the corpus has a function with that
  `namespace`, or that `namespace` and `module`); no entry is both listed whole and as one of its
  sub-modules.
- An entry of `drawsOn` that is another industry's own namespace is a **shared industry layer**
  (Transport's `workforce`, Intermodal's `transport`, Maritime's `gnss`); any other entry is a **Core module** (`timescale`).
- An industry with no `namespace` draws on at least one module.
- `guide` is the path of a guide whose file is `guides/industries/<id>-<topic>.mdx`.
- `icon` names a key of `INDUSTRY_ICON_PATHS`.

### B3. `scripts/stats.mjs` and the READMEs

- **`industryLayers()` becomes `industryDeclarations(corpus)`.** It reads
  `apps/dox/src/data/industries.json` and checks the B2 rules that need the corpus: every
  `namespace` and `drawsOn` entry exports a function; every `guides/industries/<prefix>-….mdx`
  prefix is a declared `id` (error: "an industry guide is named for a declared industry, and
  `<prefix>` is not one; declare it in apps/dox/src/data/industries.json"); a namespace named for a
  declared industry is that industry's `namespace`. The header comment's "industry layers" source
  line says the declaration file is the source.
- **`apiSurface()` returns `industryNamespaces`**: every industry's own namespace, in
  `byNamespace` order. `gmt-stats.json`'s key `industries` is renamed `industryNamespaces`. With
  the library's move it holds `transport`, `intermodal`, `workforce` and `gnss`.
- **`apiSurface()` also returns `industryLayers`**, the stacked chart's data (B9), in declared
  order: `{ id, label, own: number, drawsOn: [{ module, count, shared: boolean }] }`, each count the
  corpus's functions in that namespace or `namespace/module`; and **`industryFunctions`**, the
  number of distinct functions in all own namespaces. Core functions are every function outside
  an own namespace, so `coreFunctions + industryFunctions = functions` exactly. `statsObject()`
  (line 344) writes all three into `gmt-stats.json`, and `show` (line 858) prints each industry
  with its namespace and drawn-on modules.
- **`namespaceLinkProblems` (line 610) checks the new README shape:**
  1. Every namespace that exports a function has one `…/reference/<ns>/` link, labelled with its
     namespace, on a line that does not start with `By industry:`. That includes the own
     namespaces (`transport`, `intermodal`, `workforce`, `gnss`). No `/reference/` link to anything
     else; a sub-module has no README link of its own.
  2. The `By industry:` line links `https://gmt-dox.northguild.workers.dev/industries/<id>/` for
     exactly the declared industries, in declared order, each labelled with its `label`, and
     holds no `/reference/` link.
  3. No `/industries/<id>/` link to an undeclared id anywhere.
  Each failure is a message for a person, as today; `sync` rewrites none of it.
- **The README edit**, identical in both files: `[transport]`, `[intermodal]` and `[workforce]`
  join the namespace line and `[duty]` leaves it (the library finalizer adds `[gnss]` and
  `[timescale]`, L§5.3; whichever of the two lands second keeps the line consistent). Line 52
  becomes `By industry: [Workforce](…/industries/workforce/) · [Transport](…/industries/transport/)
  · [Intermodal](…/industries/intermodal/)`, with the full site URL in each link, and
  `· [GNSS](…/industries/gnss/) · [Maritime](…/industries/maritime/)` is appended in step D3. Then
  `node scripts/stats.mjs check` passes.
- **The agent docs that state the old rule**, one sentence each, saying the namespace line links
  every namespace and the "By industry:" line links each industry's page:
  `.agents/finalizer.md` (86–87), `.agents/gmt-reviewer.md` (359),
  `.agents/skills/update-readme/SKILL.md` (30, 62), `.agents/skills/update-readme/references/steps.md`
  (67), `context/code-review-checklist.md` (44; change only that line).

### B4. `src/lib/industry-tags.ts` and `src/data/gmt-stats.ts`

- `industry-tags.ts` reads `industries.json` and no longer imports `gmt-stats`. It stays a leaf
  (`content.config.ts` imports it). `DETAILS` keeps only `core`; every layer's label, definition,
  icon and guide come from the JSON.
- Exports, all derived from the JSON:
  - `INDUSTRY_TAG_IDS` (core, then the layers in declared order) and `INDUSTRY_LAYER_IDS` (the
    layers);
  - `ownNamespace(id): string | undefined`; `OWN_NAMESPACES` (in declared order);
    `industryOwning(namespace): string | undefined`;
  - `drawsOn(id): readonly string[]`;
  - `moduleCovers(declared, namespace, module): boolean`: a whole namespace covers each of its
    modules; a sub-module covers itself alone. Every consumer below matches through it, never by
    string prefix;
  - `industriesUsing(namespace, module): readonly string[]`: every industry whose own namespace or
    drawn-on modules cover it;
  - `RESERVED_INDUSTRY_IDS`.
- `INDUSTRY_ICON_PATHS` gains three glyphs in the 24×24 stroke format of the others, none reusing
  a transport mode's glyph (`ship` and `barge` are modes): `"industry-workforce"` (a person beside
  a clock face), `"industry-gnss"` (a satellite: a body, two panels and a signal arc) and
  `"industry-maritime"` (an anchor). Each is legible at 14px; `industry-tags.test.ts` checks every
  icon exists.
- `industrySidebarCss()` emits one rule per industry with an own namespace (only those have a
  reference group). Its test says so.
- `gmt-stats.ts`: `GmtStats.industries` becomes `industryNamespaces`; `GmtStats` gains
  `industryLayers` and `industryFunctions`. `coreNamespaces`, the exported `industryNamespaces`
  (the `NamespaceCount[]`), `coreFunctions` and `industryFunctions` read them; the names of the
  exports stay. `gmt-stats.test.ts` asserts `coreFunctions + industryFunctions === functions`.
- `src/content/docs/why-gmt.mdx` line 112: "{n} are industry layers built on it" becomes
  "{n} belong to one industry each". The figures still come from `gmt-stats`.
