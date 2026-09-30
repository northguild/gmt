/**
 * The globe's shell: the one piece that touches the DOM (#289).
 *
 * It owns everything a renderer should not have an opinion about — which backend
 * to start, the canvas's size and device pixel ratio, pointer and keyboard
 * input, the animation loop, and the single timer that wakes the ambient spin —
 * and drives the pure `controller` and `camera` beneath it. Backends implement
 * `GlobeRenderer` and are reached only through a dynamic `import()`, so a
 * browser with WebGPU never downloads `d3-geo`, and one without it never
 * downloads a shader.
 *
 * Nothing here knows about time zones. `../globe.ts` is the Dox layer that turns
 * zones into markers and regions and hangs the clock list and tooltip off
 * `onTap` and `onFrame`.
 *
 * ## Choosing a backend
 *
 * `auto` asks for a WebGPU adapter and device *before* touching a canvas,
 * because `getContext("webgpu")` permanently claims an element: once called, it
 * can never return a 2D context, so a failed WebGPU start must not have touched
 * the canvas the fallback will need. Each renderer creates its own canvas
 * instead, and `swapRenderer` re-binds input to whichever is live. Any failure —
 * no `navigator.gpu`, a null adapter, a rejected device, a shader that will not
 * compile, a validation error on the first frame — is a fallback, not an error
 * the reader sees.
 *
 * A lost device is retried once, and only while the tab is visible; a second
 * loss means canvas-2D for the rest of the session. Retrying in a loop on a
 * machine whose driver is unhappy would be worse than a slightly cheaper globe.
 */

import {
  clampLat,
  createCamera,
  project as projectPoint,
  syncCamera,
  unproject as unprojectPoint,
  wrapLng,
} from "./camera";
import { createController, type Controller } from "./controller";
import type { CreateRenderer, FrameState, GlobeRenderer } from "./renderer";
import { subsolarPoint } from "./sun";
import { sunDirection } from "./camera";
import type {
  GlobeArc,
  GlobeEngine,
  GlobeMarker,
  GlobeOptions,
  GlobeRegion,
  GlobeTheme,
  LngLat,
  RendererKind,
} from "./types";

/** Device pixel ratio is capped here: past 2 the cost doubles for no visible
 *  gain on a globe made of washes and thin strokes. */
const MAX_DPR = 2;

/** The sphere leaves this much of the stage clear, so the glow ring fits. */
const BASE_SCALE_FACTOR = 0.94;

/** A tap this far from a marker still selects it. */
const MARKER_HIT_RADIUS_PX = 14;

/** How the engine reports which renderer is live, for tests and the smoke run. */
const RENDERER_ATTRIBUTE = "data-globe-renderer";

