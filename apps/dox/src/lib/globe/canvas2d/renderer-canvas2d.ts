/**
 * The canvas-2D fallback renderer on the main thread (#289).
 *
 * Used where `navigator.gpu` is missing or the GPU backend fails to start, and the page cannot
 * hand a canvas to a worker: no `OffscreenCanvas`, no `transferControlToOffscreen`, or a module
 * worker that does not start (`./renderer-canvas2d-worker.ts` is tried first). The shell loads
 * it through a dynamic `import()`, so a browser that renders off-thread never downloads it, nor
 * `d3-geo`, `topojson-client` or `world-atlas`.
 *
 * All drawing lives in `./painter.ts`, shared with the worker. **Deleting this renderer** is
 * removing this file and its `import()` in `../engine.ts`; the worker path then has no fallback.
 */

import type { GlobeRenderer, RendererInit } from "../renderer";
import { createPainter } from "./painter";

export async function createCanvas2dRenderer(
  init: RendererInit,
): Promise<GlobeRenderer> {
  const canvas = document.createElement("canvas");
  canvas.dataset.renderer = "canvas2d";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", init.ariaLabel);

  const context = canvas.getContext("2d");
  if (!context) {
    /* No 2D context either. Rejecting rather than returning something inert is
       what lets the shell tell the reader the globe is unavailable — the old
       code returned a silent no-op host here, which left live-looking controls
       that did nothing and a zone list that never mounted. */
    throw new Error("canvas 2D is unavailable");
  }

  const painter = createPainter({
    surface: canvas,
    context,
    makeBuffer: () => document.createElement("canvas"),
    theme: init.theme,
    labelFont: init.labelFont,
  });

  init.host.appendChild(canvas);

  return {
    kind: "canvas2d",
    canvas,
    resize(cssWidth, cssHeight, dpr) {
      painter.resize(cssWidth, cssHeight, dpr);
      canvas.style.width = `${Math.max(1, cssWidth)}px`;
      canvas.style.height = `${Math.max(1, cssHeight)}px`;
    },
    setTheme: painter.setTheme,
    setRegions: painter.setRegions,
    setMarkers: painter.setMarkers,
    setArcs: painter.setArcs,
    render: painter.render,
    onFailure() {
      // Canvas 2D has nothing to lose once it has a context; there is no
      // equivalent of a lost GPU device to report.
    },
    destroy() {
      painter.destroy();
      canvas.remove();
    },
  };
}
