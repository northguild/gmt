# DOX-A4 — Guides, scenarios, pitfalls, and the scenario index (#133)

## Context

`apps/dox` (the Dox docs site — Astro + Starlight, deployed to Cloudflare Workers) now
has, through Tier 0 + `DOX-A5`:

- A generated **reference** page per `gmt` export (`DOX-A3a`), sidebar auto-built from
  `apps/dox/src/generated/reference/sidebar.ts`, plus `gmt-corpus.json`, a
  `route-manifest.ts`, and `widget-seeds.ts` from one extraction pass in
  [apps/dox/scripts/build-reference.ts](apps/dox/scripts/build-reference.ts).
- An AI surface (`DOX-A3b`): `/llms.txt`, `/llms-full.txt`, and a raw `.md` route for
  every page ([apps/dox/src/pages/[...slug].md.ts](apps/dox/src/pages/%5B...slug%5D.md.ts)).
- A token/brand layer (`DOX-A5`): the cyber blue/green palette, JetBrains Mono body /
  Michroma display, self-hosted, in `apps/dox/src/styles/gmt-*.css`.

What the site still lacks is **judgment** — _when_ to reach for `Pacific/Chatham`
handling, _why_ `Date` arithmetic drifts across a DST boundary. That material already
exists and is good, but is unreachable from the site:

- `packages/gmt/README.md` `## Quick Start` — ~1,450 lines of runnable, annotated
  TypeScript across six sections (README lines 181–1607).
- [docs/dst-disambiguation.md](docs/dst-disambiguation.md) — a 172-line conceptual guide,
  currently orphaned (linked only from JSDoc/CHANGELOG/skill, no nav, no index).
- The 11 domain `packages/gmt/skills/*/SKILL.md` files' **Core Patterns** sections —
  these are the skills carrying a `sources:` frontmatter list: `calculate-dates`,
  `compare-dates`, `convert-types`, `durations`, `format-date-time`,
  `format-relative-time`, `get-current`, `interval-ops`, `parse-date-time`,
  `validate-dates`, `zoned-date-ops`. (Exclude the 7 maintainer/workflow skills — no
  `sources:`, not user-facing.)

`#133` has four sub-stories. **`DOX-A4a` (guides) is Tier 1 and buildable now.**
`DOX-A4b`/`DOX-A4c`/`DOX-A4d` are Tier 5 and every one **depends on `DOX-B1a`** (the
`<Playground>` island, Tier 2, not started). They are _designed_ below but must not be
built until `DOX-B1a` lands — a scenario whose "watch it break" step is a static code
block fails its own Definition of Done.

### Decisions locked with the user

| Decision                     | Choice                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                        | Build `DOX-A4a` now; design `DOX-A4b`/`c`/`d`, gate on `DOX-B1a`.                                                                        |
| `docs/dst-disambiguation.md` | Stays the **single canonical source**. A build step copies it into `src/content/docs/guides/`. No inbound link changes, zero divergence. |
| README Quick Start           | **Left intact** as the GitHub shopfront. No `packages/gmt` edit, no changeset.                                                           |
| Guide granularity            | ~one page per `domain_map` skill; the Intervals material split ~4 ways. ~18–20 guide pages.                                              |

### Definition of done — binding (from `issues/DOX-A.md`)

- `pnpm nx run-many -t lint test typecheck build` stays green, **including the 20-cell GMT
  timezone matrix**. `apps/dox` must not perturb `packages/gmt`.
- No changeset (`apps/dox` is private) — and per the decisions above, `packages/gmt` is
  not touched.
- No `@octanejs/*` / Octane dependency.

---

## Part 1 — `DOX-A4a`: Guides (build now)

### 1.1 Information architecture

Drive ordering and grouping from
[packages/gmt/skills/\_artifacts/domain_map.yaml](packages/gmt/skills/_artifacts/domain_map.yaml)
and [skill_tree.yaml](packages/gmt/skills/_artifacts/skill_tree.yaml) — do **not** invent a
structure. The domain map's five domains become the guide sidebar groups:

