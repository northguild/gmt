/**
 * The globe engine's public vocabulary (#289).
 *
 * This directory is the reusable globe: a GPU renderer, a canvas-2D fallback,
 * and the pure maths both share. Nothing in here knows about time zones, the
 * Dox chat, or `@northguild/gmt` — `src/lib/globe.ts` is the Dox layer that
 * turns zones into the markers and regions below. Keeping that line sharp is
 * what lets the same engine draw transport lanes or a highlighted region set
 * without a fork.
 *
 * Colours are plain numbers, not CSS strings: the renderers upload them to a
 * uniform buffer, and a caller that reads tokens (`globe.ts`) is a better place
 * to know about `getComputedStyle` than a shader is.
 */

/** `[longitude, latitude]` in degrees — the order GeoJSON uses. */
export type LngLat = readonly [lng: number, lat: number];

/**
 * Straight (non-premultiplied) sRGB-encoded RGBA, each channel 0..1.
 *
 * Encoded, not linear: the canvas-2D renderer blends in encoded space because
 * that is what a 2D context does, and the WebGPU renderer matches it so the
 * two are pixel-comparable. Linear-light compositing would be more correct
 * physically and would not match the site's existing look.
 */
export type Rgba = readonly [r: number, g: number, b: number, a: number];

/** A ring of points. The first and last need not be equal; rings are closed
 *  implicitly. Winding is ignored — holes are declared by position, not order. */
export type Ring = readonly LngLat[];

/** `[outerRing, ...holes]`, as GeoJSON orders a Polygon's rings. */
export type PolygonRings = readonly Ring[];

/**
 * Every colour the globe surface itself draws with, and how strongly to show
 * the Earth imagery.
 *
 * One flat record rather than nested groups: it is uploaded as a uniform block,
 * and a flat shape keeps the packing in `webgpu/uniforms.ts` trivial to verify.
 */
export interface GlobeTheme {
  /** Base fill of the sphere, under the day/night wash. */
  ocean: Rgba;
  /** The 1px circle at the sphere's edge. */
  limb: Rgba;
  /** Latitude/longitude grid lines. */
  grid: Rgba;
  /** Fill and outline of the land mesh. */
  land: Rgba;
  landStroke: Rgba;
  /** Sunlit wash. Its alpha is the peak, where the sun is overhead. */
  day: Rgba;
  /** Night wash. Its alpha is the value past the end of astronomical twilight. */
  night: Rgba;
  /** Glow ring outside the limb. Alpha 0 turns it off. */
  atmosphere: Rgba;
  /** Haze just inside the limb. Alpha 0 turns it off. */
  haze: Rgba;
  /** Marker label text. */
  label: Rgba;
  /**
   * The halo drawn under labels, markers and region outlines where the Earth
   * imagery shows, so they stay legible over desert and ice. Unused by the
   * canvas-2D renderer, which draws no imagery.
   */
  casing: Rgba;
  /**
   * Opacity of the Earth imagery, 0..1. 0 keeps the flat vector globe, and
   * also means the image is never downloaded. Only the WebGPU renderer draws
   * imagery; see `GlobeOptions.imageryUrl`.
   */
  imagery: number;
  /**
   * How much of the vector land — fill and coastline — stays on top of the
   * imagery, 0..1. 0 shows the plain photograph; 1 keeps the land as strong as
   * on the flat globe. Has no effect where no imagery is drawn.
   */
  vectorOverlay: number;
  /**
   * How far the imagery is recoloured onto the theme's own ramp — near-black,
   * ocean teal, day cyan, label ice — by brightness, 0..1. 0 keeps the
   * photograph's own colours.
   */
  imageryDuotone: number;
}

/**
 * A filled, outlined area on the sphere — one time zone's boundary today, a
 * country or a delivery region tomorrow.
 *
 * Several may be set at once, each with its own colours, which is what the
 * "many highlighted regions" case needs. Geometry is accepted as raw rings so a
 * caller can hand over GeoJSON coordinates untouched; the engine unwraps,
 * densifies and triangulates.
 */
export interface GlobeRegion {
  id: string;
  /** One entry per polygon; each is `[outerRing, ...holes]`. */
  polygons: readonly PolygonRings[];
  fill: Rgba;
  stroke: Rgba;
  /** Stroke width in CSS pixels, held constant as the globe zooms. */
  strokeWidth: number;
}

