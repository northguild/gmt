# Issue #130–#134 — Ship the site, its AI surface, and the scenario layer

**Re-audited 2026-08-26; counts and two technical claims corrected from the 2026-08-21
draft — see overview.md §1 for the full list.** These five issues now carry nine
sub-stories across three tiers: `DOX-A1`/`DOX-A2`/`DOX-A3a` are Tier 0 (the MVP), `DOX-A5`/
`DOX-A4a`/`DOX-A3b` are Tier 1, and `DOX-A4b`–`d` are Tier 5 (the real-world scenario
layer). **No new GitHub issues** — `DOX-A3b` folds into #132 alongside `DOX-A3a`, and
`DOX-A4b`–`d` fold into #133 alongside `DOX-A4a`. See tracker.md for the full mapping and
the note on issues that now span more than one tier.

After Tier 0's three stories (`DOX-A1`, `DOX-A2`, `DOX-A3a`), `@northguild/gmt` has a real,
deployed, searchable, linkable documentation site covering all 504 functions. Nothing in
Tier 1 onward is required for that to be true, and any of it can be dropped or reordered
without losing the docs.

## Definition of done — binding for every story in this file

- `pnpm nx run-many -t lint test typecheck build` stays green, **including the 20-cell
  GMT timezone matrix**. `apps/dox` must not perturb `packages/gmt`.
