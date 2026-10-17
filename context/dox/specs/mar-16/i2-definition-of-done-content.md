## I. Definition of done, continued (`dox-tester`: run each line literally)

Continues [i1-definition-of-done-build-and-visual](i1-definition-of-done-build-and-visual.md); `$SP`, `$W` and the two private trees are set up in I0 there.

11. **Values.** A script in `$SP` runs every preset of the five tools against `$SP/after`'s
    library and prints each call and result. For every preset, what the built page shows equals
    the script's output, and every `call // result` on the five tool pages and the F1 pages equals
    it too.
12. **Chat grounding and citation integrity:**
    - the D7 `search.test.ts` rows pass on the real corpus, plus: "How many seconds passed across
      the 2016 leap second?" retrieves `leapSecondsBetween` or the leap-seconds guide; "When does
      the next GNSS week rollover happen?" retrieves `gnssWeekToUtc` or the Maritime guide;
    - `chat-handler` with a fake model: a turn whose retrieved chunks include `gnssWeekToUtc`
      renders its `/reference/gnss/convert/gnssWeekToUtc` link as a link, and a hallucinated
      `/reference/space/…`, `/reference/plain/validate/isLeapSecond` or
      `/reference/gnss/convert/gpsToUtc` link renders as plain text (`link-components` test
      rows);
    - each of the five starter cards mounts its tool at once on click, and its seed passes the
      schema and the registry's `validate` (`chat-starters`);
    - an argument set a schema refuses (decoder broadcast with no `rolloverEra`, a counter
      `"GLO"`, rollover with neither or both of `firmwareNotBefore` and `firmwareEra`) renders the
      registry's error state, not a crash;
    - every internal link on the new and changed pages resolves to a page in `$SP/after`'s build
      or a route in the manifest, and every permalink opens its tool with every key kept.
13. **International defaults (section N):**
    - no widget's default state, preset or chat starter in `apps/dox/src/lib` holds
      `America/New_York` or `en-US`, except a preset whose standard's own code names a US zone
      (an X12 time code); `grep -rnE "America/New_York|en-US" apps/dox/src/lib --include=*.ts
      --exclude=*.test.*` lists only those lines and test-free comments that say why;
    - in `apps/dox/src/content` outside `docs/reference/` (generated from the library's JSDoc),
      `America/New_York` is not the most frequent IANA zone: count every `Area/City` occurrence and
      show the table;
    - a visual check of the Converter Bench and the DST Inspector, in both themes at 1440 and 390,
      shows their new default zones, value and regionless locale, on `/tools/converter-bench/`,
      `/tools/dst-inspector/` and the reference pages that embed them;
    - `CURATED_TIMEZONES` is in UTC-offset order (its test);
    - the per-visitor cap resets at 00:00 UTC, and each brain's quota still at Google's Pacific
      midnight (`pt-day` tests).
14. **Citations (section 0, F1):** on the GNSS and Maritime guides, the five tool pages and the chat copy,
    `grep` finds no sentence that cites A.1046(27) or IEC 61108 as naming or recognising the six
    systems; every page that calls the systems "peers" carries the IMO recognition sentence and
    states the scope caveat once; IEC 61108 is cited only by part and system; IEC 61162 is cited as
    IEC 61162-1:2024, Edition 6.0. Each citation links or names its primary page from research §9a.
15. **The Workforce layer (section M):** `/industries/workforce/` lists the eight `workforce`
    functions as its own, and `/industries/transport/` lists them under "Functions it draws on"
    with the line "Part of the Workforce industry layer"; the Workforce guide is at
    `/guides/industries/workforce-hours-of-work/`, the mistakes page at `/mistakes/workforce/`; the
    five pages carry the tags of M2, each links a `/reference/workforce/…` page, and they sit under
    their industries in the sidebars; the API Reference has a `workforce` group under "By industry"
    and no `duty` group; no page names a regime, a regulator or a statute.
16. **Redirects.** `public/_redirects` holds three `301` rules (bare, trailing slash, `.md`) for:
    `isLeapSecond` (C2); each of the eight moved duty functions to its `/reference/workforce/…` page;
    `/reference/duty`, `/reference/duty/calculate`, `/reference/duty/validate`,
    `/guides/intervals/hours-of-work` and `/mistakes/duty` to their new pages (M3). No source is a
    live route in the manifest or the build, and every target is. On `wrangler dev` over the
    `after` build (which applies `_redirects`; the Python server does not), each old URL answers
    `301` and its `Location` opens a page that returns `200`. `grep` over `apps/dox/src` (outside
    `generated/` and the generated reference) finds no link to an old URL.
17. **The industry hubs.** `/industries/`, `/industries/workforce/`, `/industries/transport/`,
    `/industries/intermodal/`, `/industries/gnss/` and `/industries/maritime/` each return `200`
    in the `after` build, in declared order in the Industries sidebar group with their icons
    (`aria-hidden`). Each hub's function lists equal the corpus: its own namespace's functions, and
    per drawn-on module exactly that module's functions (GNSS lists `timescale`; Maritime lists
    `gnss` and `timescale`; Transport lists `workforce`; Intermodal lists `transport`, with the
    line "Part of the Transport industry layer"). Each hub's guides, tools, scenarios and
    mistakes lists equal the pages whose frontmatter carries its tag. Every link on every hub
    resolves. The hubs are in `llms.txt` and `llms-full.txt`.
18. **The stacked chart (B9).** A script in `$SP` reads `$SP/after`'s corpus and
    `industries.json` and prints, per industry, its own count and each drawn-on module's count, and
    the distinct total of all own namespaces. On `/why-gmt/` in the `after` build:
    - each column's segments equal the script's counts, in declared order; Transport's column has a
      shaded `workforce` segment, Intermodal's a shaded `transport` segment, GNSS's a shaded
      `timescale` segment, and Maritime has only shaded segments;
    - the caption's first number equals the distinct total, which is less than the sum of every
      column's height whenever a layer is drawn on, and `coreFunctions + industryFunctions` equals
      the corpus's function count (`gmt-stats` test);
    - no function is in two own namespaces (the script asserts it);
    - the tooltip names each shared layer and whether it is an industry layer or Core; the legend
      has a solid and a hatched swatch with words;
    - `contrast:measure` passes on `/why-gmt/` in both themes (7:1 for labels and ticks, 3:1 for the
      shaded segment's edge); no legend item or caption block has a left-only accent; the no-JS SVG
      shows the same segments as the live chart.
19. Firefox does not launch on this machine. Record it as blocked. Do not bypass the sandbox.

`pnpm run validate` is not run here: it rebuilds the library under the dev server. The main
session runs it once at the end (section K).
