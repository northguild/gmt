# Slice 9 — map labels, and the map fitted to its box

Owner's request: the zone maps look generic. Both maps, Canada's and Morocco's, get place labels
and lose the band of empty sea around the drawing. Everything here is in the shared parts
(`zone-map.ts`, `clock-change.css`), so both checkers get it from one place. It runs after slice 10,
whose shapes its anchors and tests use.

## Labels

- **Which zones.** The zones with a live clock beside the map carry a permanent label: Canada's
  Vancouver, Edmonton, Inuvik, Winnipeg and Toronto, and Morocco's Casablanca and El Aaiun. The
  config names them (`labelled: string[]`, taken from the clocks' zone list, not typed twice).
  Every other zone shows the same label while it is hovered, focused or pinned. At most one
  passing label shows at a time, and a pinned zone's label stays.
- **What a label says.** The city part of the IANA id, with `_` as a space (`EL AAIUN`), in the
  display face (`--gmt-font-display`, capitals), and under it the zone's offset in
  `--gmt-font-mono` with tabular figures. The offset comes from the same value the zone list
  shows (`offsetAt`, from the Worker's answer), so the map and the list never disagree. With no
  answer, the offset line shows the list's `NO SIGNAL` mark.
- **Where.** Each labelled zone gets a stated anchor (`[lon, lat]`) in its region's config, chosen
  inside the land. A centroid is not used: it can fall outside a concave shape. A passing label
  sits at the hovered shape's anchor if it has one, otherwise at the point of its largest part
  that is farthest from the edge (a pole of inaccessibility, computed once per draw).
- **The approved look** (owner, from a mock on the Canada page): city at 11.5 CSS px in a near-white
  ice, offset at about 12 CSS px in a light cyan one step dimmer, centred under the city, a 3 px
  sea-coloured halo at 85% opacity. Take the colours from existing tokens, not new literals.
- **Size.** The text stays 11 to 12 CSS px at every frame width. It does not scale with the
  drawing, so either an HTML overlay positioned from the projection or SVG text whose size is set
  from the drawing's scale.
- **Legible on every fill.** The text has a halo in the map's sea colour (`paint-order: stroke`,
  or `text-shadow` on an overlay). Text against halo meets 4.5:1 in both themes;
  `contrast-measure.mjs` checks it. Forced colours: `CanvasText` on a `Canvas` halo.
- **Quiet for assistive tech and the pointer.** Labels are `aria-hidden` (each shape already has
  its `aria-label`) and `pointer-events: none`, so they never steal a click from a shape or ring.
- **Holds still.** A label's offset line reserves its width, so a new offset never shifts the
  city name. Showing or hiding a label moves nothing outside the map.

## Fit the map to its box

- Today, at 57rem and wider, the map frame stretches to the row's height, so Canada's drawing sits
  in a tall band of empty sea (measured at 1440 px: frame 436 × 791, drawing about 436 × 350).
- **Rule:** at every width where the map is drawn, the frame's aspect ratio is the drawing's own
  (800 / the config's height), within 2%. The cards beside it no longer stretch it.
- **No empty card space instead.** The reason for the stretch was that no card has empty space
  under its content. Keep that: no card in the row has more than 48 px of empty space under it.
- **One row of three, bounded (owner's request).** Map, zone card and live clocks share one row
  wherever three columns fit, for both maps. The row's height is bounded (about 28rem at 1440 px)
  and the map's width follows from that height and the drawing's aspect, so a map is never
  "massive". Where three columns do not fit (a container query on the checker, so the chat rail
  stacks too), they stack: map, zone card, clocks, with the map capped at about 70vh.
- No horizontal scroll at any width, and the map's box is still reserved before it draws (no
  layout shift when the boundaries arrive; the `enter()` gesture is unchanged).

## Tests

- `zone-map.test.ts`, for both configs, at the frame widths 400, 600 and 800:
  - no two permanent labels' boxes intersect, and none intersects a marker ring or crosses the
    frame's edge;
  - every anchor lies inside its zone's shape (`geoContains`);
  - each label's text is the city name and the offset from `offsetAt`, or the `NO SIGNAL` mark;
  - hovering a shape shows exactly one passing label; pinning keeps it; unpinning removes it.
- `canada-layout-check.mjs` gains the aspect check and the 48 px empty-space check, and runs on
  both pages (`--path`).
- `contrast-measure.mjs` measures the label text on its halo in both themes.

## Definition of done

1. `pnpm dox:test` passes, including the tests above.
2. Against a build served on port 4351, `canada-layout-check.mjs` passes for both pages at 1440,
   1024, 520 and 375 px, and `canada-clock-still.mjs` and `canada-stored-still.mjs` pass for both
   (0 px of movement while the clocks tick and results arrive).
3. `contrast-measure.mjs` passes.
4. The visual snapshots of both pages change only in the map section. Show the owner screenshots of
   both maps at 1440 and 1024 px in both themes, then take a new visual baseline.
5. `html-diff.mjs compare /tmp/core89-before` with slice 1's rename prints no `✗` for the Canada
   page's text (labels are drawn at run time, so the static markup changes only if a frame
   attribute changes; list any such change in the hand-back).
6. `pnpm dox:check` and `pnpm dox:lint` are clean.
7. `built.md` § "Clock-change checker parts": the label rule (which zones, what text, why a stated
   anchor) and the fit rule (frame takes the drawing's aspect; the row arrangement follows the
   map's shape), each with a one-line reason.
