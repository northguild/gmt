# Slice 10 — real coastlines and the land around the zones

Owner's request: the Morocco map is "messed up and not realistic". Canada's map has the same
faults, from the same cause, so both maps get the fix from the shared script and `zone-map.ts`.
It runs after slice 4 and before slice 9, whose label anchors and `geoContains` tests use the new
shapes. This is an intended change to the Canada map: slice 1's byte-identical rule for
`timezone-boundaries-canada.json` no longer applies.

## What is wrong, and why

- **Blob islands and a smoothed coast.** The timezone-boundary-builder set includes each zone's
  territorial sea, so the Canaries, Madeira and the Balearics draw as rounded blobs, the Arctic
  islands merge into one, and Hudson Bay is filled in.
- **Land outside the list reads as sea.** Mali, Niger, France, the United States and Greenland
  are not zones of either region, so nothing is drawn there.
- **Cut-off shapes.** Morocco's zones are clipped to the frame plus 1 degree. In the conic, that
  line is a slanted curve inside the box, so Algeria and Mauritania stop short of the box's edge.

## Data: `prepare-region-boundaries.py`

- **Coastline source.** Natural Earth `ne_10m_land` at a pinned tag: `NE_TAG = "v5.1.2"`, from
  `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_TAG}/geojson/ne_10m_land.geojson`.
  It is public domain (the repository's `LICENSE.md`). Document it in the script's docstring
  next to the tbb step.
- **Each zone shape** is `clip_by_rect(zone, *land_frame)` intersected with the land, then
  simplified and oriented as today.
- **One land feature**, written first: `{"type": "Feature", "properties": {"land": "other"},
  "geometry": …}`. It holds the land inside `land_frame` that no zone of the region covers.
  It is the difference, not all the land: drawing all the land under the zones repeats every
  coastline, and Canada's file then goes over its limit.
- **`land_frame`** replaces `frame` plus `margin` as the clip, one per region row. It must cover
  the whole drawn box, so that no shape or land edge ends inside the box. The test below checks
  this. Morocco: the frame plus 3 degrees, as in the prototype. Canada: the bounds of its zones plus enough to fill its box.
  The prototype's Canada bounds −3/+1 degrees left a straight edge across Greenland, so widen it
  and measure again. `frame` stays for dropping zones that miss the frame (Azores).
- **`min_area`** (square degrees) drops land parts smaller than it, from the zones and from the land
  feature. 0 for Morocco. For Canada, start at 0.01.
- **Size.** The formatted file stays under 400 KB, which the existing tests check. If it is
  over, raise the tolerance or `min_area`, and never the limit. Measured in the main session's
  prototype (Canada with the narrow land frame):

  | Region | tolerance | min_area | compact | formatted |
  |---|---|---|---|---|
  | Morocco | 0.005 | 0 | 80 KB | 162 KB |
  | Canada | 0.04 | 0.005 | 237 KB | 479 KB (over) |
  | Canada | 0.05 | 0.01 | 191 KB | 385 KB |

- **Notice.** Keep the ODbL members. Add `"landSource": "Natural Earth v5.1.2, ne_10m_land (public domain)"`.

## Drawing: `zone-map.ts` and `clock-change.css`

- The `land` feature draws first, as one `<path class="gmt-zonemap-land">`. It is `aria-hidden`
  and has `pointer-events: none`. It is not in the zone list, not counted, and has no kind,
  ring or marker. Every function that walks the features to find zones skips it.
- **Fit.** `canadaProjection` fits to the zone features only, so the land feature never changes
  Canada's scale. It also gets `clipExtent` to the box, as Morocco's has. Morocco fits to its frame, which is unchanged.
- **Colour.** The land fill is a neutral step between the sea and the "never changes" fill, from
  existing tokens, with a hairline coast stroke one step lighter. Zone outlines keep at least 3:1
  against the land fill, as they have against the sea (`contrast-measure.mjs` measures it in
  both themes). Forced colours: `Canvas` fill and a `GrayText` stroke.
- **Credits.** `data-credits.ts` gets `COASTLINES`, with the text "Coastlines: Natural Earth (public domain)."
  and links to `https://www.naturalearthdata.com/` and to the tag. Both maps' credits popups list
  it after the time zone boundaries. `data-credits-check.mjs` and `data-credits-built.test.ts` check it.

## Tests

- `boundary-data.test.ts`, for both files:
  - exactly one `land` feature, first, with no `tzid`; the zone ids are unchanged;
  - `landSource` names `ne_10m_land` and the tag;
  - sea points lie in no feature (`geoContains`): Hudson Bay `[-85, 60]`; Canada's Arctic, one
    point in a channel between two islands; Morocco's Atlantic, one point between Tenerife
    and Gran Canaria. Confirm each point is sea in `ne_10m_land` before you use it;
  - land points outside the zones lie in the land feature: Mali `[-3, 22]` and France
    `[2, 44]` for Morocco, and the United States `[-100, 45]` for Canada.
- `zone-map.test.ts`: the land path renders first, is `aria-hidden`, and is never a zone (the list
  count, hover, pin and keyboard order are unchanged).
- Box cover: for each config, sample the box's edge every 10 px, invert each point with the
  projection, and check that it lies inside the region's `land_frame`.

## Definition of done

1. `uv run --with shapely python apps/dox/scripts/prepare-region-boundaries.py --region morocco`,
   then `--region canada`, then `oxfmt --write` on the four files. The tests above pass.
2. `pnpm dox:test`, `pnpm dox:check` and `pnpm dox:lint` are clean.
3. On a build served on port 4351, the layout, clock-still and stored-still checks pass for both
   pages, and so does `contrast-measure.mjs`.
4. Show the owner both maps at 1440 and 1024 px in both themes before slice 9 starts.
5. `built.md` § "Clock-change checker parts": the coastline rule (Natural Earth land, the other-land feature,
   the land frame covers the box), each with a one-line reason. § Boundary data: the source and
   the tag. `issues/CORE-88.md` § Decisions: the Canada map's coastline, in present tense.
