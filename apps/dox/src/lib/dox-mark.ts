/**
 * DOX-C3a (#139) — the Dox mark, as pure geometry.
 *
 * The crystal is drawn in two places that cannot share a component: the chat
 * island (React, `components/ask/hive/HiveGlyph.tsx`) and the site header
 * (Astro, `components/DoxMark.astro`, on all 646 pages). Rather than keep two
 * copies of the path data in sync by hand, both build their SVG from this
 * module — a plain data file with no framework in it.
 *
 * Flat-top, pointy-sided, in a 100 × 87 box (a regular hexagon: 87 ≈ 100 ×
 * 0.866). Presentation lives in `gmt-primitives.css` under `.gmt-dox-mark`, so
 * it is available site-wide and not only inside the chat's own stylesheet.
 */

/** Outer silhouette. */
export const MARK_OUTER = "25,0 75,0 100,43.5 75,87 25,87 0,43.5";

/** The crystal's "table" — an inner facet ring at ~52%, sharing the centre. */
export const MARK_INNER = "37,21.8 63,21.8 76,43.5 63,65.2 37,65.2 24,43.5";

/** The top facet, which catches the specular streak. */
export const MARK_SHEEN = "25,0 75,0 63,21.8 37,21.8";

/** Spokes from each outer vertex to its inner counterpart, as [x1,y1,x2,y2]. */
export const MARK_SPOKES: readonly (readonly [
  number,
  number,
  number,
  number,
])[] = [
  [25, 0, 37, 21.8],
  [75, 0, 63, 21.8],
  [100, 43.5, 76, 43.5],
  [75, 87, 63, 65.2],
  [25, 87, 37, 65.2],
  [0, 43.5, 24, 43.5],
];

export const MARK_VIEWBOX = "0 0 100 87";
