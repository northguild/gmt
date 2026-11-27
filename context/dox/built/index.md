# Dox: as built

What `apps/dox` ships, tier by tier: the rules that bind future changes, the traps and the runbooks. Status is in [tracker.md](../tracker.md). History lives in git.

## Rules that bind every change

- **`apps/dox` must not perturb `packages/gmt`.** `pnpm run validate` stays green, including the CI time-zone matrix (`gmt-matrix` in `.github/workflows/ci.yml`; zones and Node versions in `src/data/gmt-stats.json`). No changesets unless a change also touches `packages/gmt`.
- **Merging to `main` deploys.** `deploy-dox.yml` runs when the Release workflow finishes on `main` (every push), checks out the commit Release ran on with every tag, and also runs on a daily schedule and `workflow_dispatch`. If Release stops running on pushes, merges stop deploying.
- **Generate, don't maintain.** `scripts/build-reference.ts` is the single extraction. Never re-derive pages, corpus, manifest or playground seeds by re-walking source or re-parsing MDX.
- **Import `@northguild/gmt` at module granularity only** (`@northguild/gmt/plain/calculate`). The exports map forbids per-function paths. A namespace barrel loads every module of its namespace and the root barrel every namespace, so use neither. Any module loads the Temporal polyfill. `regex` has no module subpaths, so its namespace barrel is its narrowest import.
- **Counts drift.** Derive them from source and assert them in tests; never hardcode them.
- **Tests never touch the network or spend AI budget.** `src/test/no-network.mjs`, preloaded into every test worker through Vitest's `execArgv`, blocks every non-loopback connection. Fake the model (`MockLanguageModelV4`), the `AI` binding and `fetch`. Only `pnpm dev`, `pnpm dev:chat`, `scripts/eval-live.ts` and real readers spend quota.
- **React lives only inside `/dox`.** Every other page is Astro plus plain-DOM modules.
- **Restyle native controls; never rebuild them from `div`s.**
- **No `:has()` on a box that holds the whole page** (`:root`, `html`, `body`, `.main-frame`, `.content-panel`) unless an attribute on `<html>` gates it first. Chrome re-styles the whole page on every DOM change inside it. Key a page-level rule on Starlight's `data-has-hero`, `data-has-sidebar` or `data-has-toc`, or put `[data-has-sidebar]` in front of the `:has()` (`dox.css`).
- **Widget CSS reaches only the pages that use it.** `pruneWidgetCss()` (`src/lib/prune-widget-css.ts`, on `astro:build:done`) drops a widget's stylesheet link and inline `<style>` block from every page that neither shows the widget nor loads a script naming its classes. For inlined sheets a dynamic `import()` or a chunk in Vite's preload list counts as use. The hook builds one search per page script set and reuses it, so keep it per set.
- **Every tier after tier 1 stays droppable**, and the docs work with the chat deleted.
- **No `octane` or `@octanejs/*`**, anywhere.
- **Minimum rendered text size is 12px (0.75rem)**, enforced by `font-floor.test.ts`.
- **A widget draws the library's results and computes none of them.** Every date, duration, verdict, class and total on screen is a library call, and the printed call is the call made. The polyfill is imported for drawing only (where a mark sits, formatting a returned duration). The site holds no table of the library's rules and guesses no zone: a zone, an offset or a code's kind comes from the reader or the library, never from a place name, port, abbreviation or site lookup. A preset is an example and carries its zones as literal fields.
- **One page-scoped exception to the naming rule.** The Sunshine Protection Act page (`/check/us-sunshine-protection-act/`) may carry the name "Sunshine Protection Act" in its title, sidebar label and slug, and in one neutral sentence saying proposals under that name have been put forward in several sessions. Every other string on it, the data, the chat text, the canary script and the tests name no law, bill, statute, docket or body, and the name sets no precedent for another page. Citations live only in `context/domination/research/us-permanent-daylight-time.md`.
- **GMT tracks no law, and the UI names no body.** No statute, regulation, regulator, court, docket, carrier rule or jurisdiction label appears in a widget string, preset, chat doc, page or test name. Examples are labelled by their numbers ("30-day windows", "a 14/14/45 contract"). Standards are named as data: DCSA field names, GS1 EPCIS 2.0, ISO/IEC 19987, UN/EDIFACT, ANSI X12, GTFS `frequencies.txt`. GMT computes dates, not liability: copy says "on or before the deadline" or "after the deadline", never `timely`, `late` as a finding, `void`, `payable` or `compliant`. A window has no default: a blank window input is left out of the call, has no `placeholder` and is never filled from a preset.
- **International authority first, no national lead.** Cite ISO, IEC, ITU, BIPM, IERS, IAU, IMO, CGPM and IGS/RINEX first, multinational industry bodies next, and a national source only as one labelled peer. No tool, preset or starter opens on `America/New_York`, `en-US` or a US-only example: rotate through `Europe/London`, `Asia/Tokyo`, `Australia/Sydney`, `America/Sao_Paulo`, `Africa/Johannesburg` and `Asia/Kolkata`. Keep a zone only where the example needs its DST shape or a standard's own code names it (an X12 time code such as `ET`). A locale, where needed, is regionless (`"en"`). A page that introduces X12 says it is a United States standard and that GMT reads its code lists through an X12-licensed dictionary, not the X12 text.
- **Verdicts are words and patterns.** Early, late, on time, open, closed and moved are never amber, green or red. Amber is `NO SIGNAL` alone. A series colour goes on a mark, stem, edge, swatch or border, never on text (the `-ink` tokens measure only 5.7 to 6.7:1 on a light surface). Every text label inside a chart sits on an opaque plate (a chip or header strip on `--gmt-surface`, text in `--gmt-ice` or `--gmt-ice-dim`), never on a gradient, hatch, glow or line. Glow is a shadow on a mark, never on text. No `backdrop-filter` inside a chart.
- **A holiday tool draws which rule closed which day with library calls on rule prefixes (`attributeRules`), and takes closed days only from the full calendar.** Calling the library on the rules before each one gives that rule's own dates without a shift computed on the site. This binds every later tool that draws a built calendar.
- **A tool page registers a tool, and its tool calls the facts function its mount calls.** Each page under `src/content/docs/tools/` has one WebMCP tool in `src/lib/webmcp/tools/<slug>.ts`, offered from the widget component's `<script>`. The tool module imports no mount and no CSS, so a missing facts function is extracted into the page's pure module first, and the mount then calls it too ([tier-2-webmcp.md](tier-2-webmcp.md)).
- **Reuse, never reinvent.** See [Reuse, never reinvent](#reuse-never-reinvent). The owner treats a breach as a defect, not as style.
- **Helpers follow the zero-bug house rules.** No catch-all helper: split by kind with narrow unions and return one shape. No constant that ages: no fixed year window, century pivot, era count or "current era". A preset's dates carry their year, and the eras to draw come from the library at the reader's today.

## Reuse, never reinvent

A feature is built from the site's shared pieces, and a second feature of its kind (a second deck,
tool or page of a family) is a folder of content plus a registry row. It never copies the first.
These rules bind the architect's spec and the builder's code alike.

