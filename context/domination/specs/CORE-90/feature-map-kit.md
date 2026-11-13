# Slice 1 — feature-map-kit: one classed map, keyed by any feature property

Index: [index.md](index.md). Rules: [built.md](../../../dox/built.md) § Binding rules and the
CORE-89 "shared checker parts" section, plus the Canada and Morocco map traps. Read
`apps/dox/src/lib/zone-map.ts` in full before starting. It is about 1,000 lines, and
`runZoneMap` makes up about 560 of them.

## Why a kit addition

`wireZoneMap` is shaped around a checker. Its config takes `stopped`, `releaseOf`,
`releaseRange`, a `TenseView` and Worker `MapZone` rows, and its features are keyed by `tzid`.
The Sunshine Protection Act page needs the same drawing, list, pin and narrow fallback for two layers: zones keyed
by `tzid`, and states keyed by `postal`. The classes and pin text come from the page. **Do not
copy the drawing into a second module.** Move the general part out once, and leave
`wireZoneMap` as a checker config over it.

## `apps/dox/src/lib/feature-map.ts` (new)

What moves out of `zone-map.ts`, unchanged in behaviour:

- `MAP_WIDTH`, `NARROW_PX` and the width check that skips drawing and fetching below 520 px.
- `BoundaryCollection` and the land feature `{"land":"other"}`, drawn first and under the rest.
- Fetching the boundary file through `deps.fetch` with the mount's `signal`, then drawing each
  feature as a `role="button"` path with `tabindex="-1"`.
- The roving list (`roving`) of `<button data-feature-id>` with `aria-pressed`. Arrow keys move
  and wrap, Home and End jump, Enter or Space pins. The list stays the only keyboard path.
- Pin and unpin, the announce region, the pin panel's reserved size and the narrow-width
  scroll-into-view.
- Labels (`labelLayer`, `labelMarkup`, `zone-map-labels.ts`; text at least 12 px), marker rings
  for tiny features (`markerMinPx`, `largestPartPx`) and the data-credits button.
- `root.dataset.state = "ready"` once drawn or listed.

```ts
export interface FeatureMapConfig {
  idPrefix: string;
  height: number;
  boundariesUrl: string;
  /** The feature property that keys a shape: "tzid" or "postal". */
  featureKey: string;
  projection: (b: BoundaryCollection, w: number, h: number) => GeoProjection;
  /** A second file drawn over the shapes, aria-hidden and not interactive (zone lines). */
  overlayUrl?: string;
  /** The class a feature is drawn in; a CSS class name the page's module defines. */
  classOf: (id: string) => string;
  /** Words for the list row and the pin title. */
  nameOf: (id: string) => string;
  /** Fills the page's pin fields; null clears them. */
  onPin: (id: string | null) => void;
  mapLabel: string;
  labelled: readonly string[];
  anchors: Readonly<Record<string, readonly [lon: number, lat: number]>>;
  creditsCorner: Extract<DataCreditsPlacement, "corner" | "corner-start">;
  markerMinPx?: number;
  markers?: Readonly<Record<string, readonly [lon: number, lat: number]>>;
}
export function wireFeatureMap(
  widget: FoundWidget, ids: readonly string[], signal: AbortSignal,
  deps: FeatureMapDeps, config: FeatureMapConfig,
): FeatureMapHandle; // { pin(id | null), destroy() }
```

`FeatureMapDeps` is the subset of `ZoneMapDeps` the core uses (`fetch`, `matchMedia`,
`ResizeObserver` as they are injected today). Every timer, observer and listener is bound to
`signal`, and `destroy()` aborts a child controller. Draw nothing after an abort.

## `apps/dox/src/lib/zone-map.ts` (changed)

`wireZoneMap(widget, zones, signal, deps, config)` keeps its signature and every export the
checkers import. It builds a `FeatureMapConfig` with `featureKey: "tzid"`. `classOf` is
`displayKind`, `onPin` fills the checker's pin fields and clock, and the rest is passed through.
The checker code (stale rows, tense view, live clock, release words) stays in this file.
`isZoneFeature` and `zonesOnly` stay exported, as thin wrappers over the core's key test.

**Byte-identical guard.** Canada and Morocco must render the same HTML and behave the same:

- Before the move, build Dox and run `node scripts/html-diff.mjs capture <dir>` in
  `apps/dox`. After it, rebuild and run `compare <dir>`. Neither checker page may change.