export async function createGlobeEngine(
  host: HTMLElement,
  options: GlobeOptions,
): Promise<GlobeEngine> {
  const reducedMotion = options.reducedMotion ?? (() => false);
  const controller = createController({
    initialRotation: options.initialRotation,
    zoomRange: options.zoomRange,
    reducedMotion,
  });
  const camera = createCamera(options.initialRotation);

  let theme = options.theme;
  let regions: readonly GlobeRegion[] = [];
  let markers: readonly GlobeMarker[] = [];
  let arcs: readonly GlobeArc[] = [];

  let renderer: GlobeRenderer | null = null;
  let deviceLossRetried = false;
  let destroyed = false;

  let width = 1;
  let height = 1;
  let dpr = 1;
  let baseScale = 1;

  let frameHandle = 0;
  /** A one-off redraw asked for from outside the animation loop. */
  let drawHandle = 0;
  let wakeTimer: ReturnType<typeof setTimeout> | undefined;

  let tapCallback: Parameters<GlobeEngine["onTap"]>[0] | null = null;
  let frameCallback: (() => void) | null = null;

  const sun: [number, number, number] = [0, 0, 1];

  // --- backend selection ---------------------------------------------------

  /**
   * Whether WebGPU is worth trying at all.
   *
   * Only a cheap capability check here; the expensive part (adapter, device,
   * pipelines) lives in the backend and reports failure the same way as any
   * other reason to fall back.
   */
  function webgpuPlausible(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }

  async function loadRenderer(kind: RendererKind): Promise<GlobeRenderer> {
    const init = {
      host,
      theme,
      labelFont: options.labelFont,
      ariaLabel: options.ariaLabel,
    };
    const create: CreateRenderer =
      kind === "webgpu"
        ? (await import("./webgpu/renderer-webgpu")).createWebgpuRenderer
        : (await import("./canvas2d/renderer-canvas2d")).createCanvas2dRenderer;
    return create(init);
  }

  /** Attach a renderer, wire its failure hook, size it and draw once. */
  function adoptRenderer(next: GlobeRenderer): void {
    renderer = next;
    host.setAttribute(RENDERER_ATTRIBUTE, next.kind);
    next.setTheme(theme);
    next.setRegions(regions);
    next.setMarkers(markers);
    next.setArcs(arcs);
    next.onFailure(handleRendererFailure);
    bindInput(next.canvas);
    measure();
  }

  function handleRendererFailure(reason: string): void {
    if (destroyed || !renderer || renderer.kind !== "webgpu") return;
    console.warn(`globe: WebGPU renderer failed (${reason})`);
    const previous = renderer;
    renderer = null;
    unbindInput(previous.canvas);
    previous.destroy();

    /* One retry, and only once the tab is visible: a device lost while hidden is
       usually the browser reclaiming the GPU, and re-requesting it immediately
       tends to lose it again. */
    const recover = async () => {
      if (destroyed) return;
      if (!deviceLossRetried) {
        deviceLossRetried = true;
        try {
          adoptRenderer(await loadRenderer("webgpu"));
          return;
        } catch {
          // Fall through to canvas-2D below.
        }
      }
      if (destroyed) return;
      try {
        adoptRenderer(await loadRenderer("canvas2d"));
      } catch (error) {
        console.error("globe: no renderer could start", error);
      }
    };

    if (document.hidden) {
      document.addEventListener("visibilitychange", function once() {
        document.removeEventListener("visibilitychange", once);
        void recover();
      });
    } else {
      void recover();
    }
  }

  const choice = options.renderer ?? "auto";
  const order: RendererKind[] =
    choice === "canvas2d"
      ? ["canvas2d"]
      : choice === "webgpu"
        ? ["webgpu"]
        : webgpuPlausible()
          ? ["webgpu", "canvas2d"]
          : ["canvas2d"];

  let started: GlobeRenderer | null = null;
  const failures: string[] = [];
  for (const kind of order) {
    try {
      started = await loadRenderer(kind);
      break;
    } catch (error) {
      failures.push(`${kind}: ${String(error)}`);
    }
  }
  if (!started) {
    /* Both backends refused. Throwing is deliberate: the host shows the reader
       that the widget is unavailable, rather than leaving live-looking zoom
       buttons that do nothing. */
    throw new Error(`globe: no renderer could start — ${failures.join("; ")}`);
  }
  if (failures.length > 0) {
    console.info(`globe: using ${started.kind} (${failures.join("; ")})`);
  }

  // --- sizing --------------------------------------------------------------

  /**
   * Re-measure and redraw.
   *
   * `clientWidth`/`clientHeight` — the padding box — not `getBoundingClientRect`:
   * the stage keeps a 1px transparent border to hold its bevelled clip shape, so
   * the rect is 2px larger in each axis than the box the canvas fills. Sizing
   * from the rect overflowed the stage's own `overflow: hidden`, and Starlight's
   * `max-width: 100%` then clamped the width back and stretched a square raster.
   * These are the integers the `inset: 0` canvas resolves against, so CSS and JS
   * agree on one box.
   */
  function measure(): void {
    if (!renderer) return;
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    dpr = Math.min(globalThis.devicePixelRatio || 1, MAX_DPR);
    baseScale = (Math.min(width, height) / 2) * BASE_SCALE_FACTOR;
    renderer.resize(width, height, dpr);
    draw();
  }

  const resizeObserver = new ResizeObserver(() => measure());
  resizeObserver.observe(host);

  /**
   * Dragging a window between displays changes `devicePixelRatio` without
   * changing the element's CSS box, so `ResizeObserver` never fires and the
   * canvas keeps the old raster density — a globe that stays soft until the next
   * layout change. This media query fires on exactly that.
   */
  let dprQuery: MediaQueryList | undefined;
  function watchDpr(): void {
    if (typeof globalThis.matchMedia !== "function") return;
    dprQuery?.removeEventListener("change", onDprChange);
    const current = globalThis.devicePixelRatio || 1;
    dprQuery = globalThis.matchMedia(`(resolution: ${current}dppx)`);
    dprQuery.addEventListener("change", onDprChange);
  }
  function onDprChange(): void {
    measure();
    watchDpr();
  }

  // --- the frame -----------------------------------------------------------

  function buildFrame(): FrameState {
    camera.rotation[0] = controller.rotation[0];
    camera.rotation[1] = controller.rotation[1];
    syncCamera(camera);
    camera.radius = baseScale * controller.zoom;
    camera.centreX = width / 2;
    camera.centreY = height / 2;

    /* One instant for the whole frame. Reading the clock per call site could put
       a marker on the wrong side of the same frame's own terminator. */
    const solar = subsolarPoint(options.sunInstant());
    sunDirection(camera, solar.lng, solar.lat, sun);

    return {
      camera,
      sun,
      subsolar: [solar.lng, solar.lat],
      zoom: controller.zoom,
      quiet: controller.isQuiet(),
      moving: controller.needsFrame(),
    };
  }

  function draw(): void {
    if (destroyed || !renderer) return;
    renderer.render(buildFrame());
    frameCallback?.();
  }

  /**
   * Redraw once, on the next frame, for a change the engine cannot observe — a
   * new theme, a new marker set, the once-a-second clock tick moving the sun.
   *
   * Never draws synchronously. Painting straight from a caller lands an extra,
   * unsynchronised frame between two animation frames, which shows as a stutter
   * once a second while the globe is being dragged or spun. If the animation
   * loop already has a frame pending it will draw anyway, so this does nothing.
   */
  function requestDraw(): void {
    if (destroyed || document.hidden || frameHandle || drawHandle) return;
    drawHandle = requestAnimationFrame(() => {
      drawHandle = 0;
      draw();
    });
  }

  function step(now: number): void {
    frameHandle = 0;
    controller.step(now);
    draw();
    schedule();
  }

  /** Ask for the next frame, or set the one timer that wakes the ambient spin. */
  function schedule(): void {
    if (destroyed || document.hidden) return;
    if (controller.needsFrame()) {
      if (!frameHandle) frameHandle = requestAnimationFrame(step);
      return;
    }
    if (wakeTimer) clearTimeout(wakeTimer);
    const wakeAt = controller.nextWakeAt();
    if (wakeAt === null) return;
    wakeTimer = setTimeout(
      () => {
        if (destroyed || document.hidden) return;
        step(wakeAt);
      },
      Math.max(0, wakeAt - performanceNow()),
    );
  }

  /**
   * A monotonic clock in the same units the controller and `requestAnimationFrame`
   * use.
   *
   * `performance.now()`, never `Date.now()` — the latter is banned repo-wide
   * (`date-ban.test.ts`) and is the wrong tool anyway, since it can step
   * backwards over a clock adjustment and leave the animation with a negative
   * delta.
   */
  function performanceNow(): number {
    return performance.now();
  }

  // --- input ---------------------------------------------------------------

  function onPointerDown(event: PointerEvent): void {
    controller.pointerDown(
      event.pointerId,
      event.clientX,
      event.clientY,
      event.timeStamp,
    );
    try {
      renderer?.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Some input stacks, and any synthesised pointer event, have no live
      // pointer to capture. Drag and tap both work without it.
    }
    schedule();
  }

  function onPointerMove(event: PointerEvent): void {
    controller.pointerMove(
      event.pointerId,
      event.clientX,
      event.clientY,
      event.timeStamp,
      camera.radius,
    );
    schedule();
  }

  function onPointerUp(event: PointerEvent): void {
    const result = controller.pointerUp(
      event.pointerId,
      event.clientX,
      event.clientY,
      event.timeStamp,
    );
    try {
      renderer?.canvas.releasePointerCapture?.(event.pointerId);
    } catch {
      // Capture may already be gone; releasing it is best-effort.
    }
    if (result.tap) hitTest(result.x, result.y);
    schedule();
  }

  function onPointerCancel(event: PointerEvent): void {
    controller.pointerCancel(event.pointerId);
    schedule();
  }

  function onWheel(event: WheelEvent): void {
    /* Only swallow the event when the globe actually zoomed. At a zoom limit the
       wheel belongs to the page, so a reader who scrolls down onto the hero
       globe is not trapped there. */
    if (controller.wheel(event.deltaY, event.timeStamp)) event.preventDefault();
    schedule();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!controller.key(event.key, event.timeStamp)) return;
    event.preventDefault();
    schedule();
  }

  function onPointerEnter(event: PointerEvent): void {
    controller.setHovered(true, event.timeStamp);
  }

  function onPointerLeave(event: PointerEvent): void {
    controller.setHovered(false, event.timeStamp);
    schedule();
  }

  function bindInput(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerenter", onPointerEnter);
    canvas.addEventListener("pointerleave", onPointerLeave);
  }

  function unbindInput(canvas: HTMLCanvasElement): void {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("pointerenter", onPointerEnter);
    canvas.removeEventListener("pointerleave", onPointerLeave);
  }

  /**
   * Nearest marker first, then whichever region the tap landed inside.
   *
   * The marker pass is a screen-space radius so a small dot is still an easy
   * target; the region pass is what makes tapping the middle of a country work
   * when its marker is nowhere near. Region membership uses `../geometry.ts`,
   * which reads polygon edges as straight in lng/lat per RFC 7946 §3.1.1 — so
   * the answer is the same whichever renderer is drawing.
   */
  function hitTest(clientX: number, clientY: number): void {
    if (!tapCallback || !renderer) return;
    const rect = renderer.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    let bestMarker: string | null = null;
    let bestDistance = MARKER_HIT_RADIUS_PX;
    for (const marker of markers) {
      const at = projectPoint(camera, marker.position[0], marker.position[1]);
      if (!at.visible) continue;
      const distance = Math.hypot(at.x - x, at.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMarker = marker.id;
      }
    }

    const point = unprojectPoint(camera, x, y);
    let regionId: string | null = null;
    if (bestMarker === null && point) {
      regionId = hitRegion(point[0], point[1]);
    }
    tapCallback({ markerId: bestMarker, regionId, point });
  }

  /** Overridden by the Dox layer, which owns the full boundary set. */
  let regionHitTest: ((lng: number, lat: number) => string | null) | null =
    null;
  function hitRegion(lng: number, lat: number): string | null {
    return regionHitTest ? regionHitTest(lng, lat) : null;
  }

  // --- visibility ----------------------------------------------------------

  function onVisibility(): void {
    if (document.hidden) {
      if (frameHandle) cancelAnimationFrame(frameHandle);
      frameHandle = 0;
      if (wakeTimer) clearTimeout(wakeTimer);
      return;
    }
    // Returning after a while: treat now as the last interaction, so the globe
    // does not resume a spin from a timestamp minutes in the past.
    controller.markInteraction(performanceNow());
    requestDraw();
    schedule();
  }
  document.addEventListener("visibilitychange", onVisibility);

  // --- start ---------------------------------------------------------------

  adoptRenderer(started);
  watchDpr();
  controller.markInteraction(performanceNow());
  schedule();

  const engine: GlobeEngine & {
    setRegionHitTest(
      fn: ((lng: number, lat: number) => string | null) | null,
    ): void;
  } = {
    get renderer() {
      return renderer?.kind ?? started.kind;
    },
    setTheme(next: GlobeTheme) {
      theme = next;
      renderer?.setTheme(next);
      requestDraw();
    },
    setRegions(next) {
      regions = next;
      renderer?.setRegions(next);
      requestDraw();
    },
    setMarkers(next) {
      markers = next;
      renderer?.setMarkers(next);
      requestDraw();
    },
    setArcs(next) {
      arcs = next;
      renderer?.setArcs(next);
      requestDraw();
    },
    flyTo(rotation) {
      controller.flyTo(
        [wrapLng(rotation[0]), clampLat(rotation[1])],
        performanceNow(),
      );
      schedule();
    },
    setZoom(zoom) {
      controller.setZoom(zoom, performanceNow());
      schedule();
    },
    zoomBy(factor) {
      controller.zoomBy(factor, performanceNow());
      schedule();
    },
    getZoom: () => controller.zoom,
    getRotation: () => [controller.rotation[0], controller.rotation[1]],
    project(point: LngLat) {
      return projectPoint(camera, point[0], point[1]);
    },
    unproject(x, y) {
      return unprojectPoint(camera, x, y);
    },
    onTap(callback) {
      tapCallback = callback;
    },
    onFrame(callback) {
      frameCallback = callback;
    },
    requestRender() {
      requestDraw();
    },
    /** How the Dox layer supplies zone-boundary hit-testing without the engine
     *  holding a copy of the boundary set. */
    setRegionHitTest(fn) {
      regionHitTest = fn;
    },
    destroy() {
      destroyed = true;
      if (frameHandle) cancelAnimationFrame(frameHandle);
      if (drawHandle) cancelAnimationFrame(drawHandle);
      if (wakeTimer) clearTimeout(wakeTimer);
      resizeObserver.disconnect();
      dprQuery?.removeEventListener("change", onDprChange);
      document.removeEventListener("visibilitychange", onVisibility);
      if (renderer) {
        unbindInput(renderer.canvas);
        renderer.destroy();
      }
      host.removeAttribute(RENDERER_ATTRIBUTE);
      tapCallback = null;
      frameCallback = null;
    },
  };

  return engine;
}

/** The engine with the Dox layer's extra hook, for `../globe.ts` to type against. */
export type GlobeEngineWithHitTest = Awaited<
  ReturnType<typeof createGlobeEngine>
> & {
  setRegionHitTest(
    fn: ((lng: number, lat: number) => string | null) | null,
  ): void;
};

export { RENDERER_ATTRIBUTE };
export type { Controller };