```
src/content/docs/guides/
  index.mdx                         ← "Guides" landing: what's here, how it's organized
  concepts/
    dst-disambiguation.md           ← GENERATED from docs/dst-disambiguation.md (see 1.4)
    plain-vs-zoned.mdx              ← lifted from README "Design Philosophy" + Core Rules framing
  core-date-operations/
    get-current.mdx                 ← get-current skill Core Patterns + README §"Plain arithmetic"
    plain-arithmetic.mdx            ← calculate-dates Core Patterns + README arithmetic/comparison
    comparisons.mdx                 ← compare-dates Core Patterns
    durations.mdx                   ← durations Core Patterns + README §Durations
    parsing.mdx                     ← parse-date-time Core Patterns + README §Parsing
    formatting.mdx                  ← format-date-time Core Patterns + README §Formatting/§Named machine formats
    relative-time.mdx               ← format-relative-time Core Patterns
    validation.mdx                  ← validate-dates Core Patterns
    calendar-systems.mdx            ← README §"Calendar systems" (+ calendar-aware subsections)
  zoned-date-operations/
    zoned-operations.mdx            ← zoned-date-ops skill Core Patterns + README §"Zoned operations"
    (dst-disambiguation cross-linked from concepts/)
  conversion/
    converting-types.mdx            ← convert-types Core Patterns + README §"Unix and UTC helpers"
  intervals/
    interval-basics.mdx             ← validation + construction (isValid*, intervalFromDuration*)
    containment-and-overlap.mdx     ← intervalContains*, intervalsOverlap*, intervalIntersection*
    set-operations.mdx              ← intervalUnion*, intervalDifference*, intervalXor*, intervalAbuts*, intervalEngulfs*
    splitting-and-counting.mdx      ← splitIntervalByUnit*, intervalCount*
  integration/
    app-integration.mdx             ← app-integration skill (cache keys, routers, tables, state)
    linting.mdx                     ← lint-package-suggestion skill (choose eslint/oxlint/biome config)
```

(Final page list is the builder's call within this shape — the point is
skill-Core-Patterns ≈ one guide, Intervals broken up, `domain_map` domains = groups.)

### 1.2 Content rules — this is a **port, not a rewrite**

