# Slice 1 — shared parts, Canada unchanged

The Canada checker's probe, clocks, servers card, help card, saved-events check, zone map and
boundary script move into neutral modules. Each module takes a config. Canada becomes the first
user of them and keeps everything it shows and does. The Canada projection, the stated Canada
facts, the minimums card (slice 8 shares it) and every part of the text that is about Canada stay in the Canada
files.

**Not here:** anything about Morocco. When this slice is done, the only thing that has changed is
where the code lives and what the classes are called.

## Interfaces

**As built** (the code wins over any planned name):
`ProbeConfig.zones` is `{zone, expected}[]`; `VerdictText` carries the card's whole wording
(`title`, notes, `right`, `wrongBefore`/`wrongAfter`, `more`, `unknown`); `clocksHtml(zones, stopped)`
and `mountClocks(root, {idPrefix, lib, now, signal, read})`; `storedVerdict` stays in
`clock-change-stored-lines.ts` and `mountStoredTimes(root, config, signal, fetchFn)` takes a signal;
`ZoneMapConfig` has `kindLabels` and `mapLabel` (slice 3 added `markerMinPx`/`markers`); `renderPinPanelHtml()` takes no prefix; the pin panel and zone list use
`gmt-zonemap-*`, everything else `gmt-clockcheck-*`; `serversCardHtml` takes `expected` as
`[city, offset][]`; `handleClockChangeCheck(request, endpoint, now)` takes a `CheckEndpoint`.

The interfaces are built: `context/dox/built.md` § **Clock-change checker parts** lists each
module's exports in one line, and the code is the reference. Each function kept the body and
behaviour it had in the Canada files.

## Rules