1. **Search before you write.** Before you add a component, helper, CSS rule, test stub or script
   function, grep `apps/dox/src` and `apps/dox/scripts` for one that already does the job, and use
   it. Look for a component (`Icon.astro`, `BundleSize.astro`), a primitive class (`.gmt-sr-only`,
   `.gmt-icon-button`, a panel class), a token, or a test helper in `src/test/`. If it nearly fits,
   extend it.
2. **The second copy is the extraction.** If you write the same markup, rule, loop or function a
   second time, stop and give it one home first: a component, a shared class or `:is()` list, a
   token, or a helper with a test. Never leave two copies, let alone three.
3. **Shared layers hold no content.** `src/lib/**`, `src/components/**`, `src/widgets/**`,
   `src/styles/**` and `src/pages/**` never import a feature's data folder. They never hard-code a
   feature's question, zone, year, place, path or copy, and they never sniff the URL to learn which
   feature they are serving. Content lives in the feature's folder and comes in as props,
   arguments or a slug-keyed registry.
4. **Pages are routes, not copies.** Two pages that differ only by a slug are one `[slug]` route
   fed by a registry.
5. **One sheet, one layer.** A shared sheet holds only the shared layer. Feature rules live
   beside the feature's own components. A layout is chosen by an attribute the component sets,
   never by `:has()` on the child it happens to hold.
