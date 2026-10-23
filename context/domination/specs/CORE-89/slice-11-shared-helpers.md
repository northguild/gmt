# Slice 11 — one copy of each helper, and the table in the chat rail

A review of both checkers side by side found code that each region still carries its own copy
of, one layout bug, and a year baked into the shared parts. This slice moves each copy into the
shared modules, so a third region writes facts and config only. It runs after slice 9, which
edits the same mounts and CSS. Canada's page and widget must look and behave as they do after
slice 9, except where a bullet below says otherwise.

## The table in the chat rail

- The probe table's cells have `--gmt-space-2` padding on every side, and the header notes wrap
  by a container query on the card that holds the table (`.gmt-widget-section`), not the checker:
  24rem in `clock-change.css`, 26.5rem for Morocco's longer note in `morocco-clock-change.css`.
  Keep both; the shared CSS move in this slice keeps Morocco's query in Morocco's sheet.
- Even with the notes wrapped, the table is wider than a narrow card: 305 px (Morocco) and 296 px
  (Canada) in a 289 px card at 375 px, and the page scrolls sideways at 320 px. Two words set the
  floor: the zone id (`Africa/Casablanca`, about 115 px, with no break point) and the "Correct"
  header (71 px).
  - Let the zone id break after its `/` (a `<wbr>` after each `/` in the markup
    `clock-change-probe.ts` writes, never `overflow-wrap: anywhere`).
  - In a card narrower than 21rem, narrow the cells' inline padding to `--gmt-space-1`
    (`@container (max-width: 21rem)`, after the base cell rule).
- Check: the widget at 300 and 360 px in the chat rail, and the page at 320, 375, 1280, 1366 and
  1440 px, in Chromium and WebKit. At each, the table is no wider than its card's content box,
  and nothing scrolls sideways (`scrollWidth <= clientWidth` on the page and the table). Add the
  table-in-card check to `canada-layout-check.mjs`, so a longer note in a later region fails it.

## Shared helpers

Each item ends with one copy, in a shared module, and both regions calling it.

1. **The library loader, `ask`, the key-points list and the widget wrapper.** Both mounts carry
   their own `pick` / `load<Region>Lib`, the `ask` button wiring, `keyPointsHtml` and the widget
   wrapper markup. Move them into one shared module (`clock-change-mount-common.ts` or the
   existing `clock-change-common.ts` if it stays small), parameterised by the region's config.
   The chat's static-import guard (`widget-graph.test.ts`) must list the new module.
2. **The saved example.** `canada-saved-example.ts` and `morocco-saved-example.ts` hold the same
   maths. One helper, `savedExample(fact, wall)` in `clock-change-stored.ts`, takes the stopped
   zone's fact and the wall time and returns the saved value, the shifted value and the words.
   It must wrap past midnight: a wall time of 23:30 shifted by an hour prints `00:30` on the next
   date, never `24:30`. Test that case. Delete the two region files' copies; each region keeps
   only its fact and wall time.
3. **The Worker's fixed tables.** `worker/canada-clock-change.ts` builds its probe rows and
   transition rows by hand; Morocco has its own. Move `probeRows(probe, zones)` and
   `transitionRows(changes, zones)` into `worker/clock-change-shared.ts`, and have both regions
   call them. The JSON each endpoint returns must not change (compare a response before and after,
   byte for byte, at a fixed `now`).
4. **A direct test of the shared handler.** Add `worker/clock-change-shared.test.ts`. It calls
   `handleClockChangeCheck` with a made-up endpoint (`prefix: "demo"`, a 3-a-minute policy, two
   stored zones, a stub `compute`) and checks, in order: 405 with `Allow: GET, HEAD, POST`; HEAD
   with an empty body and `no-store`; 413 over the byte limit; 429 on the fourth call; 400 for a
   bad form and for a zone outside the list; and a 200 that holds the stub's answer.
5. **The shared CSS.** Morocco's key points, servers card and forced-colors borders work only
   because `canada-clock-change.css` is loaded on every page. Move every rule both checkers use
   (key points, servers card, the forced-colors selectors, and the stack, row, groups, pick and
   now-seconds rules that each region file repeats) into `clock-change.css` under the shared
   class names. `canada-clock-change.css` keeps Canada-only rules; `morocco-clock-change.css`
   keeps Morocco-only rules or goes if none are left. Rename `canada-palette.test.ts`'s
   description of `clock-change.css` so it no longer calls that file Canada's.

## The years in the shared parts

- `zone-map.ts` types the map kind as `"stopped-2026" | "changes-2027" | "none-2026-2027"`, and
  `worker/clock-change-shared.ts` (`mapZone`) classifies with 2026 and 2027 typed in. A region
  whose change falls in another year would have to edit shared code.
- The region states its years once: `stopYear` (the year its zones stop changing) on the
  endpoint and map configs. The shared code derives the next year from it. The kinds become
  `"stopped"`, `"changes-after"` and `"none"`, and each region's `kindLabels` keeps the words
  readers see ("Stops changing clocks in 2026", and so on) unchanged.
- The Worker's JSON field values change with the kind names. Update the chat's and the page's
  readers, `deploy-smoke.mjs` and every test in the same change. The visible text must not change.
- Canada's fact field `tzdb2026e` and Morocco's `MOROCCO_EXPECTED` are one idea in two shapes.
  Give both regions the same field (`offset`, the offset the newest data gives at the verdict
  instant), and update `runtime-tz-canary.test.ts` to read it.

## Canada's page

- Under `## Related` in `canada-2026-clock-change.mdx`, add a line linking the Morocco checker,
  worded like the Morocco page's link back to Canada.

## Checks

- `pnpm --filter dox test` green; `pnpm --filter dox check` (astro check) clean; oxlint clean.
- `node scripts/html-diff.mjs compare` against a baseline captured after slice 9: Canada and
  Morocco widget markup unchanged, except the container declaration if one is added.
- Light and dark screenshots of both pages at 1440, 1024 and 375 px, and the chat widget at 360 px.
- Contrast and layout scripts as in slice 9.