/** A point on the sphere, optionally labelled and ringed. */
export interface GlobeMarker {
  id: string;
  position: LngLat;
  /** Radius in CSS pixels, held constant as the globe zooms. */
  radius: number;
  color: Rgba;
  /**
   * Used instead of `color` once the marker's own location is past civil dusk.
   * The Dox globe draws its zones gold at night, like city lights in an
   * Earth-at-night photograph; a caller that does not care omits this.
   */
  nightColor?: Rgba;
  /** A circle drawn outside the dot — the "this one is selected" signal. */
  ring?: { radius: number; width: number; color: Rgba };
  /** Drawn to the right of the dot. Hidden automatically while the globe moves. */
  label?: string;
}

/**
 * A great-circle line between two points.
 *
 * Declared now and drawn by the same instanced-stroke pipeline the region
 * outlines use, so the route-arc case costs geometry, not a new pipeline.
 */
export interface GlobeArc {
  id: string;
  from: LngLat;
  to: LngLat;
  color: Rgba;
  /** Width in CSS pixels. */
  width: number;
  /** 0 keeps the line on the surface; higher lifts its midpoint off the sphere. */
  altitude?: number;
}

/** Which backend to use. `auto` prefers WebGPU and falls back on any failure. */
export type RendererKind = "webgpu" | "canvas2d";
export type RendererChoice = RendererKind | "auto";

export interface GlobeOptions {
  /** Defaults to `auto`. */
  renderer?: RendererChoice;
  /**
   * Epoch milliseconds for the sun's position, read once per frame.
   *
   * A function, not a number, and supplied by the caller rather than read here:
   * this module may not touch `Date` (see `date-ban.test.ts`), and a caller that
   * passes a fixed instant — a scrubber, a screenshot — gets day and night at
   * that instant for free.
   */
  sunInstant: () => number;
  theme: GlobeTheme;
  /** CSS `font` shorthand for marker labels. */
  labelFont: string;
  /** Applied to the canvas, which is focusable and drag-rotatable. */
  ariaLabel: string;
  /**
   * An equirectangular image of the Earth to wrap round the sphere: 2:1, with
   * 180°W at its left edge and the north pole at its top. Fetched only by the
   * WebGPU renderer, and only once `theme.imagery` is above 0. Omitted means a
   * flat globe everywhere.
   */
  imageryUrl?: string;
  /** Initial `[λ, φ]`. Negated lng/lat, as d3's `.rotate()` takes it. */
  initialRotation: readonly [number, number];
  /** Defaults to `[1, 5]`. */
  zoomRange?: readonly [number, number];
  /**
   * Whether to suppress ambient spin, inertia and eased transitions. Read on
   * every frame, so a preference change takes effect without a remount.
   */
  reducedMotion?: () => boolean;
}

/** What the engine hands back to its host. */
export interface GlobeEngine {
  /** Which backend actually started. */
  readonly renderer: RendererKind;
  setTheme(theme: GlobeTheme): void;
  setRegions(regions: readonly GlobeRegion[]): void;
  setMarkers(markers: readonly GlobeMarker[]): void;
  setArcs(arcs: readonly GlobeArc[]): void;
  /** Rotate to `[λ, φ]`, eased unless reduced motion is on. */
  flyTo(rotation: readonly [number, number]): void;
  setZoom(zoom: number): void;
  zoomBy(factor: number): void;
  getZoom(): number;
  getRotation(): readonly [number, number];
  /** Where a geographic point currently sits, in CSS pixels within the host. */
  project(point: LngLat): { x: number; y: number; visible: boolean };
  /** The point under a position in CSS pixels, or null if it missed the sphere. */
  unproject(x: number, y: number): LngLat | null;
  /** A tap that selected a marker, hit a region, or neither. */
  onTap(
    callback: (hit: {
      markerId: string | null;
      regionId: string | null;
      point: LngLat | null;
    }) => void,
  ): void;
  /** After every frame — where a host repositions DOM chrome such as a tooltip. */
  onFrame(callback: () => void): void;
  /** Redraw once, for a change the engine cannot observe (a new theme token). */
  requestRender(): void;
  destroy(): void;
}