- **Byte-identical Canada output.** `probeInlineSource`, `nodeProbeCommand`, the verdict text and
  the stored text must give Canada exactly the strings it gives today. Canada's `VerdictText`,
  `HELP`, `STORED_PRESET` and saved example move into its own config verbatim. `mapZone` (the
  Worker's row builder, `kind` from `getDstTransitions` for 2026 and 2027) moves to
  `worker/clock-change-shared.ts` unchanged.
- **The boundary script gives the same bytes.** `--region canada` must rewrite
  `timezone-boundaries-canada.json` and `canada-zones.json` byte for byte once `oxfmt` has run.
  A frame of `None` means no clip, which is how Canada works today.
- **Neutral classes.** The shared parts render `gmt-clockcheck-*` classes in place of
  `gmt-canada-*`, and their rules move to `src/styles/clock-change.css`. Register that file in
  `astro.config.mjs` next to `canada-clock-change.css`, and move the matching forced-colors rules
  in `gmt-a11y.css`. This includes the map, pin panel, zone list and legend classes, which become
  `gmt-zonemap-*`. The page roots keep their own class (`gmt-canada`), and the Canada pick card
  keeps `gmt-canada-*`. Find every class with
  `grep -rn "gmt-canada-" apps/dox/src apps/dox/scripts`.
- **The probe script finds its card by id** (`#<idPrefix>-browser`), not by
  `.gmt-canada .gmt-canada-browser`, so two checkers never fill each other's card.
- **deploy-smoke follows the cap.** `deploy-smoke.mjs` reads `STORED_MAX_LINES = (\d+);` from
  `canada-clock-change.ts`. Point it at `clock-change-stored-lines.ts`.
- **The Canada files re-export nothing.** Every importer moves to the new module path, including
  `runtime-tz-canary.test.ts`, the Worker, `mdx-jsx.ts` and the scripts. A file that only
  re-exports is a second name for one thing.
- **Readouts hold still.** The browser-card cells, the clocks and the stored results keep their
  reserved widths, tabular figures and fixed-height placeholder. Nothing here changes size.
- **No left-border-only accents** in any rule that moves. The audit should find none. If it
  finds one, convert it to a bottom border or a full bevelled border, and record that as an
  intended visual change.
- **The map enters like the globe** (owner's request; the one intended behaviour change).
  `mountZoneMap` plays the site's arrival gesture, `enter()` from `src/lib/enter.ts` (the
  globe's 0.5 s fade from 92% scale), on the drawing once its shapes are in place, instead of
  letting it appear at once. Its box is reserved before and during the entrance, so nothing
  around it moves; reduced motion shows it at once, as `enter()` already does. Both maps get it
  from the shared module. Add it after DoD lines 2 to 4 pass, then re-run them.
- **html-diff learns a rename.** Add an environment variable,
  `HTML_DIFF_RENAME="gmt-clockcheck-:gmt-canada-,gmt-zonemap-:gmt-canada-"` (comma-separated
  `from:to` pairs). In `compare`, apply it to the *after* markup before `normalise`. Keep every
  class suffix as it is (`gmt-canada-legend` → `gmt-zonemap-legend`) so that the map inverts exactly. Document it in the script header. The variable tells an intended rename
  apart from a real change in the markup.

## Tests

- Move each Canada test to the module that now holds its code
  (`canada-probe-inline.test.ts` → `clock-change-probe.test.ts`,
  `canada-stored-times.test.ts` → `clock-change-stored-lines.test.ts`,
  `canada-map.test.ts` → `zone-map.test.ts` except its projection cases, and the help-card, clock
  and stored-mount cases with them). Assertions keep their values. A changed line in a moved test
  is an import path, a class rename or an added config argument, and nothing else.
- Add one test per shared module that passes a second config (two zones, two instants,
  `idPrefix: "x"`). It checks that every id and the endpoint come from that config, so no
  `canada` string leaks: `expect(html).not.toMatch(/canada/i)`.
- `worker/canada-clock-change.test.ts` passes with no change to an assertion.

## Definition of done

Run each line from the repo root unless it says otherwise. Use a copy of the build served on port
4351 for the browser scripts, never the owner's dev server.

1. Before you change any code, warn the owner, then run `pnpm --filter @northguild/gmt build` once
   (this worktree has no `packages/gmt/dist`). Then `pnpm dox:build && node apps/dox/scripts/html-diff.mjs capture /tmp/core89-before`
   and `pnpm --filter @gmt/dox visual:before`.
2. Afterwards: `pnpm dox:build`, then
   `HTML_DIFF_RENAME="gmt-clockcheck-:gmt-canada-,gmt-zonemap-:gmt-canada-" node apps/dox/scripts/html-diff.mjs compare /tmp/core89-before`
   prints no `✗` line.
3. `pnpm --filter @gmt/dox visual:after && pnpm --filter @gmt/dox visual:diff` passes for
   `check-canada-2026-clock-change` in both themes and both viewports.
4. `pnpm dox:test` passes. `git diff main -- apps/dox/worker/canada-clock-change.test.ts` shows
   no changed `expect(` line.
5. `grep -rln "gmt-canada-\(browser\|clock\|servers\|help\|stored\|map\|mapsec\|pin\|legend\|swatch\)" apps/dox/src apps/dox/scripts` prints
   nothing. (Adjust the alternation to the shared classes you actually renamed, and list them
   in the hand-back.)
6. `node apps/dox/scripts/canada-layout-check.mjs --base http://127.0.0.1:4351/gmt`, then
   `node apps/dox/scripts/canada-stored-still.mjs` and `pnpm --filter @gmt/dox canada:still`,
   all pass against the served build.
7. Keyboard only: Tab reaches every control of the Canada page in the same order as before. At
   375 px there is no horizontal page scroll (`canada-layout-check.mjs --widths 375`).
8. `uv run --with shapely python apps/dox/scripts/prepare-region-boundaries.py --region canada`,
   then `pnpm exec oxfmt --write apps/dox/public/timezone-boundaries-canada.json apps/dox/src/lib/canada-zones.json`,
   then `git diff --exit-code -- apps/dox/public apps/dox/src/lib/canada-zones.json` exits 0.
9. `node apps/dox/scripts/data-credits-check.mjs` passes. The Canada credits button keeps its
   id `canada-data-credits`, its corner placement and its text.
10. `pnpm dox:check` and `pnpm dox:lint` are clean.
11. `built.md`'s **Canada 2026 clock-change checker** entry names the shared modules, and a new
   **Clock-change checker parts** entry lists their interfaces in one line each, with the reason:
   one set of parts for every dated tz-change checker.
