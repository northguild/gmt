## J. Files

**New** (under `apps/dox/` unless rooted): `src/data/industries.json`;
`scripts/build-industry-pages.ts`, `scripts/build-utils/industry-pages.ts` and its test;
`src/lib/gnss-names.ts`, `gnss-widgets.ts`, `timescale-widgets.ts`, `gnss-lib.ts`,
`timescale-lib.ts` and their tests; for each of the five tools its pure module, mount, tests,
component, sheet and page (D1, D9–D12); `src/styles/gmt-gnss-widgets.css`;
`src/test/gnss-lib.ts`, `src/test/timescale-lib.ts`; the F1 pages
(`guides/industries/gnss-system-time-and-week-rollover.mdx`,
`guides/industries/maritime-gnss-time-and-week-rollover.mdx`,
`guides/core-date-operations/leap-seconds-and-tai.mdx`, five scenarios, `mistakes/gnss.mdx`,
`mistakes/leap-seconds.mdx`); `scripts/build-utils/moved-pages.ts` (M3); the moved Workforce pages
(M2).

**Changed:** `/scripts/stats.mjs`; `/README.md`, `/packages/gmt/README.md` (two lines);
`/.gitignore`; `/.agents/finalizer.md`, `/.agents/gmt-reviewer.md`,
`/.agents/skills/update-readme/SKILL.md`, `/.agents/skills/update-readme/references/steps.md`,
`/context/code-review-checklist.md` (one line); `/context/domination/issues/CORE-76.md` and
`/context/domination/tracker.md` (the CORE-76 lines only, M3); `package.json` (`generate`);
`astro.config.mjs`; `scripts/build-reference.ts`, `scripts/build-utils/index-pages.ts`,
`build-utils.ts`, `industry-sidebar.ts`, `renamed-functions.ts` and their tests;
`src/lib/industry-tags.ts`, `industry-overview.ts` and their tests; `src/data/gmt-stats.ts`,
`gmt-stats.json` (by `stats:sync`), `gmt-stats.test.ts`; `src/lib/why-gmt-charts.ts`;
`src/content/docs/why-gmt.mdx`; `src/components/SidebarSublist.astro`;
`src/pages/llms.txt.ts`, `llms-full.txt.ts`; the registration files of section E;
`src/lib/retrieval/search.test.ts`; the F2 pages and the four F1 indexes; the five Workforce pages (M2: two moved, three retagged), `guides/index.mdx` and every page that
linked them; `buildRedirects` with `redirects.test.ts`; `scripts/render-charts.ts` (B9);
the N1 files (`converter-bench-mount.ts`, `dst-inspector-mount.ts`, `curated-timezones.ts`,
`pt-day.ts` and the Worker's cap that reads it) and their tests; the N2 pages, presets and
starters, and the tests that assert their outputs.

---

## K. Order

The main session runs these steps and spawns every agent directly; `tdd-dev` is building the
library in this worktree. `pnpm --filter @gmt/dox test` runs
`generate`, which walks `packages/gmt/src` and runs the doc gate, so no Dox step starts while
library slices are half written.

| Step | What | Needs | Who |
| --- | --- | --- | --- |
| P1 | Library slices 0–8 green, with the GPS-only API removed (decision 9), the `{ notBefore }` era form (decision 13), `duty/` moved to `workforce/` with the `/duty` subpaths removed (decision 16), the barrels, exports map and `gmt-modules.ts` keys (L§5.1–5.4) and the library's wiring of L§5–§8.3 | — | library pipeline (`tdd-dev`), spawned by the main session |
| P2 | **One build of `packages/gmt/dist`**, by the main session, after warning the owner (his dev server reads `dist`). Nothing in this plan builds it again | P1 | main session |
| D1 | Section B with Workforce, Transport and Intermodal (GNSS and Maritime wait for their guides), the stacked chart (B9), the README lines; C1; C2 | P2, with the library's `workforce/` move landed | one `dox-builder` |
| S | D8's shared modules, loaders, test helpers and `gmt-gnss-widgets.css` | D1 | one `dox-builder` |
| D1b + D3 | One step. F1's pages, then the GNSS and Maritime entries in `industries.json`, their icons, their overview text (B7), the README's GNSS and Maritime links and the `guides/industries/index.mdx` edits (B6). Tests run at the end of the step, not between | D1, C1 | builder A |
| DU | Section M: the Workforce and Transport overview text, the two page moves and five retags with their reference links, the moved URLs and their redirects, the README `[duty]`/`[workforce]` links, the CORE-76 lines | D1 | builder B |
| N1 | Section N1: the widget defaults, `curated-timezones.ts`, `pt-day.ts`, `why-gmt-charts.ts` | D1 | builder C |
| T-G | **The GNSS track:** the decoder (D1–D7), then the Clock Converter (D9), then the Rollover Checker (D10), each widget first and its page last | S; each page's tag needs D3 | builder D |
| T-L | **The leap-second track:** the Timeline (D11), then Elapsed vs. Clock (D12) | S | builder E |
| R | **Registration, once, for all five:** section E, the D13 links and the five starters | T-G, T-L | one builder |
| HW | The Workforce guide's examples (N3), after DU moved it | DU | builder B |
| N2 | The example rebalance (N2), split by section (below) | DU, N1, and R for the starters | builders F–J |
| D4 | F2's links into the tools; the D7 and I12 retrieval rows | D1b + D3, R | one builder |
| T | Section I | everything above | `dox-tester` |
| V | `pnpm run validate`, once, by the main session, after warning the owner | T green | main session |

**What runs in parallel.** After D1 and S: D1b + D3, DU, N1, T-G and T-L run at once, each on its
own files. The two tracks write only their own new files: **no track edits a registration file**
(section E's files, `chat-constants.ts`, `astro.config.mjs`, the gate scripts). Step R makes every
registration edit at once, so `DOX_TOOL_DOCS` is appended in one order and no two builders touch
`dox-tools.ts`. HW follows DU on the same page. The N2 split runs after R, because the starters and
presets live in `chat-constants.ts` and the tool modules:

| N2 builder | Owns |
| --- | --- |
| F | `content/docs/guides/` (concepts, conversion, core-date-operations, zoned-date-operations, intervals) |
| G | `content/docs/guides/industries/` other than the Workforce guide (HW owns it), `content/docs/tools/` |
| H | `content/docs/scenarios/`, `content/docs/mistakes/` |
| I | the widget presets and defaults in `src/lib/*.ts` (`crossing-clock.ts`, `demurrage-clock.ts`, `free-time-ledger.ts`, `dwell-ledger.ts`, `cutoff-*.ts`, `journey-split.ts`, `delivery-scheduler.ts`, `timetable-reader*.ts`, `punctuality-board.ts`, `departure-board.ts`, `bl-date-stamp.ts`, `dtm-decoder.ts`, `zoned-input.ts`) and their tests |
| J | `chat-constants.ts` starters and `dox-tools.ts` examples, after builder I, so a starter's seed matches its tool's presets |

Builders F–I run in parallel. A content page that embeds a permalink to a tool whose presets
builder I changes keeps its own seeded values (a permalink carries them), so the content and preset
builders do not wait on each other.

What can be built before the library exists: nothing. Every Dox step waits for P2, and none builds
the library.