6. **Split by feature, not by accident.** A module of more than about 400 lines, or one closure
   of more than about 150 lines, is split into a core and opt-in features behind a small
   interface. A dispatcher over kinds is a registry of small objects, not an if/else chain.
7. **Derived files are not committed.** Anything a script rebuilds every run is written to a
   gitignored work folder. A committed data file states each fact once: no constant repeated on
   every row, and no id list repeated per cell.
8. **Dead code leaves in the same change.** This covers an unused component, option, branch or
   dial, and an `export` that only its own file reads.
9. **One check, one home.** Gates, browser checks and tests never repeat each other's
   assertions. A label that states a count is derived from the count.
10. **Watch the size.** When a story's diff passes about 10,000 added lines, or a slice adds more
    than its spec planned, stop and run a duplication pass (rules 1 to 9) before the next slice.

The [`ui-standards`](../../../.agents/skills/ui-standards/SKILL.md) check holds the lines a branch
adds to what a script can see of rules 2 to 8; `validate` and CI run it on every `apps/dox`
change.

## Map

| File | Holds |
| --- | --- |
| [tier-0-1-site.md](tier-0-1-site.md) | Workspace, deploy, base path, head tags and share cards, changelog pages, sidebar |
| [tier-0-1-generator.md](tier-0-1-generator.md) | Reference generator, tables, industries, AI surface, landing carousel, hand-written pages, upstream, Pulse |
| [tier-2-platform.md](tier-2-platform.md) | Component kit, global sheets, widget tests, test isolation, element identity, playground, Escape |
| [tier-2-tools.md](tier-2-tools.md) | Rules for every tool, registering a tool, industry tags, permalinks, traps |
| [tier-2-webmcp.md](tier-2-webmcp.md) | Page tools (WebMCP): marker and offer, shared facts, schemas, links, the gate, the origin-trial token |
| [tier-2-gates.md](tier-2-gates.md) | Gates |
| [tier-2-runner-and-ci.md](tier-2-runner-and-ci.md) | The gate runner, sharding, CI jobs for Dox |
| [slides.md](slides.md) | Slide decks: the stage, `.gmt-stage-fit`, presenter previews, text floor, title-safe edges and guide, wake lock, venue runbook |
| [tier-3-chrome.md](tier-3-chrome.md) | HUD chrome, header, landing entrance, cross-site transition |
| [tier-3-sound.md](tier-3-sound.md) | Sound engine and cues, the settings control, native panel motion |
| [tier-4-globe.md](tier-4-globe.md) | Globe engine, controls, zone drawer, Earth imagery, landing hero |
| [tier-4-sky.md](tier-4-sky.md) | Landing sky: stars, Milky Way, Sun and Moon maps, load order |
| [tier-4-sky-views.md](tier-4-sky-views.md) | Look at bar, aim and hold, names, rare-event list |
| [tier-4-sky-bodies.md](tier-4-sky-bodies.md) | Planets, Vesta, Pluto, Apophis and the orbit data |
| [tier-4-zones.md](tier-4-zones.md) | Zone readout, filters, scrubber, boundary data, data credits |
| [tier-5-scenarios.md](tier-5-scenarios.md) | Scenario and mistake pages |
| [tier-6-chat.md](tier-6-chat.md) | Dox chat: surface, retrieval, request pipeline, client |
| [tier-6-chat-tools.md](tier-6-chat-tools.md) | Dox chat: widget tools the brain calls, their registry and validation |
| [tier-6-brains.md](tier-6-brains.md) | Brains, budget, failover, traps |
| [tier-6-evals.md](tier-6-evals.md) | Chat evals: cases, floors, graders, the live run and its budget |
| [tier-6-runbooks.md](tier-6-runbooks.md) | Dev server traps, a11y gates, run the gates, Firefox route, gate baseline |
| [tier-6-ops.md](tier-6-ops.md) | Weekly gate sweep, local chat, deploy checks, owed verification, Not doing |
