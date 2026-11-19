/**
 * The ice wall's drawing surface: one aria-hidden canvas on the space layer (`pointer-events:
 * none`) and one renderer, WebGPU when the globe runs on it and canvas-2D otherwise (a canvas that
 * has asked for a WebGPU context can never give a 2D one, so a failed GPU gets a fresh canvas).
 * The renderer arrives asynchronously, and a WebGPU device that fails later is swapped for canvas-2D.
 */
import type { GlobeEngine, Rgba } from "~/lib/globe/types";
import { acquireDevice } from "~/lib/globe/webgpu/device";
import { createCanvas2dRenderer } from "./draw-canvas2d";
import { createWebgpuRenderer } from "./draw-webgpu";
import type { Drawable } from "./frame";
import type { WallPaneImage, WallRenderer } from "./renderer";

interface SurfaceDeps {
  layer: HTMLElement;
  engine: GlobeEngine;
  ice: Rgba;
  /** What each pane draws: its image and the shards it breaks into. */
  panes: readonly WallPaneImage[];
  signal: AbortSignal;
  /** Measures the layer and lays the panes out; returns the layer's size in CSS pixels. */
  measure(): { width: number; height: number };
  /** The layer changed size and the canvas has been resized to it. */
  onResize(): void;
  /** A renderer was installed and the canvas is on the layer. */
  onInstall(): void;
}

interface WallSurface {
  readonly kind: WallRenderer["kind"] | "pending";
  /** Whether a renderer is installed. */
  readonly ready: boolean;
  draw(drawables: readonly Drawable[]): void;
  /** Starts the renderer and watches the layer; call once the callbacks can run. */
  start(): void;
  /** Measures and sizes the canvas. */
  resize(): void;
  destroy(): void;
}

export function createWallSurface(d: SurfaceDeps): WallSurface {
  const doc = d.layer.ownerDocument;
  const win = doc.defaultView;
  let renderer: WallRenderer | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let release: (() => void) | null = null;
  let unlisten: (() => void) | null = null;
  let destroyed = false;

  const freshCanvas = (): HTMLCanvasElement => {
    const c = doc.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    c.dataset["wallCanvas"] = "";
    c.style.pointerEvents = "none";
    return c;
  };

  const canvas2d = (): {
    made: WallRenderer | null;
    used: HTMLCanvasElement;
  } => {
    const used = freshCanvas();
    return {
      made: createCanvas2dRenderer({
        canvas: used,
        panes: d.panes,
        ice: d.ice,
      }),
      used,
    };
  };

  function resize(): void {
    if (!renderer || !canvas) return;
    const { width, height } = d.measure();
    const dpr = Math.min(win?.devicePixelRatio ?? 1, 1.5);
    renderer.resize(width, height, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    d.onResize();
  }

  function install(made: WallRenderer, used: HTMLCanvasElement): void {
    renderer = made;
    canvas = used;
    d.layer.append(used);
    resize();
    d.onInstall();
  }

  /* Swaps a failed WebGPU renderer for canvas-2D on a fresh canvas (a canvas that has taken a
     WebGPU context can never give a 2D one). */
  function fallBack(): void {
    const failed = renderer;
    if (destroyed || d.signal.aborted || !failed || failed.kind !== "webgpu")
      return;
    unlisten?.();
    unlisten = null;
    failed.destroy();
    canvas?.remove();
    release?.();
    release = null;
    const { made, used } = canvas2d();
    if (made) install(made, used);
    else {
      renderer = null;
      canvas = null;
    }
  }

  /** A WebGPU renderer on a fresh canvas, or `null` when the device or the renderer is refused. */
  async function webgpu(): Promise<{
    made: WallRenderer;
    used: HTMLCanvasElement;
  } | null> {
    try {
      const gpu = await acquireDevice(fallBack);
      if (d.signal.aborted) {
        gpu.release();
        return null;
      }
      const used = freshCanvas();
      const made = await createWebgpuRenderer(
        { canvas: used, panes: d.panes, ice: d.ice },
        { device: gpu.device, format: gpu.canvasFormat },
      );
      if (!made) {
        gpu.release();
        return null;
      }
      release = gpu.release;
      /* A device that was handed out can still fail on a frame (a validation error, a lost
         context). The globe falls back to canvas-2D when that happens; the wall does the same,
         or its panes would stay blank over a working globe. */
      gpu.device.addEventListener?.("uncapturederror", fallBack);
      unlisten = () =>
        gpu.device.removeEventListener?.("uncapturederror", fallBack);
      return { made, used };
    } catch {
      return null;
    }
  }

  async function make(): Promise<void> {
    const gpu = d.engine.renderer === "webgpu" ? await webgpu() : null;
    if (d.signal.aborted) return;
    const chosen = gpu ?? canvas2d();
    if (!chosen.made) return;
    install(chosen.made, chosen.used);
  }

  const observer =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => resize())
      : null;

  return {
    start() {
      observer?.observe(d.layer);
      void make();
    },
    get kind() {
      return renderer ? renderer.kind : "pending";
    },
    get ready() {
      return renderer !== null;
    },
    draw: (drawables) => renderer?.draw(drawables),
    resize,
    destroy() {
      destroyed = true;
      observer?.disconnect();
      unlisten?.();
      unlisten = null;
      renderer?.destroy();
      renderer = null;
      release?.();
      release = null;
      canvas?.remove();
      canvas = null;
    },
  };
}