- No changeset is needed — `apps/dox` is private and unpublished. The one exception is
  a story that also modifies `packages/gmt` (see `DOX-A3a`'s namespace-README decision),
  which follows the normal repo convention.
- No dependency on Octane or any `@octanejs/*` package. See overview.md §1 for why.

---

### DOX-A1 — Workspace skeleton + first pages

**GitHub Issue:** #130 — see tracker.md\_

**Title:**

```
DOX-A1 Create apps/dox (Astro + Starlight) and wire pnpm/nx/oxlint
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 0, item DOX-A1.

## Gap
`apps/` does not exist in this monorepo and is not a workspace glob. `@northguild/gmt`
has 504 public functions and no documentation site — the only discovery path is
`packages/gmt/README.md`, whose "API Surface" section just links to GitHub tree URLs.

## Scope
- Create `apps/dox` as `@gmt/docs` (private, `"type": "module"`), depending on
  `@northguild/gmt` via `workspace:*`.
- Install `astro@7.2.7` and `@astrojs/starlight@0.41.9` (Starlight peers on
  `astro ^7.0.2` **and `@astrojs/markdown-remark ^7.2.0`** — verify both).
- `src/content.config.ts` defining the `docs` collection with Starlight's
  `docsLoader()` and `docsSchema()`.
- Ship real content, not placeholders: a landing page plus two hand-written pages
  (Install, Core Rules), both lifted from `packages/gmt/README.md`'s existing
  `## Install` and `## Core Rules` sections.
- Wire the four easy-to-miss integration files (see `context/dox/overview.md` §4):
  1. `pnpm-workspace.yaml` — add `- 'apps/*'`
  2. root `package.json` — the `"workspaces"` array duplicates the glob; add `apps/*`
  3. `oxlint.config.js` — **note the `.js` extension**. Add `apps/**` to
     `files.include`; add `apps/dox/dist`, `apps/dox/.astro`, and the generated
     reference directory to `files.ignore`.
  4. `apps/dox/project.json` — **required.** Nx's `@nx/js/typescript` plugin infers
     `build`/`typecheck` from the presence of `tsconfig.build.json`, which an Astro app
     will not have, so Nx will infer nothing. Declare `build`, `dev`, and `typecheck`
     explicitly with `dependsOn: ["^build"]` so `@northguild/gmt` builds first.
- Add root scripts `docs:dev` and `docs:build`.
- **Never hardcode a version number in the site.** Generate a version map from
  `packages/*/package.json` in a `prebuild`/`predev` step, so the docs cannot ship a
  stale version badge. `scripts/sync-intent-version.mjs` is the existing precedent for
  this shape of script — follow it rather than inventing a new pattern.
- Declare `engines: { "node": ">=22.12.0" }` on `apps/dox` — Astro 7's floor is higher
  than the repo root's `>=20 <25`.
- Add `apps/dox/dist`, `apps/dox/.astro`, and the generated reference directory to
  `.gitignore`.

## Before starting
**Check the local Node version.** `.nvmrc` declares `24`, but a local shell can easily
be on an older version that predates Astro 7's `>=22.12.0` floor — `nvm use` first, or
`DOX-A1` fails on the very first install.

Re-check that the four integration files have not drifted — read `pnpm-workspace.yaml`,
root `package.json`, `oxlint.config.js`, and `nx.json` directly rather than trusting
this issue's snapshot. In particular the superseded plan said `oxlint.config.ts`; that
file does not exist and never did.

**Gate — resolve here, not later:** `apps/dox` must NOT extend `tsconfig.base.json`.
The base config sets `composite: true`, `emitDeclarationOnly: true`, `module: nodenext`,
and `customConditions: ["@northguild/source"]`, all of which are wrong for an Astro app.
Extend `astro/tsconfigs/strict` instead. If this fights the repo's setup in some way not
anticipated here, fix it in this story before anything is built on top.

Also check `.github/workflows/ci.yml`: it classifies changes as `gmt_changed` /
`non_gmt_changed` by grepping `^packages/gmt/`. Changes under `apps/` currently land in
`non_gmt_changed` and will run the non-GMT test job. Confirm that is the intent or add
an explicit branch — do not leave it accidental.

## Definition of done
- `pnpm install` resolves with `apps/dox` present.
- `pnpm nx show projects` lists `docs`.
- `pnpm docs:dev` serves a site with a working landing page and two readable content
  pages — real content from `packages/gmt/README.md`, not lorem ipsum.
- `pnpm docs:build` produces static output.
- `pnpm nx run-many -t lint typecheck build` is green across the monorepo.
```

**Corrections found while implementing (2026-08-26).** Five claims above did not survive
contact with the repo. Full detail and evidence in `.agents/dox/tier0-infra.md`; that pack
is authoritative where it disagrees with this issue.

| Claim above                                           | Reality                                                                                                                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "`nvm use` first"                                     | The toolchain is **`fnm`**, and `fnm use` alone is a **silent no-op** in a non-interactive shell — it prints success and changes nothing. Use `eval "$(fnm env)" && fnm use && …`                 |
| Starlight peers on `@astrojs/markdown-remark ^7.2.0`  | That peer is **optional** (`peerDependenciesMeta.optional: true`). Astro 7 ships `@astrojs/markdown-satteri` instead. **Do not declare it**                                                       |
| Version map in a `prebuild`/`predev` step             | pnpm 10 defaults `enable-pre-post-scripts` to false and there is no `.npmrc`, so those hooks **never fire**. Chained with `&&` and wired to an Nx `generate` target instead                       |
| `oxlint.config.js` — add `apps/**` to `files.include` | That config is **never loaded** (`.js` is not in oxlint's discovery list), so the edit is inert. Landed anyway to document intent; the real mechanism is an explicit `docs:lint` target           |
| —                                                     | **New:** `@astrojs/mdx@7.0.8` imports `satteri` without declaring it, and two satteri versions in the tree stop pnpm hoisting it. Fixed with a `packageExtensions` entry in `pnpm-workspace.yaml` |

Also landed beyond the scope above, because the story could not be verified without them:
an `apps/**` override in `.oxfmtrc.json` (its `overrides` are an allow-list, so `pnpm
format` skipped the app), and a `docs_changed` output plus an `apps`-aware artifact
collector in `ci.yml`.

**Decision recorded:** the generated version map is **gitignored, not stubbed** —
deliberately breaking symmetry with `DOX-A3a`'s committed-stub pattern. A stub would render
a _wrong_ version badge, which is the exact failure this story exists to prevent, and
`DOX-A1` ships no tests that would need it to resolve on a clean checkout.

---

### DOX-A2 — Deploy

**GitHub Issue:** #131 — see tracker.md\_

**Title:**

```
DOX-A2 Deploy apps/dox to Cloudflare Workers via GitHub Actions
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 0, item DOX-A2.
Depends on DOX-A1.

## Gap
No deployment pipeline exists. `.github/workflows/` has only `ci.yml` and `publish.yml`;
nothing deploys anything anywhere.

## Rewritten 2026-08-26: Cloudflare, not GitHub Pages
The 2026-08-21 draft specified GitHub Pages. Verified on 2026-08-26 that **Pages is not
enabled on this repo** (`gh api repos/northguild/gmt/pages` returns 404), so there is
nothing to migrate away from — this rewrite costs nothing.

More importantly, a single Cloudflare Worker is the right target regardless: with an
`assets` binding it serves the static site today, and once Tier 6 exists it handles
`/api/*` in the **same** deployment, same-origin, with no CORS allowlist and no second
pipeline. See `context/dox/overview.md` §2 "Hosting" for the full reasoning. Deploying to
Cloudflare now, even though nothing needs `/api/*` yet, avoids a second migration later.

## Why this is story 2 and not story 13
This is deliberately done before any bulk content. Once it lands, every subsequent
story is verifiable on a live URL rather than a dev server. The superseded plan put
deploy last (story F2 of 15), which meant nothing was ever seen in its real environment
until the very end. Two stories' worth of cost buys the fastest feedback loop available.

## Scope
- `apps/dox/wrangler.jsonc` with an `assets` binding: `directory: "./dist"`,
  `binding: "ASSETS"`, `not_found_handling: "404-page"`. **No `main` is needed at this
  tier** — this is an assets-only Worker until Tier 6 adds `/api/*`.
- A GitHub Actions workflow deploying via `cloudflare/wrangler-action`, matching
  `ci.yml`'s existing conventions rather than introducing an unrelated pattern:
  `pnpm/action-setup@v4` pinned to `10.32.1`, `actions/setup-node@v4` with
  `cache: pnpm`, `pnpm install --frozen-lockfile`, Nx for the build.
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions repo secrets.
- Build order matters: `@northguild/gmt` must be built before `apps/dox`. DOX-A1's
  `project.json` `dependsOn: ["^build"]` should handle this — verify it actually does
  in CI, where the Nx cache is cold.
- Confirm Pagefind search works in the deployed build — it is part of the Starlight
  production build and does not run in dev, so this is the first place it can be tested.

## Before starting
Confirm Cloudflare account access and that a project/token can be provisioned. This is
now a hard dependency for shipping the MVP at all, not merely for the eventual chat —
see overview.md §7.

## Definition of done
- Push to `main` produces a live, reachable site.
- Every internal link resolves — click through all pages.
- Pagefind search returns results on the deployed site.
- The workflow does not run on pull requests from forks with write permissions.
```

**Corrections found while implementing (2026-08-26).** Full detail and evidence in
`.agents/dox/tier0-infra.md`; that pack is authoritative where it disagrees with this
issue.

| Claim above                                                 | Reality                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assets` binding: `directory`, `binding: "ASSETS"`, `not_found_handling`, no `main` | Cloudflare's own docs: *"Omit the ASSETS binding if the Worker does not have a main script."* A binding with nothing to consume it is inert. Shipped `wrangler.jsonc` has **no `binding`** — it returns in Tier 6 alongside the `main` script that reads it |
| (implicit) `nx run docs:build` / project named `docs`        | The Nx project has been named **`dox`** since `DOX-A1`, not `docs`. Every command in the deploy workflow uses `dox`. `dox-tester.md`'s Tier-0 gate still says `docs` — flagged there, not fixed as part of this story         |
| —                                                             | **New:** adding `wrangler` as a devDependency required a new `pnpm-workspace.yaml` `allowBuilds` entry (`workerd: true`) — `workerd`'s own `package.json` declares a `postinstall` pnpm blocks by default. Lockfile regenerated in the same commit |

**Decisions recorded:** Worker name `gmt-dox`, deployed to the default `*.workers.dev`
subdomain — no custom domain at this tier. Deploy triggers on every push to `main` (no
path filtering); the workflow carries no `pull_request` trigger at all, which is the
mechanism satisfying the "does not run on PRs from forks" line structurally rather than
via a runtime guard. `astro.config.mjs`'s placeholder `SITE` constant is left as-is
pending a fast-follow commit once the real `workers.dev` subdomain is confirmed
post-provisioning.

**Status at end of story:** workflow, `wrangler.jsonc`, and supporting config are built
and verified everywhere possible without live Cloudflare credentials (cold-cache build,
`wrangler deploy --dry-run`, YAML/schema validation). `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` are not yet provisioned, so the three DoD lines requiring a live
deployed site remain unverified until the user completes Cloudflare provisioning and a
push to `main` triggers the first real deploy.

---

### DOX-A3a — Reference generator

**GitHub Issue:** #132 — see tracker.md\_

**Title:**

```
DOX-A3a Generate one MDX reference page per gmt function from JSDoc
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 0, item DOX-A3a.
Depends on DOX-A2 (so output is immediately visible on the live site).

## Gap
504 public functions with 1,860 `@example` lines and 96.5% JSDoc coverage, and no way
to read any of it except by opening source files on GitHub. This story is the single
highest-value piece of work in the epic — it converts existing, already-written,
already-accurate documentation into a browsable site.

## Scope
- `apps/dox/scripts/build-reference.ts` walks `packages/gmt/src/**/*.ts` using the
  **TypeScript compiler API** — not regex — and extracts per function: namespace,
  module, name, full signature, description, behavior bullets, `@param`, `@returns`,
  and every `@example` as a `{ call, result, note }` triple.
- Emit one MDX page per exported function into
  `src/content/docs/reference/<namespace>/<module>/<fnName>.mdx`, plus a module index
  page per directory.
- Sidebar via Starlight's `autogenerate: { directory: 'reference' }` — the `src/` tree
  is already a correct taxonomy (namespace → module → function), so nav is free.
- The same run emits three further artifacts, making four consumers of one extraction:
  - `gmt-corpus.json` — the same content as retrieval chunks, each carrying the URL of
    the page it came from. `DOX-A3b`'s `llms-full.txt` is built from this, and Tier 6's
    retrieval reads from it if that tier is reached.
  - A **route manifest** — the set of every URL this run generated. Consumed here by a
    build-time link check, by `DOX-A3b`'s AI surface, and defensively by `DOX-C3a` if
    Tier 6 is reached, so a hallucinated citation degrades to plain text instead of a
    404. This is cheap here because the generator already knows every route it
    produced; see `context/dox/overview.md` §2 "Citation integrity". Emit it as a typed
    module (a `ReadonlySet<string>`), not raw JSON, so the client gets type safety for
    free.
  - The parsed `{ call, result, note }` triples themselves as widget seed data —
    `DOX-B2a` embeds a playground into every one seeded from this.
- Building the site, the corpus, the manifest, and the widget seeds from one extraction
  is what guarantees they cannot drift.
- Generated MDX is gitignored and produced by a prebuild step wired into the `build`
  target.
- **Ship a stub for the generated modules.** The corpus and route manifest are
  gitignored, so anything importing them fails on a clean checkout — including tests in
  CI before the build runs. Commit a stub (empty corpus, empty route set) and alias it in
  the Vitest config, so tests run with no build step. Borrowed from the sibling repo's
  setup; see overview.md §2 "Reviewed prior art".
- A Vitest test asserts the function and example counts, so adding a `gmt` function
  without re-extracting fails CI. Derive the counts from source; do not hardcode a
  snapshot — the count still drifts with ordinary npm releases even though
  `context/roadmap/` itself is now complete through v1.14.0.
- Link each page to its GitHub source path. `packages/gmt/tsconfig.build.json` sets
  `declarationMap: false`, so there are no declaration maps to drive this; the
  generator knows the source path anyway.

## The real risk in this story — read this before writing the parser
The 2026-08-21 draft named the `@example` line format as the epic's biggest generator
risk. **Measured on 2026-08-26 across all 1,860 examples, that risk does not hold up:**
1,859 match one shape exactly — `@example fnName(args) // result (optional
parenthetical)`, split on `/\s+\/\/\s/` because `context/jsdoc-standards.md` shows
padding-aligned results — and zero contain a second ` // `. Exactly one example is
multi-line: `getDstTransitions` (`packages/gmt/src/zoned/get/getDstTransitions.ts:34-39`),
whose array result continues on following ` * // ` lines. **This parser is roughly
fifteen lines and one named edge case, not the epic's hardest problem.**

