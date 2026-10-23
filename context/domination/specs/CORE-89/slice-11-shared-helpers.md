# Slice 11 — one copy of each helper, and the table in the chat rail

A review of both checkers side by side found code that each region still carries its own copy
of, one layout bug, and a year baked into the shared parts. This slice moves each copy into the
shared modules, so a third region writes facts and config only. It runs after slice 9, which
edits the same mounts and CSS. Canada's page and widget must look and behave as they do after
slice 9, except where a bullet below says otherwise.

## The table in the chat rail

- `clock-change.css` narrows the probe table's cell padding with `@media (max-width: 30rem)`.
  The chat rail is 300 or 360 px wide on a wide screen, so the query never fires there and the
  table (about 297 px at full padding) overflows about 266 px of room.
- Replace the media query with a container query on the widget's own container:
  `@container <the checker's container name> (max-width: 21rem) { .<table> :is(th, td) {
  padding-inline: var(--gmt-space-1); } }`, placed after the base cell rule (same specificity).
  Declare the container on the checker root if it is not declared yet.
- Check: the widget at 300 and 360 px in the chat rail, and the page at 375 px, in Chromium and
  WebKit, with no sideways scroll (`scrollWidth <= clientWidth` on the page and the table).

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
