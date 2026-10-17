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
     manifest; `/reference/gnss/` and `/reference/timescale/` and their module indexes exist with
     the Unreleased badge: `gnss` under the reference sidebar's "By industry" divider with the
     `gnss` tag, `timescale` under "For any industry" and the general groups with no tag;
   - `/reference/types/GnssSystem`, `GnssWeekCounter` and `RinexWeekSystem` are pages tagged
     `gnss` (every function that reaches them is in `gnss/`, the `typeIndustry` rule);
     `RolloverEra`, `GnssWeek` and `RinexWeek` each have one user and are inline on
     `gnssWeekToUtc`, `utcToGnssWeek` and `utcToRinexWeek`, their corpus `url` carrying the anchor;
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
   declared order, each page under the one industry whose layer it runs (Workforce pages under
   Workforce, GNSS tools under GNSS), never two; `/why-gmt/`'s sentence, its stacked chart and its number
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
