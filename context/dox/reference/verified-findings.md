# Verified findings — `context/dox/`

> Extracted from `overview.md` §1 on 2026-09-02. Counts in this file **drift**: every
> `DOX-A3a` run re-derives them from source. The 504 / 1,860 / 42 figures below are
> the 2026-08-26 audit snapshot, not a guarantee.
>
> See also: [overview.md](../overview.md) for architecture, decisions, and the tier
> table.

## Context and the ordering principle

`@northguild/gmt` exposes **504 public functions** — `plain` (223), `zoned` (119),
`unix` (75), `utc` (75), `duration` (12) — plus 22 exported `regex` consts and **42
public types** (18 in `src/types/`, 24 co-located with the functions that take them).
Today the only discovery path is `packages/gmt/README.md`, whose "API Surface" section
just links to GitHub tree URLs.

A library this size with no site is undiscoverable. Someone searching for
`addBusinessDays` finds nothing; someone who wants to send a colleague the DST rules has
nothing to link.

**The ordering principle for this epic: ship the boring, useful thing first.**

**Tier 0 — three stories — produces a real, deployed, searchable, linkable docs site.**
Everything after it is additive on top of a site that already works. No tier blocks the
site from existing, and any tier after Tier 0 can be dropped or reordered without losing
the docs.

This is a direct reversal of the superseded plan, which gated everything on a bespoke
design system and a chat runtime.

**But the ordering principle is not a ceiling.** Tier 0 is deliberately small so that the
ambition above it can be large: an interactive globe, a live widget on every one of the
1,860 examples, a mentor-voiced scenario layer, and a chat that answers by mounting real
widgets rather than printing code blocks. The goal is to beat every competing date-library
documentation site, and §5's tier table is sequenced so that goal is reachable
incrementally rather than all at once.

### The raw material is exceptional and almost entirely un-mined

This is why a docs site here is a **generation** problem, not an authoring problem:

| Source                       | Scale                                         | Value                                                                       |
| ---------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| JSDoc `@example` tags        | **1,860 lines** across 516 impl files         | Rigid, machine-parseable `fn(args) // result` format                        |
| JSDoc coverage               | **498 / 516** public impl files (96.5%)       | Description + bullets + `@param` + `@returns` on nearly everything          |
| `packages/gmt/README.md`     | 1,633 lines                                   | Most of them runnable, annotated examples in 6 topical sections             |
| `packages/gmt/skills/`       | 18 `SKILL.md`, **4,689 lines**                | Core Patterns + **63 severity-graded Common Mistakes**                      |
| `skills/_artifacts/`         | `domain_map.yaml`, `skill_tree.yaml`          | A ready-made information architecture, reviewed 2026-08-23                  |
| `docs/dst-disambiguation.md` | 139 lines                                     | Excellent long-form conceptual guide, currently orphaned                    |
| `src/` directory tree        | namespace → module → function                 | Already a correct nav taxonomy                                              |
| **Interval functions**       | **109** — plain 53, zoned 19, unix 19, utc 18 | Allen's interval algebra, fully implemented and **entirely un-illustrated** |

Two entries in that table are load-bearing for the ambition tier and are easy to skim
past:

- **The 63 severity-graded mistakes** (1 CRITICAL, 23 HIGH, 39 MEDIUM) across 11 domain
  `SKILL.md` files are already written as wrong-vs-right code pairs. The mentor/scenario
  layer (Tier 5) is therefore **not a writing project** — roughly 60% of it exists in
  exactly the shape a scenario page needs. The work is porting it and adding live proof.
- **The 109 interval functions** are the largest completely undocumented-by-example
  surface in the library. A dragged-timeline visualizer over them (Tier 2) is a thing no
  competing date library's docs site has.

### Verified findings that shaped this plan

- **The `@example` format is non-standard, but it is not the generator's risk — the
  missing tag graph is.** Every example is a single inline line —
  `@example fnName(args) // result (optional parenthetical explanation)` — never a fenced
  code block, so TypeDoc and any TSDoc-spec tool would mangle the call/result pairing.
  That still rules TypeDoc out. What it does **not** do is make the parser hard: measured
  across all 1,860 examples on 2026-08-26, **1,859 match that one shape exactly, zero
  contain a second `//`, and exactly one is multi-line** (`getDstTransitions`, whose
  array result continues on following `* //` lines). The parser is roughly fifteen lines
  and one edge case. See "The real generator risk" below for where DOX-A3a's attention
  actually belongs.
- **There are zero `@category`, `@see`, `@throws`, and `@since` tags** in `src/`, and only
  9 `@link` occurrences. **There is effectively no cross-link graph in the source at all.**
  Taxonomy and cross-linking cannot come from tags; they must be synthesized from the
  directory tree (which is fortunately already correct) and from the type references in
  each signature.