- Lift runnable code and prose verbatim where it already reads well. Do not re-derive
  anything already stated in README / skills / `docs/`. (DoD line: "No content was
  re-derived…".)
- Each guide: short task-framed intro → the ported patterns as fenced `ts` blocks with
  their existing annotations → "See also" linking the relevant **reference** pages.
- **Do NOT port the skills' "Common Mistakes" sections** — those are `DOX-A4c`'s job with
  live proof. Porting them here as static blocks would force a rewrite in Tier 5.
- Skill Core Patterns reference sibling skill sections by relative path; rewrite those as
  intra-guide links.
- Frontmatter: `title`, `description`, and `sidebar: { order: N }` to hold `domain_map`
  ordering. Pages are `.mdx` (hand-curated); the one generated page is `.md`.

### 1.3 Sidebar wiring — [apps/dox/astro.config.mjs](apps/dox/astro.config.mjs)

Add a **Guides** group _before_ **Reference** in the `sidebar` array. Use
`autogenerate: { directory: 'guides' }` so new pages appear without touching config;
control order with per-page `sidebar.order` frontmatter and the directory grouping above.
Keep the existing `Start here` (`install`, `core-rules`) and `Reference` groups.

### 1.4 The DST guide — generated, single source

`docs/dst-disambiguation.md` stays canonical. Add a copy step to the existing generate
pipeline so the guide never diverges:

- Extend the `generate` target's command in
  [apps/dox/project.json](apps/dox/project.json) (currently
  `node ./scripts/generate-version-map.mjs && tsx ./scripts/build-reference.ts`) with a
  third step, or fold it into a tiny `scripts/build-guides.mjs`, that reads
  `../../docs/dst-disambiguation.md`, prepends Starlight frontmatter
  (`title: "DST Disambiguation"`, `description:`, `slug: "guides/concepts/dst-disambiguation"`),
  rewrites the `## Further reading` link to `context/roadmap/` (drop it or point at the
  guides index), and writes
  `src/content/docs/guides/concepts/dst-disambiguation.md`.
- Add `apps/dox/src/content/docs/guides/concepts/dst-disambiguation.md` to
  [.gitignore](.gitignore) (alongside the existing `apps/dox/src/content/docs/reference/`
  entry). Hand-written guide `.mdx` files stay committed; only the generated `.md` is
  ignored.
- Add the generated file to the `generate` target's `outputs` and `inputs`
  (`{workspaceRoot}/docs/dst-disambiguation.md`).
- **Before writing the copy step, confirm** `docsLoader()` in
  [apps/dox/src/content.config.ts](apps/dox/src/content.config.ts) picks up a nested
  `guides/**` `.md` file with a `slug:` — it does for `reference/**`, so this is a sanity
  check, not new wiring.

### 1.5 Cross-linking guides ⇄ reference

- Guides → reference: link function mentions to `/reference/<ns>/<module>/<fn>`. The URL
  shape is fixed by `pageUrl()` in
  [build-reference.ts](apps/dox/scripts/build-reference.ts) (`/reference/zoned/calculate/startOfZoned`).
  The skills' `sources:` frontmatter maps skill → source files → namespace/module, so it
  is a mechanical lookup for the bulk of links.
- Reference → guides: **out of scope for A4a's generator changes.** The generator emits
  reference MDX from JSDoc only, and JSDoc has no guide backlinks. Note this as a
  follow-up (a "Guides" section could be appended to a module index page later); do not
  expand `build-reference.ts` here.

### 1.6 AI surface — enumerate guides

`/llms.txt` and `/llms-full.txt` currently **hardcode** `install` + `core-rules`
([apps/dox/src/pages/llms.txt.ts](apps/dox/src/pages/llms.txt.ts) lines 31–43,
[llms-full.txt.ts](apps/dox/src/pages/llms-full.txt.ts) line 22). Update both to
enumerate every non-reference, non-`index` page under `content/docs/` (the
`import.meta.glob` in `llms-full.txt.ts` already loads them; `llms.txt.ts` needs the same
glob added, reading `title`/`description` from frontmatter via `stripFrontmatter`).

- Update the guide **allow-list** in
  [apps/dox/scripts/llms.test.ts](apps/dox/scripts/llms.test.ts) (`guideAllowList`,
  `guideLinks`, and the two other hardcoded `Install`/`Core Rules` blocks) to derive from
  the same page list rather than literals, so the "manifest integrity" test still passes.
- The route-manifest (reference-only `ReadonlySet<string>`) is **not** extended — guides
  are not generated routes. `llms.test.ts`'s integrity check only asserts `/reference/`
  URLs against the manifest; guide URLs go through the allow-list branch. Keep that split.

### 1.7 `DOX-A4a` Definition of done (from the issue)

- Guides reachable from the sidebar; cross-link into reference pages.
- `docs/dst-disambiguation.md` is in the nav (via the generated guide page). Canonical
  source stays `docs/`; site copy is generated — recorded here.
- A reader can answer "how do I schedule a meeting across a DST boundary" from the guides
  alone (zoned-operations guide + DST concept guide), without opening a source file.
- No re-derived content.
- `pnpm nx run-many -t lint test typecheck build` green; `pnpm nx run dox:test` green on
  a clean checkout (the generated DST guide must not break `docsLoader` when absent
  pre-build — verify, mirroring the reference stub pattern; if `docsSchema` chokes on a
  missing collection entry, commit a minimal stub `.md` the way `DOX-A3a` stubbed the
  generated modules).

---

## Part 2 — `DOX-A4b` / `DOX-A4c` / `DOX-A4d`: designed, **blocked on `DOX-B1a`**

All three consume `DOX-B1a`'s `<Playground>` island (`context/dox/issues/DOX-B.md`):
runs the **real** `@northguild/gmt` from `dist` at module-import granularity, hydrates
`client:visible`, renders sentinels as `⟨ NO SIGNAL — invalid input ⟩` in Signal-lost
amber. Do not start these until that component exists and its props are stable.

### 2.1 `DOX-A4b` — Scenario template + 3 scenarios

- **Component**: `src/components/Scenario.astro` (or an `.mdx` partial set) rendering a
  fixed five-part shape, in order:
  1. **The naive approach** — plausible `Date`/obvious-wrong-`gmt` code.
  2. **Watch it break** — a `<Playground>` instance seeded with an input that exposes the
     bug.
  3. **Why** — a short, specific explanation (not a restatement).
  4. **The gmt approach** — the correct code.
  5. **Same widget, working** — a second `<Playground>` instance, correct output.
- **Location**: `src/content/docs/scenarios/`. New sidebar group **Scenarios**.
- **Ship 3**, chosen from the issue's list; recommended first three (highest teaching
  value, least overlap with `DOX-A4c` pitfalls):
  - Recurring meeting across a DST boundary (`addZoned` vs naive `Date` +7d).
  - Storing a birthday: plain date vs instant (`PlainDate` vs `ZonedDateTime`/epoch).
  - Monthly billing without drift (`addMonths` overflow vs `+30 days`).
- **Before starting**: read `domain_map.yaml` task framings and the 11 skills' Common
  Mistakes sections — do not develop an example that `DOX-A4c` will also cover.
- **DoD**: template renders for all 3; each "broken" widget genuinely reproduces the
  failure and each "fixed" one genuinely does not; a reader completes a scenario without
  a source file or the console.

### 2.2 `DOX-A4c` — Ported pitfalls with live proof

- **Source**: the 11 domain skills' **Common Mistakes** sections — **63** graded mistakes
  (1 CRITICAL, 23 HIGH, 39 MEDIUM), each already a wrong-vs-right pair. Read all 11 in
  full before starting; count against 63 so none is silently dropped. Several skills tag
  severity inline in the heading (e.g. `durations`: `### HIGH …`, `### MEDIUM …`);
  `zoned-date-ops` does not — severity there must be read from body text.
- **Shape**: one page per domain (grouped), each mistake a block: severity badge →
  wrong code (`<Playground>` showing the documented bad output) → right code
  (`<Playground>` showing correct output) → one-line why.
