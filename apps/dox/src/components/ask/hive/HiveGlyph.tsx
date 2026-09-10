/**
 * DOX-C3a (#139) — the Dox crystal, React side.
 *
 * A faceted hexagonal ice crystal, drawn as SVG rather than a flat `clip-path`
 * hexagon. Three reasons SVG and not CSS:
 *
 *  1. Facets need strokes that meet cleanly at vertices. `clip-path` removes
 *     borders entirely (the old outlined role marker had to stack two clipped
 *     boxes to fake one), while SVG draws them natively.
 *  2. A gradient that runs *across* the facets — the thing that reads as ice
 *     rather than a coloured tile — needs real geometry to run along.
 *  3. It is the product's mark. One vector renders at 24px in the site header
 *     and at 6rem on the chat's empty state with no second asset.
 *
 * Geometry comes from `~/lib/dox-mark` and presentation from
 * `gmt-primitives.css`, both shared with `components/DoxMark.astro` — the
 * header renders this same mark on every page, where the chat's own stylesheet
 * is not loaded.
 *
 * Every colour is `currentColor` or a global token, so the mark takes the
 * colour of whatever it is mounted in: `--gmt-hive-role` in a transcript turn,
 * `.gmt-icon-button`'s cyan in the header.
 */
import {
  MARK_INNER,
  MARK_OUTER,
  MARK_SHEEN,
  MARK_SPOKES,
  MARK_VIEWBOX,
} from "~/lib/dox-mark";

export function HiveGlyph({ idSuffix }: { idSuffix: string }) {
  // Gradient ids must be unique per document: two marks sharing an id makes
  // the second silently reuse the first one's stops.
  const faceId = `gmt-dox-face-${idSuffix}`;
  const sheenId = `gmt-dox-sheen-${idSuffix}`;

  return (
    <svg
      className="gmt-dox-mark"
      viewBox={MARK_VIEWBOX}
      focusable="false"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={faceId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="55%" stopColor="currentColor" stopOpacity="0.16" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.4" />
        </linearGradient>
        {/* The specular streak. Steep and narrow, so it reads as light caught
            on a facet rather than a second fill. */}
        <linearGradient id={sheenId} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="var(--gmt-ice)" stopOpacity="0.75" />
          <stop offset="45%" stopColor="var(--gmt-ice)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--gmt-ice)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <polygon points={MARK_OUTER} fill={`url(#${faceId})`} />
      <polygon points={MARK_OUTER} className="gmt-dox-mark-edge" />

      {/* Spokes first, so the table's stroke caps them off cleanly at the
          facet edge instead of the other way round. */}
      <g className="gmt-dox-mark-facet">
        {MARK_SPOKES.map(([x1, y1, x2, y2]) => (
          <line key={`${x1},${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>

      <polygon points={MARK_INNER} className="gmt-dox-mark-table" />
      <polygon points={MARK_SHEEN} fill={`url(#${sheenId})`} />
    </svg>
  );
}
