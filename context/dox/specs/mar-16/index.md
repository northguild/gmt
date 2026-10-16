---
story: MAR-16
issue: 197
status: approved
dox: context/dox/specs/mar-16/index.md
---

# MAR-16 Dox spec: declared industry layers and five GNSS and leap-second tools

What `apps/dox` ships for MAR-16 (#197). `dox-builder` builds against this spec and `dox-tester`
verifies against § I. The library side is
[`context/domination/specs/MAR-16/index.md`](../../../domination/specs/MAR-16/index.md); its section
map resolves every "L§n" citation in the slices.

## Scope

- **Industry layers are declared** (§ B): each industry declares its own namespace and the modules
  it draws on in `industries.json`, and gets a hub page at `/industries/<id>/`. Workforce and GNSS
  join Transport and Intermodal as cross-industry layers; Maritime draws on `gnss` and `timescale`.
  The `/why-gmt` "By industry" chart becomes stacked (B9).
- **Generator fixes** (§ C): the `number | "rolling"` classifier defect and the `isLeapSecond` →
  `hasSecond60` redirect.
- **Five standalone tools** (§ D): GNSS Week Decoder, Satellite Clock Converter, GNSS Rollover
  Checker, Leap Second Timeline, Elapsed vs. Clock Difference, each with its chat registration.
- **Content pages** (§ F1): the GNSS, Maritime and leap-seconds guides, scenarios, mistakes pages.
- **The Workforce layer** (§ M) and **the Dox items of the international-standards audit** (§ N).

## How to read it

Every builder reads `decisions.md` (decisions 1–21, the tool and library tables) and `rules.md`
(§ 0 binding rules, § A scope, § G design constraints, § L `built.md` sections), then the slice its
§ K step names below. Section letters and numbers are the original ones, so "§ E", "D9" and
"decision 13" are found by their headings. A section split across slices repeats its heading with
"(continued)".

## Slices

| Slice | Sections | § K step or track | Purpose |
| --- | --- | --- | --- |
| [decisions](decisions.md) | Header, decisions 1–21, tool table, library surface | every step | The closed decisions and the API each tool calls |
| [rules](rules.md) | § 0, § A, § G, § L | every step | Binding rules, scope, design constraints, `built.md` reading list |
| [b1-b4-industry-layers](b1-b4-industry-layers.md) | § B intro, B1–B4 | D1; D1b + D3 (B2 entries); DU (B1) | The rule, `industries.json`, `stats.mjs` and READMEs, `industry-tags.ts` |
| [b5-b9-industry-layers](b5-b9-industry-layers.md) | B5–B9 | D1; D1b + D3 (B6, B7); DU (B7) | Generator, hub pages, overview text, tests, stacked chart |
| [c-generator-fixes](c-generator-fixes.md) | § C (C1, C2) | D1 | Classifier fix and the rename redirect |
| [d1-d4-gnss-week-decoder](d1-d4-gnss-week-decoder.md) | § D intro, D1–D4 | T-G | Decoder files, inputs, `readGnss`, template |
| [d5-d7-gnss-week-decoder](d5-d7-gnss-week-decoder.md) | D5–D7 | T-G; R (D6 chat); D4 (D7 retrieval rows) | Decoder presets, permalink and chat, tests |
| [d8-shared-modules](d8-shared-modules.md) | D8 | S | Shared modules, loaders, test helpers, family sheet |
| [d9-satellite-clock-converter](d9-satellite-clock-converter.md) | D9 | T-G; R (its chat paragraph) | The Satellite Clock Converter |
| [d10-gnss-rollover-checker](d10-gnss-rollover-checker.md) | D10 | T-G; R (its chat paragraph) | The GNSS Rollover Checker |
| [d11-leap-second-timeline](d11-leap-second-timeline.md) | D11 | T-L; R (its chat paragraph) | The Leap Second Timeline |
| [d12-elapsed-vs-clock-difference](d12-elapsed-vs-clock-difference.md) | D12 | T-L; R (its chat paragraph) | Elapsed vs. Clock Difference |
| [d13-e-registration](d13-e-registration.md) | D13, § E | R | Cross-links between the five tools and the registration checklist |
| [f1-content-pages](f1-content-pages.md) | § F intro, F1 | D1b + D3 | The MAR-16 guides, scenarios, mistakes pages and index edits |
| [f2-tool-page-links](f2-tool-page-links.md) | F2 | D4 | Tool pages and the links from content into the tools |
| [h-close-out](h-close-out.md) | § H | after T (`dox-architect`) | `built.md` and context close-out |
| [i-definition-of-done](i-definition-of-done.md) | § I (I0–I19) | T (`dox-tester`) | Definition of done, run literally |
| [j-k-files-and-order](j-k-files-and-order.md) | § J, § K | main session; N2 (its split table) | Full file list, step order, parallel tracks |
| [m-workforce-layer](m-workforce-layer.md) | § M | DU | Duty pages moved and retagged, redirects, README, CORE-76 lines |
| [n1-widget-defaults](n1-widget-defaults.md) | § N intro, N1 | N1 | Non-US widget defaults, timezone order, visitor cap day |
| [n2-example-rebalance](n2-example-rebalance.md) | N2 | N2 (builders F–J) | Rotating example zones and locales across content and presets |
| [n3-workforce-guide-examples](n3-workforce-guide-examples.md) | N3 | HW | Reordering the Workforce guide's regime examples |

## Slices by § K step

| Step | Who | Slices beyond `decisions` and `rules` |
| --- | --- | --- |
| P1 | library pipeline (`tdd-dev`) | none here; the library spec |
| P2 | main session | `j-k-files-and-order` |
| D1 | one `dox-builder` | `b1-b4-industry-layers`, `b5-b9-industry-layers`, `c-generator-fixes` |
| S | one `dox-builder` | `d8-shared-modules` |
| D1b + D3 | builder A | `f1-content-pages`, then B2, B6 and B7 in the two B slices |
| DU | builder B | `m-workforce-layer` (B7 for the overview text) |
| N1 | builder C | `n1-widget-defaults` |
| T-G | builder D | `d1-d4-…`, `d5-d7-…` (decoder), `d9-…`, `d10-…`, with `d8-shared-modules` for the shared API |
| T-L | builder E | `d11-…`, `d12-…`, with `d8-shared-modules` for the shared API |
| R | one builder | `d13-e-registration`, and the "Permalink and chat" part of D6, D9, D10, D11, D12 |
| HW | builder B | `n3-workforce-guide-examples` (the § N intro is in `n1-widget-defaults`) |
| N2 | builders F–J | `n2-example-rebalance`, and the N2 split table in `j-k-files-and-order` |
| D4 | one builder | `f2-tool-page-links` (paths under `apps/dox/src/content/docs/`), D7 rows, I12 |
| T | `dox-tester` | `i-definition-of-done` |
| close-out | `dox-architect` | `h-close-out` |
| V | main session | none; `pnpm run validate` once, after warning the owner |

## Files (condensed from § J)

Paths under `apps/dox/` unless rooted. The full list is in
[j-k-files-and-order](j-k-files-and-order.md).

**New:**

- `src/data/industries.json`; `scripts/build-industry-pages.ts`,
  `scripts/build-utils/industry-pages.ts`, `scripts/build-utils/moved-pages.ts`, with tests.
- `src/lib/gnss-names.ts`, `gnss-widgets.ts`, `timescale-widgets.ts`, `gnss-lib.ts`,
  `timescale-lib.ts` and tests; `src/test/gnss-lib.ts`, `src/test/timescale-lib.ts`;
  `src/styles/gmt-gnss-widgets.css`.
- Per tool (D1, D9–D12): pure module, mount, tests, component, sheet, page.
- The F1 pages (three guides, five scenarios, `mistakes/gnss.mdx`, `mistakes/leap-seconds.mdx`)
  and the moved Workforce pages (M2).

**Changed:**

- Repo root: `scripts/stats.mjs`; both READMEs (two lines); `.gitignore`; the agent docs of B3;
  the CORE-76 lines of `context/domination/issues/CORE-76.md` and `tracker.md` (M).
- Generator and config: `package.json` (`generate`), `astro.config.mjs`,
  `scripts/build-reference.ts`, `scripts/build-utils/index-pages.ts`, `build-utils.ts`,
  `industry-sidebar.ts`, `renamed-functions.ts`, `buildRedirects`, `scripts/render-charts.ts`.
- Site libs: `industry-tags.ts`, `industry-overview.ts`, `gmt-stats.ts` / `.json`,
  `why-gmt-charts.ts`, `SidebarSublist.astro`, `llms.txt.ts`, `llms-full.txt.ts`, the § E
  registration files, `retrieval/search.test.ts`.
- Content: `why-gmt.mdx`, the F2 pages and four F1 indexes, the five Workforce pages and their
  linkers, `guides/index.mdx`.
- § N: the N1 files (`converter-bench-mount.ts`, `dst-inspector-mount.ts`,
  `curated-timezones.ts`, `pt-day.ts` and the Worker cap) and the N2 pages, presets and starters,
  each with its tests.