- **The exports map forbids per-function imports, and namespace imports drag the
  polyfill.** `packages/gmt/package.json` sets `"./plain/*/*": null` (and the same for
  `zoned`/`unix`/`utc`), so the maximum import granularity is the **module** barrel,
  `@northguild/gmt/plain/calculate`. Separately, `src/index.ts`, `src/plain/index.ts` and
  `src/zoned/index.ts` each open with `export * from "@js-temporal/polyfill"`, so a
  **namespace**-level import (`@northguild/gmt/plain`) pulls the entire polyfill — 2.98 MB
  unpacked. Module barrels do not. **The rule for every island in Tiers 2–6: import at
  module granularity, never namespace granularity.** This corrects a "deep-import per
  function" instruction that appeared in the 2026-08-21 draft and cannot work.
- **`packages/gmt` emits per-file `.d.ts` with JSDoc preserved**, but
  `packages/gmt/tsconfig.build.json` sets `declarationMap: false` — so there are no
  declaration maps for "view source" links. Link to GitHub source paths instead, which the
  generator knows anyway.
- **Astro 7 raises the Node floor.** `astro@7.2.7` requires `node >=22.12.0`; the repo
  root declares `engines: >=20 <25`. `.nvmrc` is `24` and CI runs Node 22 and 24, so CI is
  unaffected — but `apps/dox` must declare its own `engines`, and **a local shell may
  well be on Node 20**, which is the first wall DOX-A1 hits. `nvm use` before starting.
- **`@astrojs/starlight@0.41.9` peers on `astro ^7.0.2` _and_
  `@astrojs/markdown-remark ^7.2.0`** — the second peer is easy to miss. Verified
  compatible with `astro@7.2.7`.
- **GitHub Pages is not enabled on this repo** — `gh api repos/northguild/gmt/pages`
  returns 404 as of 2026-08-26. This is moot under the Cloudflare hosting decision (§2),
  but it is why that decision costs nothing to take now: there was no existing Pages setup
  to migrate away from.
- **Octane is real but is off the critical path.** `octane@0.1.43` (MIT, by Dominic
  Gannaway / trueadm), with `@octanejs/three@0.1.36`, `@octanejs/drei@0.0.9`, and
  `@octanejs/markdown@0.0.9` — all republished 2026-08-21. 43 releases in roughly eight
  weeks, with the adapters this epic would have depended on still at `0.0.x`. It is a
  moving pre-1.0 target with no benefit for a documentation site, and the superseded
  plan's own story DOX-A2 contained a gate admitting the `.tsrx` toolchain might fight the
  repo's `nodenext` setup. **Nothing in any tier depends on it.** Revisit only as an
  optional island if it matures.
- **Counts drift, so derive them.** The superseded plan cited 349 functions and ~999
  examples; the 2026-08-21 draft cited 424 and 1,514; the real figures on 2026-08-26 are
  **504 and 1,860**. Note that `context/roadmap/` is now **complete** — all 54 stories Done
  through E7 at v1.14.0 — so the churn no longer comes from in-flight roadmap work. It
  comes from ordinary npm releases, which continue. DOX-A3a therefore still derives its
  counts from source and asserts them in CI rather than hardcoding a snapshot.
- **There is no `systemKnowledge` Gemini setting.** Grounding is achieved with
  `systemInstruction` + retrieved context + an explicit refusal instruction. This is
  more reliable than a config flag would be, and it is the only mechanism available.

### The real generator risk

Stated separately because the 2026-08-21 draft pointed this at the `@example` parser and
that is the wrong target. What will actually be hard in DOX-A3a:

- **Options objects.** `startOfZoned`'s `@param options` is a single ~400-character prose
  line describing four option keys, with embedded bold and backticks. Turning that into a
  real parameter table, with each option's type linked to its own page, is the
  high-value work — and there are 504 functions of it.
- **42 public types need pages of their own**, or every one of those 504 signatures
  renders as a wall of dead identifiers.
- **No "see also" exists to extract.** With the tag graph empty, every cross-link must be
  synthesized. This is the generator's real design problem, not its parsing problem.
- **`plain/calculate/weekOfYear.ts` exports two functions** — the only file in the library
  that does, so "one page per file" holds 503 times out of 504. Handle it deliberately
  rather than discovering it as a missing page.

### What the 2026-08-26 audit changed

Recorded so these are not re-litigated:

| Change                            | Why                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| All counts refreshed              | 424 → 504 functions, 1,514 → 1,860 examples, ~14 → 42 types                                          |
| Generator risk re-aimed           | `@example` parsing is trivial; signatures, options and the absent tag graph are not                  |
| `DOX-B1`'s import rule corrected  | The exports map forbids the per-function imports the draft specified                                 |
| Hosting → Cloudflare              | Removes CORS, a second pipeline, and DOX-C1's corpus-location question                               |
| MVP shrunk to three stories       | Guides and brand are additive on a working site — the plan's own principle, applied one level deeper |
| Globe promoted to flagship        | User decision. It is a product feature now, not decoration                                           |
| Chat escalated to widget-emitting | User decision. It un-parks `appendix-parked.md` §2                                                   |
| Scenario layer added              | User decision. 60% of the content already exists in `skills/`                                        |