TypeDoc is still the wrong tool — it would treat `@example` as a fenced block regardless
— but the reason to avoid it that actually matters is that `src/` has **zero**
`@category`, `@see`, `@throws`, and `@since` tags (and only 9 `@link` occurrences), so
there is **no cross-link graph to extract from tags at all**. Taxonomy and cross-linking
must come from the directory tree (already correct) and from type references in each
signature.

**The actual hard work is signatures, options objects, and the 42 public types:**
`startOfZoned`'s `@param options` is a single ~400-character prose line covering four
option keys with embedded bold and backticks — turning that into a linked parameter
table is the high-value, high-risk part of this story. The 42 public types (18 in
`src/types/`, 24 co-located, e.g. `DstTransition` and the 15 `Format*Options`
interfaces) each need a page, or every signature renders as a wall of dead identifiers.

Handle two named edge cases deliberately, not as afterthoughts:
- `getDstTransitions`'s multi-line example, above.
- `packages/gmt/src/plain/calculate/weekOfYear.ts` — the **only** file in the library
  exporting two functions, so "one page per file" holds 503/504 times, not 504/504.

## Before starting
1. Read `context/jsdoc-standards.md` for the exact required JSDoc shape.
2. Read `packages/gmt/src/zoned/calculate/startOfZoned.ts` in full **before writing the
   parser**. It has the heaviest JSDoc in the codebase — an options object, multi-clause
   bullets with embedded bold and backticks, and five annotated examples with
   parenthetical explanations after the `// result`. Build the parser against that file
   first. If it handles `startOfZoned`, it handles the `@example` line format
   everywhere; the options table is the part that still needs real design work.
