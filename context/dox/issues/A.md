# Story Group A — Ship the site

Five stories. After A5, `@burglekitt/gmt` has a real, deployed, searchable, linkable
documentation site. Nothing in Groups B–E is required for that to be true, and any of
them can be dropped or reordered without losing the docs.

## Definition of done — binding for every Group A story

- `pnpm nx run-many -t lint test typecheck build` stays green, **including the 20-cell
  GMT timezone matrix**. `apps/docs` must not perturb `packages/gmt`.
- No changeset is needed — `apps/docs` is private and unpublished. The one exception is
  a story that also modifies `packages/gmt` (see A3's namespace-README decision), which
  follows the normal repo convention.
- No dependency on Octane or any `@octanejs/*` package. See overview.md §1 for why.

---

### A1 — Workspace skeleton + first pages

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
A1 Create apps/docs (Astro + Starlight) and wire pnpm/nx/oxlint
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group A, item A1.

## Gap
`apps/` does not exist in this monorepo and is not a workspace glob. `@burglekitt/gmt`
has ~424 public functions and no documentation site — the only discovery path is
`packages/gmt/README.md`, whose "API Surface" section just links to GitHub tree URLs.

## Scope
- Create `apps/docs` as `@gmt/docs` (private, `"type": "module"`), depending on
  `@burglekitt/gmt` via `workspace:*`.
- Install `astro@7.2.4` and `@astrojs/starlight@0.41.7` (Starlight peers on
  `astro ^7.0.2` — verified compatible).
- `src/content.config.ts` defining the `docs` collection with Starlight's
  `docsLoader()` and `docsSchema()`.
- Ship real content, not placeholders: a landing page plus two hand-written pages
  (Install, Core Rules), both lifted from `packages/gmt/README.md`'s existing
  `## Install` and `## Core Rules` sections.
- Wire the four easy-to-miss integration files (see `context/dox/overview.md` §4):
  1. `pnpm-workspace.yaml` — add `- 'apps/*'`
  2. root `package.json` — the `"workspaces"` array duplicates the glob; add `apps/*`
  3. `oxlint.config.js` — **note the `.js` extension**. Add `apps/**` to
     `files.include`; add `apps/docs/dist`, `apps/docs/.astro`, and the generated
     reference directory to `files.ignore`.
  4. `apps/docs/project.json` — **required.** Nx's `@nx/js/typescript` plugin infers
     `build`/`typecheck` from the presence of `tsconfig.build.json`, which an Astro app
     will not have, so Nx will infer nothing. Declare `build`, `dev`, and `typecheck`
     explicitly with `dependsOn: ["^build"]` so `@burglekitt/gmt` builds first.
- Add root scripts `docs:dev` and `docs:build`.
- **Never hardcode a version number in the site.** Generate a version map from
  `packages/*/package.json` in a `prebuild`/`predev` step, so the docs cannot ship a
  stale version badge. `scripts/sync-intent-version.mjs` is the existing precedent for
  this shape of script — follow it rather than inventing a new pattern.
- Declare `engines: { "node": ">=22.12.0" }` on `apps/docs` — Astro 7's floor is higher
  than the repo root's `>=20 <25`.
- Add `apps/docs/dist`, `apps/docs/.astro`, and the generated reference directory to
  `.gitignore`.

## Before starting
Re-check that the four integration files have not drifted — read `pnpm-workspace.yaml`,
root `package.json`, `oxlint.config.js`, and `nx.json` directly rather than trusting
this issue's snapshot. In particular the superseded plan said `oxlint.config.ts`; that
file does not exist and never did.

**Gate — resolve here, not later:** `apps/docs` must NOT extend `tsconfig.base.json`.
The base config sets `composite: true`, `emitDeclarationOnly: true`, `module: nodenext`,
and `customConditions: ["@burglekitt/source"]`, all of which are wrong for an Astro app.
Extend `astro/tsconfigs/strict` instead. If this fights the repo's setup in some way not
anticipated here, fix it in this story before anything is built on top.

Also check `.github/workflows/ci.yml`: it classifies changes as `gmt_changed` /
`non_gmt_changed` by grepping `^packages/gmt/`. Changes under `apps/` currently land in
`non_gmt_changed` and will run the non-GMT test job. Confirm that is the intent or add
an explicit branch — do not leave it accidental.

## Definition of done
- `pnpm install` resolves with `apps/docs` present.
- `pnpm nx show projects` lists `docs`.
- `pnpm docs:dev` serves a site with a working landing page and two readable content
  pages — real content from `packages/gmt/README.md`, not lorem ipsum.
- `pnpm docs:build` produces static output.
- `pnpm nx run-many -t lint typecheck build` is green across the monorepo.
```

---

### A2 — Deploy

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
A2 Deploy apps/docs to GitHub Pages via GitHub Actions
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group A, item A2.
Depends on A1.

## Gap
No deployment pipeline exists. `.github/workflows/` has only `ci.yml` and `publish.yml`;
nothing deploys anything anywhere.

## Why this is story 2 and not story 13
This is deliberately done before any bulk content. Once it lands, every subsequent
story is verifiable on a live URL rather than a dev server. The superseded plan put
deploy last (story F2 of 15), which meant nothing was ever seen in its real environment
until the very end. Two stories' worth of cost buys the fastest feedback loop available.

## Scope
- A GitHub Actions workflow deploying `apps/docs` to GitHub Pages on push to `main`,
  static output only.
- Match `ci.yml`'s existing conventions rather than introducing an unrelated pattern:
  `pnpm/action-setup@v4` pinned to `10.32.1`, `actions/setup-node@v4` with
  `cache: pnpm`, `pnpm install --frozen-lockfile`, Nx for the build.
- Build order matters: `@burglekitt/gmt` must be built before `apps/docs`. A1's
  `project.json` `dependsOn: ["^build"]` should handle this — verify it actually does
  in CI, where the Nx cache is cold.
- Set Astro's `site` and `base` config correctly for the Pages URL. Getting `base`
  wrong is the classic Pages failure and it breaks every internal link at once.
- Confirm Pagefind search works in the deployed build — it is part of the Starlight
  production build and does not run in dev, so this is the first place it can be tested.

## Before starting
Confirm whether GitHub Pages is enabled for this repo, and whether it is set to
"GitHub Actions" as the source rather than a branch. That is a one-time manual step in
repo settings, outside the workflow file, and it will silently no-op the deploy if
missed.

## Definition of done
- Push to `main` produces a live, reachable site.
- Every internal link resolves — click through all pages, since `base` misconfiguration
  breaks them uniformly and is easy to miss on the landing page alone.
- Pagefind search returns results on the deployed site.
- The workflow does not run on pull requests from forks with write permissions.
```

---

### A3 — Reference generator

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
A3 Generate one MDX reference page per gmt function from JSDoc
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group A, item A3.
Depends on A2 (so output is immediately visible on the live site).

## Gap
~424 public functions with 1,514 `@example` lines and 97.9% JSDoc coverage, and no way
to read any of it except by opening source files on GitHub. This story is the single
highest-value piece of work in the epic — it converts existing, already-written,
already-accurate documentation into a browsable site.

## Scope
- `apps/docs/scripts/build-reference.ts` walks `packages/gmt/src/**/*.ts` using the
  **TypeScript compiler API** — not regex — and extracts per function: namespace,
  module, name, full signature, description, behavior bullets, `@param`, `@returns`,
  and every `@example` as a `{ call, result, note }` triple.
- Emit one MDX page per exported function into
  `src/content/docs/reference/<namespace>/<module>/<fnName>.mdx`, plus a module index
  page per directory.
- Sidebar via Starlight's `autogenerate: { directory: 'reference' }` — the `src/` tree
  is already a correct taxonomy (namespace → module → function), so nav is free.
- The same run emits two further artifacts, making three consumers of one extraction:
  - `gmt-corpus.json` — the same content as retrieval chunks, each carrying the URL of
    the page it came from. Group C retrieves from this.
  - A **route manifest** — the set of every URL this run generated. C3 uses it to
    validate links the model emits, so a hallucinated citation degrades to plain text
    instead of a 404. This is cheap here because the generator already knows every route
    it produced; see `context/dox/overview.md` §2 "Citation integrity". Emit it as a
    typed module (a `ReadonlySet<string>`), not raw JSON, so the client gets type safety
    for free.
- Building the site, the corpus, and the route manifest from one extraction is what
  guarantees they cannot drift.
- Generated MDX is gitignored and produced by a prebuild step wired into the `build`
  target.
- **Ship a stub for the generated modules.** The corpus and route manifest are
  gitignored, so anything importing them fails on a clean checkout — including tests in
  CI before the build runs. Commit a stub (empty corpus, empty route set) and alias it in
  the Vitest config, so tests run with no build step. Borrowed from the sibling repo's
  setup; see overview.md §2 "Reviewed prior art".
- A Vitest test asserts the function and example counts, so adding a `gmt` function
  without re-extracting fails CI. Derive the counts from source; do not hardcode a
  snapshot — `context/roadmap/` is actively adding functions.
- Link each page to its GitHub source path. `packages/gmt/tsconfig.build.json` sets
  `declarationMap: false`, so there are no declaration maps to drive this; the
  generator knows the source path anyway.

## The critical finding — handle this first
The `@example` format in this codebase is **non-standard**. Every example is a single
inline line:

    @example startOfZoned("2024-02-29T12:34:56+00:00[UTC]", "month") // "2024-02-01T00:00:00+00:00[UTC]"

...optionally with a trailing parenthetical explanation after the result. It is never a
fenced code block.

**This is the specific reason TypeDoc is the wrong tool and must not be used here.**
TypeDoc and any TSDoc-spec tool treat `@example` content as a code block, which would
mangle the call/result pairing 1,514 times. Split on the trailing ` // ` into a call and
a result, preserve any parenthetical note, and render deliberately — a fenced block with
the result as an output comment, or a two-column table.

Related: there are **zero** `@category`, `@see`, `{@link}`, `@throws`, and `@since` tags
anywhere in `src/`. Nothing can be derived from tags; taxonomy comes from the directory
tree only.

## Before starting
1. Read `context/jsdoc-standards.md` for the exact required JSDoc shape.
2. Read `packages/gmt/src/zoned/calculate/startOfZoned.ts` in full **before writing the
   parser**. It has the heaviest JSDoc in the codebase — an options object, multi-clause
   bullets with embedded bold and backticks, and five annotated examples with
   parenthetical explanations after the `// result`. Build the parser against that file
   first. If it handles `startOfZoned`, it handles everything.
3. Re-verify the counts. ~424 functions and 1,514 examples is true as of 2026-08-21, but
   Story Group J of `context/roadmap/` is in flight and these numbers move.
4. Note the 9 files with no JSDoc block: the 7 `src/regex/*.ts` files (which use `//`
   line comments above each exported RegExp instead — they need their own handling, not
   a skip), plus `unix/format/formatUnix.ts` and `utc/format/formatUtc.ts`, which are
   genuinely undocumented. Decide whether to emit a stub page or fix the source; do not
   let them silently vanish from the site.

## Decision required in this story
The six `packages/gmt/src/*/README.md` files are flat function-name indexes with no
signatures and no examples. This generated site fully supersedes them.

Verified 2026-08-21: `packages/gmt/package.json` sets
`"files": ["dist", "LICENSE", "skills"]`, and the build is plain `tsc`, which does not
copy `.md` into `dist`. **These READMEs do not ship in the npm tarball** — they exist
only on GitHub. That makes replacing them with short stubs pointing at the site the
low-cost option, since no published consumer reads them.

**Decide deliberately and record the decision here.** Either way, note that
`.agents/skills/update-readme` maintains these files and would need updating to match,
and that changing them touches `packages/gmt` and so needs a changeset. Do not leave
them to silently rot.

## Definition of done
- Every currently-exported function has a generated page, reachable from the sidebar.
- **The spot-check:** the generated `startOfZoned` page matches
  `packages/gmt/src/zoned/calculate/startOfZoned.ts` line by line — all five examples
  with their parentheticals intact, the options bullet's formatting preserved, the
  signature correct. If that page is right, the generator is right.
- `gmt-corpus.json` is emitted, and every entry's page URL resolves to a real page.
- The route manifest is emitted and its contents exactly equal the set of pages actually
  generated — assert this in the same test, since a manifest that drifts from reality is
  worse than none (it would silently suppress valid links or admit dead ones).
- The generated-module stub is committed and `pnpm nx run docs:test` passes on a clean
  checkout with no prior build.
- The corpus-count Vitest test is in place and fails when a function is added without
  re-extraction (verify by temporarily adding one).
- Searching `addBusinessDays` on the deployed site lands on its page.
- The namespace-README decision is recorded.
```

---

### A4 — Guides

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
A4 Port README Quick Start, DST doc, and skills guides into the docs site
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group A, item A4.
Depends on A3 (so guides can link into the reference).

## Gap
A3 gives the site accuracy — signatures and examples. It does not give it judgment.
Knowing *when* a user needs `Pacific/Chatham` handling is not in a function signature.

The material for this already exists and is good; it is just not reachable.

## Scope
Hand-curated MDX under `src/content/docs/guides/`, ported rather than written:

- **`packages/gmt/README.md`'s Quick Start** — ~930 lines of runnable, annotated
  TypeScript across six sections (Plain arithmetic and comparisons, Durations,
  Intervals, Zoned operations, Formatting, Unix and UTC helpers). Split into topical
  guides. `### Intervals` alone is ~500 lines and should become several pages.
- **`docs/dst-disambiguation.md`** — move in wholesale. It is a genuinely excellent
  139-line conceptual guide that is currently orphaned: linked only from JSDoc, with no
  index and no nav. This story is where it finally gets a home.
- **The 11 domain `packages/gmt/skills/*/SKILL.md` guides** — reshaped into
  task-oriented pages. Their existing structure maps almost 1:1: `## Core Patterns`
  becomes the body, and `## Common Mistakes` (already severity-graded CRITICAL / HIGH /
  MEDIUM, with wrong-vs-right code pairs) becomes a pitfalls section. Do not re-derive
  this content; it is ~3,700 lines and already written.
- Link guides into A3's reference pages and vice versa where natural.

## Before starting
Read `packages/gmt/skills/_artifacts/domain_map.yaml` and `skill_tree.yaml`. They are a
ready-made information architecture for exactly this content — use them for guide
ordering and grouping rather than inventing a structure.

Then read all 11 domain SKILL.md files before drafting. Several contain gotchas written
for precisely this purpose (the `zoned-date-ops` skill's disambiguation/offset traps,
`durations`' `relativeTo` requirement). Reuse, don't rewrite.

Note the two frontmatter shapes in `skills/`: domain skills carry a `sources:` list
mapping to source files (useful for cross-linking to A3's pages), while the seven
maintainer/workflow skills (`pr-contribution`, `issue-creation`, etc.) do not and are
**not** user-facing docs — exclude them.

## Definition of done
- Guides are reachable from the sidebar and cross-link into reference pages.
- `docs/dst-disambiguation.md` is in the nav. Decide whether the top-level file remains
  as the source of truth or the site copy becomes canonical — do not leave two
  diverging copies.
- A reader can answer "how do I schedule a meeting across a DST boundary" from the
  guides alone, without opening a source file.
- No content was re-derived that already existed in README, skills, or `docs/`.
```

---

### A5 — Brand pass

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
A5 Apply gmt palette, typography, and token layer to Starlight
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group A, item A5.
Depends on A4 (real content to style).

## Gap
The site works but looks like stock Starlight. This story is the cheap 80% of visual
identity — palette, typography, tokens — deliberately separated from the expensive 20%
(glass, animated borders, chamfer) which is Story Group D.

## Scope
- A token layer as CSS custom properties: color, spacing, tracking, timing. **No
  literals in component styles.**
- Wire it through Starlight's `customCss` config option, mapping onto Starlight's own
  documented CSS custom properties rather than fighting its cascade.
- The palette from `context/dox/overview.md` §3 "Color": Void `#03080C`, Cyan `#22D3EE`,
  Spring `#4ADE80`, Teal `#0E7490`, Ice `#CFEAF2`, Signal-lost `#F5A524`.
- **Body copy is Ice, not cyan or green.** Saturated blue-green at paragraph length is
  fatiguing and rarely clears contrast. The blue/green identity is carried by borders,
  headings, labels, and live values — not by prose.
- Typography per overview.md §3: JetBrains Mono for body and code, a display face
  (Chakra Petch / Michroma / Orbitron) for headings and labels only. **Long-form content
  is never set in the display face.** Self-host the subsets — no runtime CDN request.
- Reserve Signal-lost amber exclusively for the sentinel treatment (B1 will use it). Its
  rarity is what makes it communicate; spending it on general warnings destroys that.

## Explicitly out of scope
No glass panels, no `backdrop-filter`, no animated borders, no chamfered corners, no
boot sequence. Those are D1/D2, applied later over pages that already work. Read
overview.md §3's opening — "maximal chrome, disciplined content surface" — and note this
story is entirely the *content surface* half.

## Before starting
Read `context/dox/overview.md` §3, specifically the "Color" and "Typography"
subsections, which are this story's spec.

## Definition of done
- Body text clears **7:1 contrast**, measured against real rendered pages, not flat
  swatches.
- Self-hosted fonts — confirm via devtools Network that no request goes to
  `fonts.googleapis.com` or `fonts.gstatic.com` at runtime.
- **Keyboard-only pass with the mouse unplugged.** Starlight's baseline is good; capture
  that it still is, because this is the "before" measurement that D1 will be checked
  against.
- No color literal appears in any component style — every one goes through a token.
- Light/dark handling is coherent (Starlight ships both; decide deliberately whether
  this design supports a light mode or commits to dark, and make that explicit).
```
