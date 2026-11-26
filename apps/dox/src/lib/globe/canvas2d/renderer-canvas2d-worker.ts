/**
 * The canvas-2D fallback drawing in a Web Worker (#289).
 *
 * The page keeps the element, sizes it with CSS and owns input; the worker owns the bitmap. At
 * a 4x CPU throttle one frame takes about 100 ms, and while it ran on the main thread a tap on
 * the globe waited for it. Here the page only posts the frame.
 *
 * Creation resolves once the worker has a 2D context and rejects if it cannot start (a module
 * worker the browser refuses, a script that fails to load, no reply within `READY_TIMEOUT_MS`),
 * so the shell falls back to `./renderer-canvas2d.ts` and the globe still draws. A worker that
 * dies later reports through `onFailure` and the shell does the same.
 */

import type { FrameState, GlobeRenderer, RendererInit } from "../renderer";
import type { GlobeArc, GlobeMarker, GlobeRegion, GlobeTheme } from "../types";
import type { FromWorker, ToWorker } from "./protocol";
import { workerTextMatchesPage } from "./text-parity";

/** How long a worker has to report ready before the page gives up on it. */
export const READY_TIMEOUT_MS = 8000;

/** The worker surface the renderer uses; `Worker` satisfies it. */
export interface WorkerLike {
  postMessage(message: ToWorker, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
}

export interface WorkerRendererDeps {
  spawn(): WorkerLike;
  /** Overridable so a test need not wait out the real timeout. */
  readyTimeoutMs?: number;
  /** Whether the worker would draw labels as the page does; the real probe by default. */
  textMatchesPage?(host: HTMLElement, font: string): boolean;
}

/* The literal `new Worker(new URL(...))` form is what Vite recognises and bundles, and it
   resolves against the site's base. */
const spawnWorker = (): WorkerLike =>
  new Worker(new URL("./canvas2d.worker.ts", import.meta.url), {
    type: "module",
  }) as unknown as WorkerLike;

export async function createWorkerCanvas2dRenderer(
  init: RendererInit,
  deps: WorkerRendererDeps = { spawn: spawnWorker },
): Promise<GlobeRenderer> {
  const matches = deps.textMatchesPage ?? workerTextMatchesPage;
  if (!matches(init.host, init.labelFont)) {
    throw new Error("the worker would draw labels differently from the page");
  }
  const canvas = document.createElement("canvas");
  canvas.dataset.renderer = "canvas2d";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", init.ariaLabel);

  const offscreen = canvas.transferControlToOffscreen();
  const worker = deps.spawn();

  let theme: GlobeTheme | undefined;
  let size: { width: number; height: number; dpr: number } | undefined;
  let regions: readonly GlobeRegion[] | undefined;
  let markers: readonly GlobeMarker[] | undefined;
  let arcs: readonly GlobeArc[] | undefined;
  let latest: FrameState | null = null;
  let inFlight = false;
  let seq = 0;
  let destroyed = false;
  let failure: ((reason: string) => void) | null = null;

  /** Send the newest frame with whatever changed since the last one. */
  function flush(): void {
    if (destroyed || inFlight || latest === null) return;
    const frame = latest;
    latest = null;
    inFlight = true;
    seq += 1;
    worker.postMessage({
      type: "frame",
      seq,
      frame,
      size,
      theme,
      regions,
      markers,
      arcs,
    });
    size = theme = regions = markers = arcs = undefined;
  }

  function fail(reason: string): void {
    if (destroyed) return;
    failure?.(reason);
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("canvas 2D worker did not start")),
      deps.readyTimeoutMs ?? READY_TIMEOUT_MS,
    );
    const settle = (error?: Error): void => {
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    worker.onmessage = (event) => {
      const message = event.data;
      if (message.type === "ready") {
        settle();
      } else if (message.type === "drawn") {
        inFlight = false;
        flush();
      } else {
        // A `failed` reply before ready rejects; after ready it is a runtime failure.
        settle(new Error(message.reason));
        fail(message.reason);
      }
    };
    worker.onerror = (event) => {
      settle(new Error(event.message || "canvas 2D worker failed"));
      fail(event.message || "canvas 2D worker failed");
    };
    worker.onmessageerror = () => {
      settle(new Error("canvas 2D worker sent an unreadable message"));
      fail("canvas 2D worker sent an unreadable message");
    };
    worker.postMessage(
      {
        type: "init",
        canvas: offscreen,
        theme: init.theme,
        labelFont: init.labelFont,
      },
      [offscreen],
    );
  }).catch((error: unknown) => {
    worker.terminate();
    throw error;
  });

  init.host.appendChild(canvas);

  return {
    kind: "canvas2d",
    offThread: true,
    canvas,
    resize(cssWidth, cssHeight, dpr) {
      size = {
        width: Math.max(1, cssWidth),
        height: Math.max(1, cssHeight),
        dpr,
      };
      canvas.style.width = `${size.width}px`;
      canvas.style.height = `${size.height}px`;
    },
    setTheme(next) {
      theme = next;
    },
    setRegions(next) {
      regions = next;
    },
    setMarkers(next) {
      markers = next;
    },
    setArcs(next) {
      arcs = next;
    },
    render(frame) {
      latest = frame;
      flush();
    },
    onFailure(callback) {
      failure = callback;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.postMessage({ type: "destroy" });
      worker.terminate();
      canvas.remove();
    },
  };
}
