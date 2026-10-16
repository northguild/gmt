## I. Definition of done (`dox-tester`: run each line literally)

**I0. The two private trees.** Nothing in I6 to I19 uses port 4321, `apps/dox/dist` or this
worktree's `packages/gmt/dist` in place. `$SP` is the session scratchpad and `$W` is this worktree.

```bash
BASE=$(git -C "$W" merge-base HEAD origin/main)
mkdir -p "$SP/base" && git -C "$W" archive "$BASE" | tar -x -C "$SP/base"
mkdir -p "$SP/after" && rsync -a --exclude node_modules --exclude dist --exclude .git \
  --exclude .astro --exclude .visual --exclude .wrangler "$W"/ "$SP/after"/
# The branch's library is the dist the main session built; copy it, never rebuild it.
rsync -a "$W/packages/gmt/dist/" "$SP/after/packages/gmt/dist/"
# The baseline's library exists in no worktree, so it is built inside $SP/base only.
cd "$SP/base" && eval "$(fnm env)" && fnm use && pnpm install --frozen-lockfile \
  && pnpm --filter @northguild/gmt build \
  && DOX_VITE_CACHE_DIR="$SP/vite-base" pnpm --filter @gmt/dox build
cd "$SP/after" && eval "$(fnm env)" && fnm use && pnpm install --frozen-lockfile \
  && DOX_VITE_CACHE_DIR="$SP/vite-after" pnpm --filter @gmt/dox build
python3 -m http.server 48391 --bind 127.0.0.1 --directory "$SP/after/apps/dox/dist"
```

Re-run the `rsync` lines and the `after` site build after any builder change.

1. In `$W`: `pnpm --filter @gmt/dox test` is green, with no skipped, todo or expected-failure test
   in the files this work adds or changes.
2. In `$W`: `DOX_VITE_CACHE_DIR=<private> pnpm --filter @gmt/dox check` reports 0 errors and
   `pnpm --filter @gmt/dox lint` reports nothing.
3. In `$W`: `pnpm dox:generate`, `pnpm dox:docs-check` (0 gaps), `node scripts/stats.mjs check`,
   `node scripts/api-surface.mjs check` and `node scripts/deps.mjs check` pass. `README.md` and
   `packages/gmt/README.md` are byte-identical.
4. **The parity and rule tests pass by name:** `widget-registry`, `chat-starters`, `chat-handler`,
   `tools`, `widget-permalink`, `widget-load-error`, `widget-graph`, `client-graph`,
   `industry-tags`, `industry-overview`, `industry-pages`, `industry-sidebar`, `index-pages`,
   `build-reference`, `build-utils`, `redirects`, `gmt-stats`, `gnss-names`, `gnss-widgets`,
   `timescale-widgets`, `font-floor`, `content-list-rule`, `pt-day`, and, in `$SP/after` after its
   build, `scripts/llms.test.ts`.
5. **Generator spot-check** in `$W` after `generate`:
   - every function of L§1.1 except the removed GPS forms has a page, and none of `gpsToUtc`,
     `utcToGps`, `gpsWeekToUtc`, `utcToGpsWeek`, `GpsNavMessage` is in the corpus or the route
     manifest; `/reference/gnss/` and `/reference/timescale/` and their module indexes exist,
     carry no `industries` line, and are listed under "For any industry" on `/reference/` and in
     the reference sidebar's general groups, with the Unreleased badge;
   - `/reference/types/GnssSystem`, `GnssWeekCounter`, `RolloverEra`, `GnssWeek` and
     `RinexWeekSystem` are pages with no tag; `RinexWeek` is inline on `utcToRinexWeek` and its
     corpus `url` carries the anchor;
   - `/reference/plain/validate/hasSecond60` exists, `/reference/plain/validate/isLeapSecond` is
     not in the route manifest, and `public/_redirects` holds its three `301` rules;
   - `LIVE_PLAYGROUND_TEMPLATES.gnssWeekToUtc` has form fields with `rolloverEra` as `expr` (C1);
   - `/reference/transport/` and `/reference/intermodal/` still exist, carry their tag and the
     one-line pointer to the hub, and no longer hold the pain-point block;
     `/reference/workforce/` and `/reference/gnss/` sit under the reference sidebar's "By industry"
     divider with their icons, and every page in them carries its industry's tag;
     `/reference/timescale/` stays general and untagged;
   - `src/content/docs/industries/` holds `index.mdx`, `workforce.mdx`, `transport.mdx`,
     `intermodal.mdx`, `gnss.mdx` and `maritime.mdx`, and is ignored by git (I17 checks them).