3. Re-verify the counts. 504 functions and 1,860 examples is true as of 2026-08-26, and
   `context/roadmap/` is now complete through v1.14.0 — but ordinary npm releases
   continue, so re-derive rather than trust this number.
4. Note the 18 files with no JSDoc block: the 13 `src/regex/*.ts` files (which use `//`
   line comments above each exported `RegExp` instead — they need their own handling,
   not a skip), plus `utc/calculate/startOrEndOfUtc.ts`, `utc/format/formatUtc.ts`,
   `unix/calculate/startOrEndOfUnix.ts`, `unix/interval/resolveUnixIntervalPair.ts`, and
   `unix/format/formatUnix.ts`, which are genuinely undocumented. Decide whether to emit
   a stub page or fix the source; do not let them silently vanish from the site.

## Decision required in this story
The six `packages/gmt/src/*/README.md` files are flat function-name indexes with no
signatures and no examples. This generated site fully supersedes them.

Verified 2026-08-26: `packages/gmt/package.json` sets
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
  with their parentheticals intact, the options bullet rendered as a real parameter
  table with types linked, the signature correct. If that page is right, the generator
  is right.
- `getDstTransitions`'s multi-line example renders correctly, and both of
  `weekOfYear.ts`'s exports get their own page.
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

### DOX-A5 — Brand pass