- **Severity treatment**: a token-driven badge (`CRITICAL`/`HIGH`/`MEDIUM`), visually
  scannable down the page. Reserve Signal-lost amber for the _sentinel_, not severity
  (per `DOX-A5` / overview §3) — severity uses its own scale (e.g. Cyan/Teal/Ice weights
  or a dedicated ramp added to `gmt-tokens.css`).
- **Cross-link**: every pitfall page from ≥1 reference page and ≥1 guide (`DOX-A4a`).
  Reference→pitfall backlinks have the same generator constraint as 1.5 — likely a
  hand-maintained map or a module-index append, not a `build-reference.ts` change.
- **DoD**: all 63 on the site with live proof; severity scannable; each page cross-linked
  both ways; no rewrite where the source was already clear.

### 2.3 `DOX-A4d` — Mentor-voiced scenario index

- **Depends on** `DOX-A4b` + `DOX-A4c` (content to index).
- A "start here" page driven by `domain_map.yaml`, organized **by task** ("I have X and
  need Y"), not by namespace. Read `domain_map.yaml` (task groupings) + `skill_tree.yaml`
  (finer skill list) together.
- Surfaces, per task: the relevant reference page(s), the `DOX-A4a` guide, `DOX-A4b`
  scenarios, and `DOX-A4c` pitfalls — one mentor-voiced entry point, not a competing
  content type.
- Consider generating it: a `scripts/build-scenario-index.mjs` reading `domain_map.yaml`
  → `src/content/docs/scenarios/index.md` (gitignored, like the DST guide), so it can't
  drift from the domain map. Decide at build time.
- **DoD**: a reader with a task but no function name reaches the right reference/guide/
  scenario within two clicks; every `domain_map` domain represented.

---

## Files touched

**`DOX-A4a` (now):**

| File                                        | Change                                                                |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `apps/dox/src/content/docs/guides/**/*.mdx` | New — ~18–20 hand-curated guide pages (ported)                        |
| `apps/dox/scripts/build-guides.mjs`         | New — generates the DST guide `.md` from `docs/dst-disambiguation.md` |
| `apps/dox/project.json`                     | `generate` target: add the build-guides step, its `inputs`/`outputs`  |
| `apps/dox/astro.config.mjs`                 | Add `Guides` sidebar group (`autogenerate: { directory: 'guides' }`)  |
| `apps/dox/src/pages/llms.txt.ts`            | Enumerate guide pages instead of hardcoded `install`/`core-rules`     |
| `apps/dox/src/pages/llms-full.txt.ts`       | Same — include guide pages in the full dump                           |
| `apps/dox/scripts/llms.test.ts`             | Derive the guide allow-list from the page set, not literals           |
| `.gitignore`                                | Add the generated `guides/concepts/dst-disambiguation.md`             |

_Not touched:_ `packages/gmt/**` (README, skills, `docs/dst-disambiguation.md` all stay
as-is), `build-reference.ts`, `route-manifest.ts`, `.changeset/`.

**`DOX-A4b`/`c`/`d` (after `DOX-B1a`):** `src/components/Scenario.astro`,
`src/content/docs/scenarios/**`, `src/content/docs/pitfalls/**` (or grouped under
guides), a severity-badge token set in `gmt-tokens.css`, `astro.config.mjs` sidebar
groups, and the same `llms.txt` enumeration extended to the new content types.

## Verification

`DOX-A4a`:

1. `pnpm nx run dox:generate` — DST guide `.md` is written with valid frontmatter.
2. `pnpm nx run dox:dev` — Guides group in the sidebar; every guide page renders; the DST
   concept page renders; internal guide→reference links resolve (click through).
3. `pnpm nx run dox:build` then check `dist/`: `llms.txt` lists every guide; each guide
   has a working `/guides/.../<slug>.md` raw route; `llms-full.txt` contains the guide
   bodies.
4. `pnpm nx run dox:test` — `llms.test.ts` (manifest integrity + allow-list) green;
   green on a clean checkout with no prior `generate` run.
5. `pnpm nx run-many -t lint test typecheck build` — whole monorepo green, GMT matrix
   unperturbed (`apps/dox` change only).
6. Manual DoD check: from `guides/zoned-date-operations/zoned-operations` +
   `guides/concepts/dst-disambiguation` alone, answer "schedule a meeting across a DST
   boundary" without opening `packages/gmt/src`.
7. Spot-check "port not rewrite": diff a sample of ported code blocks against their
   README / SKILL.md origin — should be near-verbatim.

`DOX-A4b`/`c`/`d`: blocked — verification is defined in their own DoD sections above and
runs once `DOX-B1a` exists (each broken widget must actually reproduce its failure; all
63 pitfalls present; scenario index reachable in two clicks).

## Separate Agent Audit Findings