- `zone-map.test.ts`, `canada-map.test.ts`, `morocco-map.test.ts` and
  `clock-change-second-config.test.ts` pass unedited. If one needs an edit, the extraction
  changed behaviour. Fix the extraction, not the test.

## Builders: `widgets/families/clockcheck/zone-map.ts` (changed)

- `featureListParts(index)`: the general form of `zoneListParts`. The row button carries
  `data-feature-id`. `zoneListParts` becomes a wrapper that also writes `data-tz-id`, so checker
  markup does not change.
- `viewSwitch({ id, legend, options })` (new, kit addition). APG Radio Group built from **native**
  `<fieldset>`, `<legend>` and `<input type="radio">`, so the browser supplies the arrow keys and
  the single tab stop. It is styled as a segmented control: full border, bevel corners
  (`corner-shape: bevel`), a checked segment with an inset bottom accent. No left edge. Labels
  are 12 px or larger. Forced colours: the checked segment uses `Highlight` and `HighlightText`.
  The page script finds it by `data-role="view-switch"`.

No widget writes raw markup. Every tag comes from a builder.

## `apps/dox/src/lib/us-projection.ts` (new)

`geoUsComposite()` returns a composite equal-area projection, modelled on d3-geo's `albersUsa.js`
(ISC; credit it in the file header). It implements `stream`, `invert`, `scale`, `translate` and
`fitExtent`, so `geoPath` and the core's fitting use it like any other projection.

| Part | Projection | Parameters |
| ---- | ---------- | ---------- |
| Lower 48 and DC | `geoConicEqualArea` | parallels 29.5, 45.5; rotate [96, 0]; centre [-0.6, 38.7] (EPSG:5070) |
| Alaska | `geoConicEqualArea` | parallels 55, 65; rotate [154, 0]; centre [-2, 58.5] (EPSG:3338) |
| Hawaii | `geoConicEqualArea` | parallels 8, 18; rotate [157, 0]; centre [-3, 19.9] |
| Puerto Rico and US Virgin Islands | `geoConicEqualArea` | parallels 8, 18; rotate [66, 0]; centre [0, 18.2] |
| Guam and Northern Mariana Islands | `geoConicEqualArea` | parallels 8, 18; rotate [-145, 0]; centre [0, 16] |
| American Samoa | `geoConicEqualArea` | parallels -8, -18; rotate [170, 0]; centre [0, -14.3] |

- The insets sit along the bottom edge, each in its own frame: a thin full border with bevel
  corners, drawn by the page as `aria-hidden` paths. A clip extent per part, as in `albersUsa`,
  keeps one part's geometry out of another's box. Alaska is scaled to 0.35 and Hawaii to 1, as
  in `albersUsa`, and the caption says insets are not to scale.
- Midway and Wake are not drawn. Each is a list row, and a caption under the map says so.
- Equal-area because the Proposals view is a choropleth of states. Both views use the same
  projection, so the two layers line up.
- Test `us-projection.test.ts`. Assert that:
  - known points land in their own part's clip box: Denver, Anchorage, Honolulu, San Juan,
    Hagåtña and Pago Pago;
  - `invert(project(p))` returns `p` within 1e-6° for each of those points;
  - no two clip boxes overlap.

## APG and keyboard

- View switch: Radio Group, using native radios with no script for the keys.
- Feature list: toggle Button (`aria-pressed`) with a roving tabindex, as on the checkers.
- Map shapes: pointer only. The list is the keyboard path, and the map stays `aria-hidden="false"`
  with an `aria-label` from `mapLabel`.

## Traps from built.md that apply

- No `:has()` on page-level boxes. Text is at least 12 px. Colour goes on marks, never on text.
  Every class also has a pattern or a word.
- Widget CSS is pruned per page, so new rules live in the family's CSS Module.
- Forced-colours rules are written by hand in the module, one per new class. Patterns survive
  forced colours.
- Map row container query at 62rem (`--gmt-zonemap-row`). Reuse it and do not add a breakpoint.
- Tests never touch the network. They inject `fetch` and serve fixtures from `zone-map.fixture.ts`
  or a new `feature-map.fixture.ts`.

## Done when

- `feature-map.test.ts` covers, with a `postal` config and a tiny two-state fixture: drawing,
  the narrow fallback (no fetch below 520 px), roving keys, pin and unpin, overlay drawn
  `aria-hidden` and not focusable, and abort mid-fetch draws nothing. Every test aborts its
  controller in `afterEach`, even when an assertion fails.
- The byte-identical guard above holds.