**GitHub Issue:** #134 — see tracker.md\_

**Title:**

```
DOX-A5 Apply gmt palette, typography, and token layer to Starlight
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 1, item DOX-A5.
Depends on DOX-A3a (real content to style).

## Moved earlier in the 2026-08-26 rewrite
The 2026-08-21 draft placed this after DOX-A4 (guides). It now runs **before** DOX-A4a and
`DOX-A3b`, and before any of Tier 2's widgets. Every widget built in Tier 2 onward is
styled from these tokens — building them against unstyled Starlight first would mean
restyling every one of them twice.

## Gap
The site works but looks like stock Starlight. This story is the cheap 80% of visual
identity — palette, typography, tokens — deliberately separated from the expensive 20%
(glass, animated borders, chamfer) which is Tier 3.

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
- Reserve Signal-lost amber exclusively for the sentinel treatment (`DOX-B1a` will use
  it, and so will every Tier 2 widget per overview.md §3 "Widget chrome"). Its rarity is
  what makes it communicate; spending it on general warnings destroys that.

## Explicitly out of scope
No glass panels, no `backdrop-filter`, no animated borders, no chamfered corners, no
boot sequence. Those are `DOX-D1`/`DOX-D2` in Tier 3, applied later over pages and
widgets that already work. Read overview.md §3's opening — "maximal chrome, disciplined
content surface" — and note this story is entirely the *content surface* half.

## Before starting
Read `context/dox/overview.md` §3, specifically the "Color", "Typography", and "Widget
chrome" subsections. The last of these did not exist in the 2026-08-21 draft and covers
the sentinel/live-value rules that Tier 2's widgets depend on this story delivering
correctly.

## Definition of done
- Body text clears **7:1 contrast**, measured against real rendered pages, not flat
  swatches.
- Self-hosted fonts — confirm via devtools Network that no request goes to
  `fonts.googleapis.com` or `fonts.gstatic.com` at runtime.
- **Keyboard-only pass with the mouse unplugged.** Starlight's baseline is good; capture
  that it still is, because this is the "before" measurement that `DOX-D1` will be
  checked against.
- No color literal appears in any component style — every one goes through a token.
- Light/dark handling is coherent (Starlight ships both; decide deliberately whether
  this design supports a light mode or commits to dark, and make that explicit).
```