6. **Boundaries.** `git -C "$W" status --short` shows no path this work changed under
   `packages/gmt` except `packages/gmt/README.md`; under `context/domination` only the CORE-76
   lines of `issues/CORE-76.md` and `tracker.md` (diff those two files against the owner's state
   and confirm nothing else from this work); nothing under `.changeset`; nothing staged.
   `grep -rniE "utc ?\+ ?3|moscow|\bMSK\b"` over the files this work adds or changes finds
   nothing. `grep -rnE "gpsToUtc|utcToGps|gpsWeekToUtc|utcToGpsWeek|GpsNavMessage"` over
   `apps/dox/src` (outside `generated/`) and this spec's pages finds nothing. No industry id, area
   id, widget kind or namespace is named `space`. The changed and new files under `apps/dox/src`
   hold no `--gmt-signal` outside the sentinel rules, no `border-left` or `border-inline-start`
   accent, no colour literal, no `backdrop-filter`, no `clip-path`.
7. **`html-diff`:** `capture` in `$SP/base/apps/dox`, `compare` in `$SP/after/apps/dox`. The five
   tool pages report `+`. Tools whose presets section N changed report `✗`, and each difference is
   a changed zone or its re-run output. Every other tool page reports no widget change.
8. **`visual:diff`:** `visual:before` in `$SP/base/apps/dox`; copy `.visual/before` into
   `$SP/after/apps/dox/.visual/`; `visual:after` and `visual:diff` there. Expected differences, each
   read and matched to this spec: the new pages; the "Industries" sidebar group on every page; the
   reference sidebar's general group `timescale`, its "By industry" groups in declared order with
   `workforce` and `gnss`, and no `duty` group; `/reference/` root; `/reference/transport/` and
   `/reference/intermodal/`; the tools, scenarios and mistakes sidebars and the tools index in
   declared order, with the Workforce pages under Workforce (and Transport where tagged) and the
   GNSS tools under GNSS and Maritime; `/why-gmt/`'s sentence, its stacked chart and its number
   format in the reader's locale; the Workforce guide at its new path; the pages and tools section N rebalanced. Anything else is a regression.
9. **`grow:measure --base http://127.0.0.1:48391`** passes for the five tool pages and every tool
   whose presets changed, in Chromium and WebKit at 1440 and 390. **`readout:still --base
   http://127.0.0.1:48391`** passes for every tool in its list at its default widths, in Chromium
   and WebKit.
10. **Browser pass** on the five tool pages, `/industries/`, `/industries/maritime/`,
    `/industries/transport/` and `/reference/`, in both themes, at 1440 and 390, and each tool in
    the `/dox` rail with its root at 360 and 300, opened from its `CHAT_STARTERS` card:
    - **keyboard only**, mouse untouched: Tab reaches the chips, every select, input, range and
      link in order; arrows, PageUp, PageDown, Home and End move every range; a disabled control is
      skipped; nothing inside a drawing or a table takes focus; the Industries sidebar group opens
      with Enter and its links are reachable; focus is always visible;
    - `pnpm run contrast:measure -- --base http://127.0.0.1:48391` passes (7:1 muted text, 3:1
      disabled border) on the five tool pages, `/industries/maritime/` and the `/dox` page;
    - no overlap of two labels, chips or plates; no horizontal page scroll;
    - no element with a left edge as its only accent (computed style and screenshots);
    - forced colours: every lane, bar, strip, ruler, pin, mark, sliver and hatched row keeps an
      edge;
    - **stillness:** for every preset of each tool with a range, drag each range end to end by
      keyboard and by pointer and record the bounding boxes of the three plates, the frame, every
      lane, bar chip and table, and the rows above the range: none moves or resizes. For the
      rollover checker in "Today" mode, record the plates for ten seconds of countdown: none
      resizes. Switching the firmware model between "Build date" and "Fixed era" moves no plate. Across presets of one tool and mode at one width, each plate keeps its size and
      each held region its height;
    - every cross-link of D13 opens its target with every key kept;
    - the hub icons in the sidebar are decoration only (`aria-hidden`).
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
