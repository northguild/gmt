/** What the ice wall draws with: one interface, a canvas-2D and a WebGPU implementation. */
import type { Rgba } from "~/lib/globe/types";
import type { Cell } from "./voronoi";
import type { Drawable } from "./frame";

export interface WallPaneImage {
  id: string;
  image: HTMLImageElement | ImageBitmap | HTMLCanvasElement;
  cells: readonly Cell[];
}

export interface WallRenderer {
  readonly kind: "webgpu" | "canvas2d";
  /** Sets the canvas to a CSS size at a device pixel ratio. */
  resize(width: number, height: number, dpr: number): void;
  /** Draws a frame, or clears the canvas when `drawables` is empty. */
  draw(drawables: readonly Drawable[]): void;
  destroy(): void;
}

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  panes: readonly WallPaneImage[];
  /** The ice tint: the frost fill and the edge line. */
  ice: Rgba;
}

export const css = (c: Rgba, alpha = c[3]): string =>
  `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${alpha})`;