---

### DOX-A4a — Guides

**GitHub Issue:** #133 — see tracker.md\_

**Title:**

```
DOX-A4a Port README Quick Start, DST doc, and skills Core Patterns into the docs site
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 1, item DOX-A4a.
Depends on DOX-A3a (so guides can link into the reference) and DOX-A5 (tokens to style
against).

## Split from DOX-A4 in the 2026-08-26 rewrite
The original DOX-A4 covered guides *and* each SKILL.md's "Common Mistakes" pitfalls in
one story. They are now separate: this story ports the Core Patterns / Quick Start
content; `DOX-A4c` in Tier 5 ports the 63 severity-graded mistakes with live proof. Both
land on issue #133.

## Gap
DOX-A3a gives the site accuracy — signatures and examples. It does not give it judgment.
Knowing *when* a user needs `Pacific/Chatham` handling is not in a function signature.

The material for this already exists and is good; it is just not reachable.

## Scope
Hand-curated MDX under `src/content/docs/guides/`, ported rather than written:

- **`packages/gmt/README.md`'s Quick Start** — most of its 1,633 lines are runnable,
  annotated TypeScript across six sections (Plain arithmetic and comparisons, Durations,
  Intervals, Zoned operations, Formatting, Unix and UTC helpers). Split into topical
  guides; the Intervals section alone should become several pages.
- **`docs/dst-disambiguation.md`** — move in wholesale. It is a genuinely excellent
  139-line conceptual guide that is currently orphaned: linked only from JSDoc, with no
  index and no nav. This story is where it finally gets a home.
- **The 11 domain `packages/gmt/skills/*/SKILL.md` guides' Core Patterns sections** —
  reshaped into task-oriented pages. Do not port their "Common Mistakes" sections here
  — that content, already severity-graded CRITICAL / HIGH / MEDIUM with wrong-vs-right
  code pairs, is `DOX-A4c`'s job in Tier 5, where it gets live proof via `DOX-B1a`'s
  playground rather than static code blocks.
- Link guides into DOX-A3a's reference pages and vice versa where natural.

## Before starting
Read `packages/gmt/skills/_artifacts/domain_map.yaml` and `skill_tree.yaml`. They are a
ready-made information architecture for exactly this content — use them for guide
ordering and grouping rather than inventing a structure.

Then read all 11 domain SKILL.md files before drafting. Several contain gotchas written
for precisely this purpose (the `zoned-date-ops` skill's disambiguation/offset traps,
`durations`' `relativeTo` requirement). Reuse, don't rewrite.

Note the two frontmatter shapes in `skills/`: domain skills carry a `sources:` list
mapping to source files (useful for cross-linking to DOX-A3a's pages), while the seven
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

### DOX-A3b — AI surface (`llms.txt`)

**GitHub Issue:** #132 — see tracker.md\_ (folds into the same issue as `DOX-A3a`; the
issue stays open until this sub-story also lands)

**Title:**

```
DOX-A3b Emit llms.txt, llms-full.txt, and per-page raw markdown from the corpus
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 1, item DOX-A3b. New in the
2026-08-26 rewrite.
Depends on DOX-A3a (the corpus and route manifest) and DOX-A5 (so the "copy as markdown"
affordance has somewhere to live in the token layer).

## Gap
`llms.txt`/`llms-full.txt` are absent from every story in the 2026-08-21 draft. They cost
roughly a day given DOX-A3a's corpus already exists, and they make every model the reader
already has open — not only a purpose-built chatbot — answer correctly about GMT. This
library already ships `skills/` for agents; a meaningful fraction of its audience is
machine, and this is the cheapest possible extension of that audience to the docs site.

## Scope
- `llms.txt` — a nav index in the llms.txt convention, generated from the route
  manifest and page titles/descriptions DOX-A3a already extracted.
- `llms-full.txt` — the full corpus as plain text, generated from `gmt-corpus.json`.
- A raw `.md` route alongside every rendered reference and guide page (e.g.
  `/reference/zoned/calculate/startOfZoned.md`), and a "copy as markdown" affordance on
  each page using DOX-A5's tokens.
- Evaluate `starlight-llms-txt@0.11.0` against emitting directly from DOX-A3a's
  already-parsed corpus. The plugin derives its output from rendered MDX, which would
  duplicate parsing work the generator already did and risks a second source of drift;
  emitting directly from the corpus is probably the better call here, but confirm rather
  than assume.
- Every URL this story emits must exist in DOX-A3a's route manifest — reuse it rather
  than reconstructing the page list.

## Before starting
Confirm DOX-A3a's corpus carries everything needed (title, description, full body text)
for a plain-text nav index and full corpus dump without re-walking `packages/gmt/src`.

## Definition of done
- `llms.txt` is reachable at the site root and lists every generated page.
- `llms-full.txt` contains the full corpus as plain text.
- Every page has a working raw `.md` route and a working "copy as markdown" control.
- No URL in either file is absent from DOX-A3a's route manifest.
```

---

### DOX-A4b — Scenario template + first three scenarios

**GitHub Issue:** #133 — see tracker.md\_ (folds into the same issue as `DOX-A4a`)

**Title:**

```
DOX-A4b Build the real-world scenario page template and ship three scenarios
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 5, item DOX-A4b. New in the
2026-08-26 rewrite, added by explicit user request for a mentor/teacher layer.
Depends on DOX-B1a (the playground the "live widget" step in each scenario runs).

## Gap
DOX-A4a's guides are organized by API area (Plain arithmetic, Durations, …). A reader
who has a real task — "I need to schedule a recurring meeting across a DST boundary" —
has to assemble the answer from several guides themselves. No page in the plan currently
teaches by demonstrating failure, which is the most persuasive way to teach a
correctness library.

## Scope
- A fixed page template with five parts, in order: **the naive approach** (plausible
  code using `Date` or an obvious-but-wrong `gmt` call) → **a live widget showing it
  break** (DOX-B1a's playground, seeded with an input that exposes the bug) → **why**
  (a short, specific explanation, not a restatement of the bug) → **the gmt approach**
  (the correct code) → **the same widget working** (a second playground instance,
  correct output).
- Ship the template plus three scenarios chosen from: recurring meetings across a DST
  boundary; storing a birthday (plain date vs. instant); "posted 3 hours ago"; booking
  availability windows; a flight crossing the date line; monthly billing without drift;
  the `Pacific/Chatham` +12:45 case the CI matrix already exercises.

## Before starting
Read `packages/gmt/skills/_artifacts/domain_map.yaml` for task-shaped framing already
written for a related purpose, and the 11 domain `SKILL.md` files' Common Mistakes
sections (see `DOX-A4c`) for scenarios that overlap — do not develop the same example
twice in two different tiers.

## Definition of done
- The template renders correctly for all three shipped scenarios.
- Each scenario's "broken" widget genuinely reproduces the failure it claims to, and the
  "fixed" widget genuinely does not.
- A reader can complete a scenario start to finish without opening a source file or the
  browser console.
```

---

### DOX-A4c — Ported pitfalls

**GitHub Issue:** #133 — see tracker.md\_ (folds into the same issue as `DOX-A4a`)

**Title:**

```
DOX-A4c Port severity-graded SKILL.md mistakes into pitfall pages with live proof
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 5, item DOX-A4c. New in the
2026-08-26 rewrite.
Depends on DOX-A4a (guides to cross-link into) and DOX-B1a (the playground providing live
proof).

## Gap
11 domain `SKILL.md` files already contain **63 severity-graded mistakes** (1 CRITICAL,
23 HIGH, 39 MEDIUM), each written as a wrong-vs-right code pair. None of it is on the
docs site. This is explicitly **not a writing project** — the content exists in almost
exactly the shape a pitfall page needs; the work is porting it and adding live proof.

## Scope
- One pitfall page (or a grouped page per domain, decide deliberately) per graded
  mistake, rendering the existing wrong-vs-right pair with DOX-B1a's playground proving
  the "wrong" code produces the documented bad output and the "right" code does not.
- Preserve the severity grading visually — CRITICAL/HIGH/MEDIUM should be
  immediately scannable, not buried in prose.
- Cross-link every pitfall page from the reference pages (DOX-A3a) whose functions it
  concerns, and from the relevant guide (DOX-A4a).

## Before starting
Read all 11 domain `SKILL.md` files' Common Mistakes sections in full before starting —
do not sample a few and extrapolate a template that does not fit the rest. Note the
severity counts (1 CRITICAL, 23 HIGH, 39 MEDIUM) to confirm none are dropped silently.

## Definition of done
- All 63 mistakes are represented on the site with live proof, not static code alone.
- Severity is visually scannable across the full set.
- Every pitfall page is cross-linked from at least one reference page and one guide.
- No mistake's content was rewritten from scratch where the source already stated it
  clearly — this is a port, not a rewrite.
```

---

### DOX-A4d — Scenario index

**GitHub Issue:** #133 — see tracker.md\_ (folds into the same issue as `DOX-A4a`)

**Title:**

```
DOX-A4d Build a mentor-voiced scenario index driven by domain_map.yaml
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 5, item DOX-A4d. New in the
2026-08-26 rewrite.
Depends on DOX-A4b and DOX-A4c (content to index).

## Gap
504 functions create a discovery problem that neither Pagefind search nor a sidebar
alone solves — a reader who does not yet know a function's name cannot search for it.
`packages/gmt/skills/_artifacts/domain_map.yaml`, reviewed 2026-08-23, is a ready-made
task→function map built for exactly this problem and is currently unused by the site.

## Scope
- A "start here" index page, driven by `domain_map.yaml`, organized by task ("I have X
  and need Y") rather than by namespace or function name.
- Surface DOX-A4b's scenarios and DOX-A4c's pitfalls from this index alongside reference
  and guide links, so it functions as a single mentor-voiced entry point rather than one
  more content type competing with the others.

## Before starting
Read `domain_map.yaml` and `skill_tree.yaml` together — the domain map gives task
groupings, the skill tree gives the finer-grained skill list within each domain.

## Definition of done
- A reader with a task in mind but no function name in mind can reach the right
  reference page, guide, or scenario within two clicks from this index.
- Every domain in `domain_map.yaml` is represented.
```
