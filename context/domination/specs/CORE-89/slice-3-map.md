# Slice 3 — the regional map

The map shows Morocco's two zones next to the zones of its neighbours, and next to Spain and
Portugal across the Strait of Gibraltar. It does not show zones inside Morocco. The shared
`zone-map.ts`, the boundary script, the credits button, the keyboard zone list and the 520 px
fallback all come from slice 1. This slice adds only data and one config. Every boundary-data and
credits rule from [CORE-88's decisions](../../issues/CORE-88.md#decisions) applies:
- the pinned release;
- the ODbL members;
- a size budget;
- the native `popover` credits button in the drawing's corner.

## Zones

**Rule:** take each tzdb 2026e `zone.tab` row whose country is `MA`, `EH`, `DZ`, `MR`, `ES`, `PT`
or `GI` and whose timezone-boundary-builder 2026e shape meets the frame.
- **Countries.** These are Morocco and Western Sahara, their land neighbours (Algeria and
  Mauritania), and the three territories across the Strait.
- **`zone.tab`, not `zone1970.tab`.** In `zone1970.tab`, Mauritania is folded into
  `Africa/Abidjan`, a zone whose shape covers twelve countries. This is the same reason Canada
  uses `zone.tab`.
- **Checked on 2026-10-23.** All 10 zones below exist both in `zone.tab` 2026e and in the
  tbb-derived `timezone-boundaries-globe.json`, which is pinned to 2026e. `Atlantic/Azores` is a
  `PT` row, but its shape lies west of the frame, so the rule leaves it out.

The classes follow CORE-88's rule, from `getDstTransitions` for 2026 and 2027. They were measured
on Node 26.12.1 (tz 2026e):

| Zone | Class | 2026 changes (UTC) | 2027 |
|---|---|---|---|
| `Africa/Casablanca`, `Africa/El_Aaiun` | stopped changing in 2026 | 02-15, 03-22, 09-20 01:00 | none |
| `Europe/Madrid`, `Africa/Ceuta`, `Europe/Gibraltar` | still changes in 2027 | 03-29, 10-25 (+01/+02) | 03-28, 10-31 |
| `Atlantic/Canary`, `Europe/Lisbon`, `Atlantic/Madeira` | still changes in 2027 | 03-29, 10-25 (+00/+01) | 03-28, 10-31 |
| `Africa/Algiers` (+01), `Africa/Nouakchott` (+00) | no change in 2026 or 2027 | none | none |

- **The two stopped zones are drawn from stated facts.** The map takes them from the page's
  2026c facts (`ZoneMapConfig.stopped`), not from the runtime, as Canada's map does. A Worker
  with old data returns them as `changes-2027`. The shared `isDataStale` then shows its one line
  above the clocks, and the saved-events check marks those zones "can't check yet".
- **Every other zone keeps the class its row carries.** No tzdb release from 2026c to 2026e
  changes them, so every runtime agrees on them.
- **No hand-typed classes.** No test, fixture or table in the code types a class. This table is
  for the spec only.

## Frame and projection

- **Frame:** longitude −19 to 5, latitude 20.5 to 44.5. It covers the Canary Islands and
  Madeira, all of Iberia, Morocco and Western Sahara down to 20.8°N, and the northern parts of
  Mauritania and western Algeria. Shapes are clipped to the frame plus a 1° margin by the script
  (`shapely.clip_by_rect`), and to the frame itself in the drawing.
- **Projection:** Lambert conformal conic, two standard parallels.
  - The method is EPSG method 9802, defined in IOGP's EPSG Guidance Note 7-2 and implemented by
    d3's `geoConicConformal`.
  - Parameters: standard parallels 24.5°N and 40.5°N (one sixth of the frame's latitude span in
    from each edge), central meridian 7°W, latitude of origin 32.5°N. Fit it to the frame with
    `fitExtent`.
  - It is conformal like Canada's map, so the shapes keep their form.
- **No EPSG projected CRS** covers Morocco, Western Sahara, Iberia, the Canaries and Madeira
  together. Confirm that at `https://epsg.org` with a search by area that includes both Morocco
  and Spain. If one exists, use it, and cite its EPSG code in the JSDoc the way
  `canadaProjection` cites EPSG:3347.
- **Size:** the drawing's height is the frame projected at width 800, rounded to the nearest
  10 px. As built: 861 px, so `ZoneMapConfig.height` is 860. The projection is fitted to the
  frame's sampled edge (every half degree), not to the data, with no inset, and sets
  `clipExtent` to the box. The map's CSS box is `aspect-ratio: 800 / var(--zonemap-map-height, 640)`,
  so slice 4's markup sets `--zonemap-map-height: 860` on the `data-role="map"` frame.

## Small zones

`Europe/Gibraltar` and `Africa/Ceuta` (Ceuta and Melilla) draw only a few pixels wide.
- **A ring for small shapes.** When a zone's largest drawn part (one polygon of a
  MultiPolygon, in drawing px) is under `markerMinPx: 12`, the shared map also draws a 12 px
  ring at the zone's `zone.tab` coordinate. The test is on the largest part because
  `Africa/Ceuta` is two specks that span far more than 12 px together. It is a `tabindex="-1"`
  button, as the shapes are, so a pointer can reach the zone. The zone list stays the keyboard
  path.
- **Coordinates come from `zone.tab`.** The script writes them into `morocco-region-zones.json`
  as `coords: { "<id>": [lon, lat] }`. Nothing types a coordinate by hand. Canada's region config
  sets `coords: False`, so its file does not change.
