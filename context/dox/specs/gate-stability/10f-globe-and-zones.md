# Slice 10f — the globe, the Zone Planner and the zone controls

This slice moves the last two widgets, the globe and the Zone Planner, onto the kit, with the
zone controls they share and the why-gmt map. Zoned Earth and `/` are #429 pages (the globe's
cause-9b `grew`). Follow the
[migration recipe](./09a-gnss-ids-bridge.md#2--migration-recipe-every-widget-in-9a10f).

## Current state (verified)

| File | Lines | Notes |
|---|---|---|
| `globe-mount.ts` | 215 | template for `/`, `/tools/zoned-earth/` and the rail; zoom `role="group"` `:94`; clocks `role="listbox"` `:128`; queries by `data-role` `:140-155` |
| `globe.ts` | 827 | WebGPU renderer with a canvas-2D fallback; `tooltip.innerHTML` `:483` |
| `zone-planner-mount.ts` | 73 | host only; `initScrubber` fills it |
| `multi-zone-scrubber.ts` | 836 | builds its whole UI with `host.innerHTML` (`:372`) and `createElement`; a fixed `id="scrubber-add"` (`:382`); `rangeFieldHtml` (`:401`); clock faces from `renderCrystalClock` (`:552`) |
| `zone-combobox.ts` | 200 | hand-built combobox (`aria-expanded`, `aria-activedescendant`), used by the globe and the planner |
| `zone-filter-ui.ts` | 302 | native `type="checkbox" role="switch"` (`:83`), a hand-written disclosure (`:113`, `:136`), a `role="status"` count (`:178`) |
| `zone-clock-list.ts` | 447 | listbox of `<button role="option">` rows (`:172-176`) with `aria-activedescendant` |
| `timezone-map.ts` | 302 | TanStack Charts map on `/why-gmt/`; tooltip `content` at `:200` |

- Sheets: `gmt-globe.css` (1128), `gmt-scrubber.css` (420), `gmt-clock-list.css` (201),
  `gmt-crystal-clock.css` (327, now used only by the planner after 10b), and `gmt-map.css` (85;
  3 `nth-*` on the TanStack tooltip rows at `:64`, `:77`, `:83`; slice 8b removed `:53`).
- Shells: `Globe.astro`, `HeroGlobe.astro`, `MultiZoneScrubber.astro`, `TimezoneMap.astro`.
- Tests: `multi-zone-scrubber-mount.test.ts` (`data-role` ×19), `zone-planner-mount.test.tsx`
  (×4), and the pure globe, zone and scrubber tests.

## Kit additions (before the widgets)

Each gets the 8a layout and tests, axe included.

| Piece | Replaces | Pattern |
|---|---|---|
| `<gmt-combobox>` | `zone-combobox.ts` | APG [Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/), editable with list autocomplete. The popup is a `<gmt-listbox>`. |
| `<gmt-listbox>` | `zone-clock-list.ts` row wiring, the globe clocks panel | APG [Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/), single select, `aria-activedescendant`. Options are `role="option"` elements, not buttons. |
| `switchField({ label })` | the filter switches | a native `<input type="checkbox" role="switch">` with its label |
| `disclosure({ label })` | the filter summary | APG [Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/): a button with `aria-expanded` and `aria-controls` |

## Files and changes

- **globe-mount.ts** builds its chrome from the kit: `widget`, the zoom group of buttons, the
  filters (`switchField`, `disclosure`, a `<gmt-readout>` count in place of `role="status"`),
  and the clocks as `<gmt-listbox>`. Lookups use the scope's ids. The canvas and the renderer
  in `globe.ts` stay; the tooltip uses `setHtml` with a `zoneTooltip` builder.
- **multi-zone-scrubber.ts** gets a `renderTemplate` like every other widget, so the rail and
  the page render the same markup through the kit. `initScrubber` becomes the mount. The fixed
  `scrubber-add` id goes (a planner on the page and one in the rail collide today). The slider
  is `<gmt-range>`, the add field is `<gmt-combobox>`, the faces use the 10b clock builder, and
  the rows are built with builders, not `createElement` and `innerHTML`.
- **zone-planner-mount.ts** calls that `renderTemplate`. Its lazy import stays, so the planner's
  tables stay out of the chat's first download.
- **timezone-map.ts.** The tooltip `content` returns a `mapTooltip` builder's markup (title,
  then one row per fact, each with its own class), so the three `nth-*` rules in `gmt-map.css`
  become classes. The tooltip's shell stays in a named global sheet (third-party DOM, 10a rule).
- **Shells** mount by `[data-widget]`.
- **Delete** `zone-combobox.ts`, the row wiring in `zone-clock-list.ts` (keep `zoneOptionId`
  and `nextActiveIndex` as pure helpers with their tests), `gmt-globe.css`, `gmt-scrubber.css`,
  `gmt-clock-list.css`, `gmt-crystal-clock.css`, and the `gmt-map.css` rules that moved.

## Traps

- **Cause 9b on the globe** (`grew` 25 px at 390 and 1440). The globe stage and the clocks
  panel take their size after the renderer starts. Give the stage an `aspect-ratio` and the
  panel a reserved block size in the module, so the root has its final size at first paint.
- `HeroGlobe.astro` embeds the globe on `/` with its own heading (`embedded`). Keep that
  option, and check `/` at 390 and 1440 in both themes.
- `globe-contrast.test.ts` and `globe-inks.ts` hold measured inks for the canvas. They are not
  CSS; leave them.
- The planner test drives the scrubber through `data-role` ×19. Map each to a role and name:
  the slider by its label, the add field by `getByRole("combobox", { name: "Add a zone" })`.
- The combobox popup must stay below the input and inside the rail at its narrowest width.

## Definition of done

1. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` pass, and the legacy lists are
   shorter by every file named above.
2. `rg -n 'gmt-(globe|scrubber|clock-list|crystal|combobox)-|id="scrubber-add"' apps/dox/src`
   returns nothing, and `rg -n 'nth-' apps/dox/src/styles/gmt-map.css` returns nothing.
3. Run every gate in Chromium, both themes, at 390 and 1440, on `/`, `/why-gmt/`,
   `/tools/zoned-earth/` and `/tools/zone-planner/`. `readout-still` passes while scrubbing.
   **Cause 9b, widget side:** `grow-measure` reports no `grew` on the globe root.
4. **Keyboard:** the APG keys work on `<gmt-combobox>` and `<gmt-listbox>`, with jsdom tests.
5. **Chat rail** mount and abort, and a **permalink** round trip, for the globe and the
   planner, with a globe on the page and one in the rail at the same time.
6. `html-diff`: every `✗` is named, and the baseline is captured again.
7. No card has a left-border-only accent.
8. `node scripts/verdict.mjs validate` passes.
