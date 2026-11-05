/**
 * The contract between the globe's shell and whichever backend is drawing
 * (#289).
 *
 * Two implementations: `webgpu/renderer-webgpu.ts`, and `canvas2d/` as the
 * fallback for a browser with no WebGPU. Only one of them is ever downloaded —
 * the shell reaches each through a dynamic `import()` — so this file holds no
 * backend code and imports neither.
 *
 * ## Why a renderer owns its canvas
 *
 * `resize` and `render` take no canvas, and `canvas` is a property: once
 * `getContext("webgpu")` has been called on an element, that element can never
 * return a 2D context, so a WebGPU renderer that fails at runtime cannot hand
 * its canvas to the fallback. Each backend creates its own, and the shell swaps
 * the element and rebinds input. That is also why `onFailure` exists: a backend
 * that loses its device says so, and the shell decides what to do about it,
 * rather than a renderer trying to rescue itself.
 */

import type { Camera } from "./camera";
import type {
  GlobeArc,
  GlobeMarker,
  GlobeRegion,
  GlobeTheme,
  RendererKind,
} from "./types";

/**
 * Everything that changes frame to frame.
 *
 * Handed in rather than read from the renderer's own state, so two backends
 * given the same frame draw the same picture — which is what makes the
 * side-by-side pixel comparison in `scripts/globe-smoke.mjs` meaningful.
 */
export interface FrameState {
  /** Rotation, radius and centre for this frame. */
  camera: Camera;
  /** Sun direction in screen space: x right, y down, z towards the viewer. */
  sun: readonly [number, number, number];
  /** The subsolar point, for deciding which markers are in daylight. */
  subsolar: readonly [number, number];
  /**
   * The zoom factor, 1 at rest. Carried alongside `camera.radius` because the
   * cutoff above which labels become clutter is a zoom threshold, and deriving
   * it back out of the radius needs the base scale the shell owns.
   */
  zoom: number;
  /**
   * True while dragging or coasting. Grid lines dim and labels hide, which is
   * how the globe reads as moving rather than as a busy still image.
   */
  quiet: boolean;
  /**
   * True while anything is animating. Backends use it to widen cache keys — a
   * frame in a spin can reuse a slightly stale shading buffer, a frame at rest
   * should not.
   */
  moving: boolean;
  /**
   * How far the entrance has lit the Earth, 0..1: 0 is a dark disc, 1 is the globe as drawn.
   * Always 1 outside a dawn entrance and once the dawn is over.
   */
  exposure: number;
}

export interface RendererInit {
  /** The box to fill. The renderer appends its own canvas to this. */
  host: HTMLElement;
  theme: GlobeTheme;
  /** CSS `font` shorthand for marker labels. */
  labelFont: string;
  ariaLabel: string;
  /** Earth imagery for a backend that draws it; see `GlobeOptions.imageryUrl`. */
  imageryUrl?: string;
  /**
   * Ask the shell for another frame. For changes the shell cannot see — an
   * image that has finished loading, a fade still running. Coalesced with any
   * frame already pending, so calling it from inside `render` is safe.
   */
  invalidate(): void;
  /**
   * `"dawn"`: the host reveals the Earth through `FrameState.exposure`, so the imagery shows at
   * full weight as soon as it is loaded instead of fading in on its own.
   */
  entrance?: "fade" | "dawn";
  /** Whether to skip eased transitions. Read when needed, not cached. */
  reducedMotion(): boolean;
}

export interface GlobeRenderer {
  readonly kind: RendererKind;
  /** The element the shell binds pointer, wheel and key handlers to. */
  readonly canvas: HTMLCanvasElement;
  /**
   * Resolves once everything the first lit frame needs is on the GPU (the imagery texture and
   * the label atlas), so nothing decodes or uploads while the dawn ramps. Absent when a backend
   * has nothing to wait for.
   */
  readonly ready?: Promise<void>;
  /** CSS pixel box plus the device pixel ratio to raster at. */
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  setTheme(theme: GlobeTheme): void;
  setRegions(regions: readonly GlobeRegion[]): void;
  setMarkers(markers: readonly GlobeMarker[]): void;
  setArcs(arcs: readonly GlobeArc[]): void;
  render(frame: FrameState): void;
  /**
   * Called when the backend can no longer draw — a lost GPU device, a pipeline
   * that failed to build. The shell falls back; the renderer does not retry.
   */
  onFailure(callback: (reason: string) => void): void;
  destroy(): void;
}

/**
 * A backend's entry point. Rejecting means "cannot run here", which is not an
 * error the reader should see: the shell tries the next backend.
 */
export type CreateRenderer = (init: RendererInit) => Promise<GlobeRenderer>;
