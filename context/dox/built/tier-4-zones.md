# Tier 4: zones, scrubber, boundary data

Part of [built/index.md](index.md). Globe engine and hero: [tier-4-globe.md](tier-4-globe.md).

## Zone readout and clocks

- DST answers are never cached (`src/lib/zone-clock.ts`). The library's rule reads the zone's transitions around the instant, so no key of zone, year and offset is complete (`America/Asuncion` at -03:00 is daylight time in January 2024 and not in December 2024). `hasDaylightSaving` is asked with `{ at }` for the instant read.
- `src/lib/zone-readout.ts` is the one vocabulary the globe tooltip and the clock list render from: time in `--gmt-cyan-ink`, UTC offset in `--gmt-spring-ink`, DST as a gold `DST` badge. All are `-ink` tokens because they are text. Amber is the NO SIGNAL sentinel's alone.
- Gold means daylight saving and nothing else; cyan is on and selected, spring the UTC offset, purple the day shift. The local-sky bands are not colour-coded: their sun, horizon and moon glyphs carry them. DST is marked in text (a `DST` badge, like the DST Inspector's `Gap` and `Overlap`), never a sun: the globe paints night markers `--gmt-globe-gold`.
- Local sky (`src/lib/zone-sky.ts`): solar elevation is 90 degrees minus the great-circle angle to `subsolarPoint`, so tooltip and terminator agree. Daylight is above -0.833 degrees, twilight down to -18, night below. It answers for the zone's representative coordinate. It is pure trigonometry, cheap on every tick.
- DST has three states and one draws nothing: sun in DST, moon for standard time in a zone that observes it, no glyph for a zone with no DST rules. Glyphs follow `transport-icons.ts`.
- A zone whose day differs from the viewer's shows its date plus a `+1d` or `-1d` chip and a purple wash; the tooltip spells out "Yesterday" or "Tomorrow". Direction is in text, never the wash alone. The label states the real difference (Kiritimati and Midway can be `+2d`) while the filter uses three buckets; never derive the label from the clamped bucket.
- Wash alphas are a measured ceiling. Use `--gmt-dst-purple-ink`, not `--gmt-purple-ink` (its dark value falls under 7:1). Re-measure if either changes.
- Day arithmetic is integer: `dayDelta` uses Hinnant's days-from-civil, never `Date`. Offsets span 26 hours, so two zones can be two calendar days apart; a +-1 check is wrong for exactly that pair.
- Zone coordinates are vendored from tzdata by `scripts/prepare-tz-coordinates.mjs`; refresh when tzdata releases.

## Zone filters (`src/lib/zone-filter.ts`, `zone-filter-ui.ts`)

- A settings gear named "Settings" opens a popup of nine switches over three axes: local day, DST state, local sky. They narrow the clock list, the globe markers and the region hit test. The selected zone keeps its marker. A separate fieldset holds "Natural colours" (`setLookAvailable`); it is not a filter.
- The popup is a floating `<details>` with our own dismissal (press outside or Escape returns focus to the gear). Its width is capped to `100cqi` (`disclosure.module.css`), never the viewport, or a drawer clips its left edge from 320 to 3008 px.
- A switch is shown when its bucket has zones or when it is off, so a filter can never become unreachable.
- Switches are built once and afterwards only shown, hidden or relabelled; re-rendering would pull a control from under a keyboard user.
- A rescan that changes nothing touches nothing: `applyFilter` compares the new zone list with the last and only then calls `setIds` (which returns the list to the top). Without the guard the reader was thrown back to the first zone every minute.
- Bucketing costs about 11 ms warm, so `globe.ts` skips the scan while the panel is closed and no filter is on, and otherwise runs it at most once a minute.
- Trap: change the list's scroll through the virtualizer, not `scrollTop`. TanStack learns its position from an async observer, so a synchronous render after a programmatic scroll can paint nothing. `setIds` scrolls via the virtualizer and renders again next frame.

## Scrubber (`src/lib/multi-zone-scrubber.ts`, `/tools/zone-planner/`)

- Mounted in the chat rail by `src/lib/zone-planner-mount.ts` (`showZonePlanner`). Permalink: tier 2, tools file.
- Opening set: with no link or call naming zones, `openingPins` pins the reader's zone first (`getSystemTimeZone`), then Reykjavik, Helsinki, Los Angeles, Shanghai, Calcutta, Katmandu; at most eight; a duplicate moves to first place by canonical id. A zone with no coordinate, or the sentinel, leaves the tour unchanged, because `decodeState` drops ids without one and the share link would not reproduce the screen. A link or chat call that names zones is shown as given.
- Reference time: now rounded up to the next 5 minutes in UTC (`roundUnix`). The server renders no time (built at mount inside `.gmt-grow`). A permalink's or call's `time` is kept. `initScrubber` takes `now` so tests inject the clock.
- DST at the scrubbed instant (`src/lib/scrubber-dst.ts`) is computed from the library on each step: `isInDaylightSaving` through `zone-clock` (uncached) and `getDstTransitions` (cached per zone and year). No typed dates or hand-rolled offset arithmetic. A tile always states `DST`, `Standard time` or `No DST` in words. A crossed switch shows `Spring forward +1 h` or `Fall back -1 h` (`+30 min` for Lord Howe). A transition is any offset change the library lists (so Casablanca's Ramadan changes show). State and switch each have one reserved line, so nothing resizes while dragging; one settled `role="status"` message (500 ms) names crossed switches.
- Jump to the next DST transition goes to the earliest switch strictly after the scrubbed instant among shown zones, up to two years ahead. It lands the reference an hour before the switch and the slider two hours along, so a second press moves on. With none ahead the button is disabled and a line says so. The status line holds two lines.
- Reset to today sets the reference to now (rounded up, read at the press) and the slider to 0.

## Boundary data (CORE-88)

- Data files in `src/assets/` (loaded by `?url`, so each has a hashed `/gmt/_astro/` URL) from timezone-boundary-builder (tbb), derived from OpenStreetMap: `timezone-boundaries.json` (10 CI zones, 0.02 degrees), `timezone-boundaries-globe.json` (every zone, 0.2 degrees), `timezone-boundaries-canada.json` (0.08 degrees), plus region files for Morocco and the United States (`timezone-boundaries-us.json`). Region files also carry Natural Earth land: `NE_TAG` (script and `data-credits.ts`) `v5.1.2`, `ne_10m_land`, public domain, named in `landSource` and credited as "Coastlines". The US adds `state-boundaries-us.json` (56 shapes from Natural Earth admin-1 and admin-0, keyed by postal code, credited as `STATE_BOUNDARIES`).
- One pinned release: every `prepare-*-boundaries.py` reads `releases/download/<TBB_TAG>/` (never `latest`). `TBB_TAG` in `src/lib/data-credits.ts` is the same tag; `scripts/boundary-data.test.ts` holds the files to it.
- The Canada set is `zone.tab`, not `zone1970.tab`: rows whose country column is exactly `CA`. `zone1970.tab` lists `America/Toronto` (CA,BS), `Panama`, `Puerto_Rico` and `Phoenix`, whose shapes cover other countries, and tbb has no outline to clip with. The script exits non-zero if a selected id has no feature. `src/lib/canada-zones.json` is generated with it, so the zone list is never typed.
- The ODbL notice is in the file: each carries `source`, `attribution`, `license: "ODbL-1.0"` and `licenseUrl` as GeoJSON foreign members (RFC 7946 6.1), worded after tbb's README at the pinned tag.
- Budget: the Canada file stays under 400 KB (0.02 degrees: about 98 KB compact, 184 KB after `oxfmt`, which the format check requires). Run by hand with `uv run --with shapely python scripts/prepare-*-boundaries.py`, then `pnpm exec oxfmt --write` on the output.

## Data credits (CORE-88)

- The credit sits on the drawing it credits: an info button opening a popup, one source per entry. Nothing else on the page names sources.
- `renderDataCreditsHtml(credits, { id, placement })` in `src/lib/data-credits.ts` returns a native `<button popovertarget>` and its `popover`, shared by Astro shells and plain-DOM mounts. `id` is unique per mount. Placement `stack` is the globe's fourth button (boundaries and imagery, on `/`, `/tools/zoned-earth/` and the chat `globe` widget). Placement `corner` is a 2rem glass square bottom-right of a map with no stack (boundaries only): `TimezoneMap.astro` on `/why-gmt/` (in `data-gate="credited-frame"`), the zone map (`zone-map.ts`, `zoneMapShell`) and the chat `canadaclock` widget (`data-credits-id` carries the `idPrefix`-based id).
- Trap: `aria-expanded` is kept by script. WebKit does not report a `popovertarget` button as expanded when its panel is open, so the button carries `aria-expanded="false"` and `watchDataCredits()` (one capturing `toggle` listener, called by `mountGlobe`, `zone-map.ts` and `TimezoneMap.astro`) sets it from `newState`.
- Native popover gives Escape, outside click and focus return. Anchoring uses `position-anchor: auto` (Chromium resolves `anchor()` only with it set); the panel sits 12 px inside the viewport, never over the buttons, and flips when it would leave. Without anchor positioning it pins to the viewport's bottom edge.
- Colour: glyph `--gmt-ice` on `--gmt-surface-2`; hover, focus and open `--gmt-void` on `--gmt-cyan-ink`. `data-credits.test.ts` recomputes both pairs in each theme (3:1, WCAG 1.4.11). Forced colours use system button colours and a `Highlight` outline.
- Gates: `scripts/data-credits-built.test.ts` asserts the HTML (the globe's button last in its stack on `/` and `/tools/zoned-earth/`, the map's on `/why-gmt/`, none on the Canada page, none elsewhere). `scripts/data-credits-check.mjs` serves a build at 1280 and 375 px in Chromium and WebKit: Tab reaches the button (WebKit presses Option+Tab, because Safari on macOS leaves buttons out of plain Tab), Enter opens it with expanded true, Escape closes it and returns focus, the panel is inside the viewport and covers no control, and at 375 px the Canada page has no button.
