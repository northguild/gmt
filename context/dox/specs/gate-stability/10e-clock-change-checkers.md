# Slice 10e — the dated clock-change checkers: Canada and Morocco

This slice moves the two `/check/` pages onto the kit, with everything they share: the browser
probe, the live clocks, the saved-events section and the zone map. Both pages are #429 pages
(cause 4 and Morocco's cause-9b load jump). Follow the
[migration recipe](./09a-gnss-ids-bridge.md#2--migration-recipe-every-widget-in-9a10f).

## Current state (verified)

| File | Lines | What it renders |
|---|---|---|
| `canada-clock-change-mount.ts` | 389 | Canada template and wiring; `list.innerHTML` `:281`; zone scroller `role="region"` `:159` |
| `morocco-clock-change-mount.ts` | 417 | Morocco template and wiring; `list.innerHTML` `:298`; zone scroller `:163` |
| `clock-change-mount.ts` | 285 | the shared loader, Worker request, Key points, copy wiring, chat wrapper |
| `clock-change-probe.ts` | 485 | "Your browser" and "Test your own servers" cards; `innerHTML` ×8 (`:339`–`:428`); `probeInlineSource` `:299` |
| `clock-change-stored.ts` / `-stored-lines.ts` | 613 / 426 | saved events; `results!.innerHTML` `:496`, `:502` |
| `clock-change-clocks.ts` | 165 | the ticking clocks |
| `clock-change-tense.ts` | 321 | before, on or after the change (`slotHtml`) |
| `zone-map.ts` | 1073 | d3-geo map, zone list with a roving tab stop, pin panel |

- Sheets: `clock-change.css` (2389 lines; `gmt-clockcheck-` ×213 and `gmt-zonemap-` ×84 in
  the mounts; `nth-child(n + 2)` at `:46` and `:57`) and `morocco-clock-change.css` (97 lines,
  1 `nth-*` at `:15`). Both are `customCss` entries (`astro.config.mjs:318-319`).
- The mounts also use `gmt-widget-` ×36, the shared sheet that slice 11 deletes.
- **The probe runs before any module.** `CanadaProbeScript.astro` and `MoroccoProbeScript.astro`
  inline `probeInlineSource(...)` with `is:inline`, so the "Your browser" card fills before
  first paint. It finds its cells by the fixed id `<idPrefix>-browser`.
- Tests: `canada-clock-change-mount.test.ts` (`data-role` ×24), `-widget.test.ts` (×3),
  `morocco-clock-change-mount.test.ts` (×9), `-widget.test.ts` (×3), plus pure tests for the
  map, palette, tense, stored lines and probe.

## Files and changes

- **`src/widgets/families/clockcheck/`** takes the shared pieces, each a builder with a module
  and a test: `stack` (the page's `container: gmt-clockcheck / inline-size`), `probeCard`,
  `serversCard`, `clocks`, `storedSection`, `keyPoints`, `changeList` and `zoneMap` (list, pin
  panel, map frame).
- **Tables.** The clock-check tables go through `table()`, so `:is(th, td):nth-child(n + 2)`
  becomes the builder's `align: "end"` column class. The stored-times table keeps slice 4's
  cause-4 fix (its stacked form below the container width) in the family module.
- **The probe.** `probeInlineSource` stays a self-contained string, because it runs before
  any module loads. Change it so that it writes only the markup `probeCard` would write for the
  same result: export the row and verdict builders as pure functions, and serialise them into
  the inline source. Add a jsdom test that runs the inline script on the server-rendered card
  and compares its result with the builder's markup for the same zones.
- **Redraws.** Every other `innerHTML` in these files becomes `setHtml` (8a) with builder output.
  The year lists (`:281`, `:298`) and the stored results sit in `<gmt-grow>`.
- **The clocks** are `<gmt-readout quiet>` (10a), reserving the widest time in tabular figures.
  The summary announces the change of state, not each second.
- **The zone list** is the keyboard path (`zone-map.ts:11-13`). Its roving tab stop becomes a
  kit helper, `src/widgets/primitives/roving.ts`, with the APG keys (arrows, Home, End), and
  `<gmt-chips>` uses the same helper. The map shapes stay `role="button"` with
  `tabindex="-1"`.
- **The zone scroller** (`role="region"`, `tabindex="0"`) keeps its name, and gains
  `scroll-padding-block` so a focused zone is never under its sticky header (SC 2.4.11).
- **Tense.** `slotHtml` output keeps the runtime tense: the page reads true before, on and after
  the change date.
- **Delete** `clock-change.css` and `morocco-clock-change.css`, their `customCss` lines, and
  the dead exports. Keep every pure helper and its test.

## Traps

- **Nothing may move while a clock ticks** (`clock-change.css:9-12`). Read that header before
  you move a rule. `readout-still` runs while the clocks tick, as well as under drag.
- **Cause 9b on Morocco** (56 px at 390). The late growth is the Worker answer filling the
  year list and the zone list. Reserve their height from the server-rendered skeleton, which
  knows the row count, and put the fill in `<gmt-grow>`.
- **Below 520 px the map is not drawn** (`zone-map.ts:15`). Check the list and pin panel at
  390 in both themes.
- The probe's fixed id ties the inline script to the template. Use `idScope("canada")` and
  `idScope("morocco")` for the pages, and keep the rail's own prefix in the chat.
- `@property --gmt-zonemap-row` (`clock-change.css:609`) is global by nature. Move it into the
  family module; a registered property is not scoped by CSS Modules, so keep the name.

## Definition of done

1. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` pass, and the legacy lists are
   shorter by every file named above.
2. `rg -n 'gmt-(clockcheck|zonemap|morocco)-' apps/dox/src` returns nothing, and the two sheets
   are gone.
3. Run every gate in Chromium, both themes, at 390 and 1440, on
   `/check/canada-2026-clock-change/` and `/check/morocco-2026-clock-change/`.
   - `canada-clock-still` and `canada-stored-still` pass, with no sideways scroll at 375.
   - `readout-still` shows no movement across 70 s of ticking.
   - **Cause 9b, widget side:** `grow-measure` on Morocco at 390 reports no `jump-over-limit`.
4. With the page's module request blocked in Chromium (`page.route` abort), the "Your browser"
   card still shows the inline probe's verdict at first paint.
5. **Chat rail** mount and abort, and a **permalink** round trip, for both checkers.
6. `html-diff`: every `✗` is named, and the baseline is captured again.
7. No card has a left-border-only accent.
8. `node scripts/verdict.mjs validate` passes.