- **Melilla.** The `Africa/Ceuta` coordinate is Ceuta itself. Melilla draws only as its own small
  shape.

## No country borders

The map draws the zone outlines only, with no country-border layer, for two reasons:
- **Each country in the region is one zone**, so its zone outline is already its border. The
  exceptions are Spain's islands and enclaves and Portugal's Madeira, which are zones of their own.
- **The `Africa/Casablanca`/`Africa/El_Aaiun` line is tzdb's split**, drawn by tbb from
  OpenStreetMap. It is the only line inside Morocco and Western Sahara, and it marks a time-zone
  boundary.

A country layer would add no line that a reader needs, and no data source or licence beyond
the ODbL one.

## Files

- `scripts/prepare-region-boundaries.py`: every `REGIONS` row now has `countries`, `frame`,
  `margin`, `tolerance`, `budget`, `coords`, `boundaries` and `zones`. Add `REGIONS["morocco"]`:
  - `countries` = the seven codes above;
  - `frame` = (−19, 20.5, 5, 44.5) with a 1° clip margin;
  - `tolerance` 0.005° (built: 44,532 bytes compact, 87,169 formatted);
  - `coords: True`;
  - budget 300 KiB compact (the formatted file must stay under 400 KB);
  - outputs `public/timezone-boundaries-morocco.json` and `src/lib/morocco-region-zones.json`
    (`{ tzdb, zones, coords }`).

  If the file is over budget, raise the tolerance to 0.01°. Never raise the budget. The file
  keeps the same `NOTICE` members (`source`, `attribution`, `license: "ODbL-1.0"`, `licenseUrl`).
- `src/lib/morocco-clock-change.ts` (made here as a stub, because the map needs the stopped
  set before slice 2 runs): `MOROCCO_ZONES`, `MOROCCO_RELEASE`, `MOROCCO_STOPPED` and
  `MOROCCO_KIND_LABELS`. Slice 2 adds the probe, the stated changes and the rest to it.
- `src/lib/morocco-map.ts`: `moroccoProjection()` and `MOROCCO_MAP: ZoneMapConfig`:
  - `idPrefix: "morocco"`;
  - `boundariesUrl: "/timezone-boundaries-morocco.json"`;
  - `stopped` = `MOROCCO_ZONES`;
  - `releaseOf` gives `"2026c"` for the stopped zones;
  - `releaseRange: "2026c to 2026e"`;
  - `markerMinPx: 12`, with `markers` from `coords`.
- **Credits:** the shared `TZ_BOUNDARIES` credit with corner placement and id
  `morocco-data-credits`. Put the button in the top-left corner, which is open Atlantic, and
  check at 520 px and at 800 px that no shape or ring sits under it.
- **Credit checks:** the Morocco rows in `scripts/data-credits-check.mjs`
  (`frame: ".gmt-zonemap-map"`, scoped to the Morocco root) and `scripts/data-credits-built.test.ts`
  need the page, so **slice 4 adds them** with the page; both gates read the built page and fail
  on a missing one.
- `src/lib/morocco-map.test.ts`:
  - every id in `morocco-region-zones.json` has exactly one feature, and Azores has none;
  - the file carries the four `NOTICE` members, `source` names `2026e`, and its size is under
    the budget;
  - the projected box of the frame fits 800 × `height`, and Casablanca's coordinate projects
    inside it;
  - `markers` has entries for exactly the ids that `coords` lists;
  - mounting at a width under 520 fetches nothing (a stub `fetch` that throws) and still renders
    the list.

## Definition of done

1. `uv run --with shapely python apps/dox/scripts/prepare-region-boundaries.py --region morocco`
   exits 0 and prints the compact size. Then run
   `pnpm exec oxfmt --write apps/dox/public/timezone-boundaries-morocco.json apps/dox/src/lib/morocco-region-zones.json`,
   and `wc -c apps/dox/public/timezone-boundaries-morocco.json` reports under 409600 bytes.
2. `node -e 'const z=require("./apps/dox/src/lib/morocco-region-zones.json");console.log(z.zones.length, z.tzdb)'`,
   run from the repo root, prints `10 2026e`.
3. `--region canada` still leaves `git diff --exit-code -- apps/dox/public/timezone-boundaries-canada.json apps/dox/src/lib/canada-zones.json`
   at exit 0.
4. `pnpm --filter @gmt/dox exec vitest run src/lib/morocco-map.test.ts src/lib/zone-map.test.ts --reporter=verbose`
   passes.
5. (Slice 4 runs lines 5 and 6: they need the page.) On the served build: the zone list is one tab stop. The arrow keys,
   Home and End move through it, and Enter pins a zone. Pressing the Gibraltar ring pins
   `Europe/Gibraltar`. At 375 px no map is drawn, the list stays, and there is no horizontal
   scroll. The pin panel's readouts do not move while the clocks tick: a bounding-box test over
   60 s of ticks shows 0 px of movement.
6. `node apps/dox/scripts/data-credits-check.mjs` passes for both pages. At 375 px the Morocco
   credits panel opens inside the viewport and covers no control.
7. Classes are words plus a pattern (hatch, solid, dots), never colour alone. Forced colours keep
   all three distinguishable, per the shared rules in `gmt-a11y.css`.
8. `built.md`'s Morocco entry gives the zone rule, the frame, the projection and its authority,
   and the absence of a country layer, each with its one-line reason.
