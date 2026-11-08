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
import { createController, IDLE_MS, type Controller } from "./controller";
import {
  DAWN_END_MS,
  dawnExposure,
  FALLBACK_FADE_MS,
  fallbackOpacity,
} from "./dawn";
import type {
  CreateRenderer,
  FrameState,
  GlobeRenderer,
  RendererInit,
} from "./renderer";
import { canDrawOffThread } from "./off-thread-support";
import { subsolarPoint } from "./sun";
import { sunDirection } from "./camera";
import type {
  GlobeArc,
  GlobeEngine,
  GlobeMarker,
  GlobeInteraction,
  GlobeOptions,
  GlobeRegion,
  GlobeTheme,
  LngLat,
  RendererKind,
} from "./types";

/** Device pixel ratio is capped here unless the host asks for less: past 2 the
 *  cost doubles for no visible gain on a globe made of washes and thin strokes. */
const MAX_DPR = 2;

/** While only the ambient spin moves the globe (2 degrees a second, under a pixel a frame at
 *  60 Hz), it is drawn at most this often, in milliseconds. The Earth now fills the landing hero,
 *  so a draw at every vsync saturates the main thread of a machine without a GPU raster and drops
 *  frames across the whole page; at 30 Hz the spin steps by under 0.75 px. Any other motion draws
 *  at every frame. */
const AMBIENT_FRAME_MS = 30;

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
  let centreX = 0.5;
  let centreY = 0.5;
  let framed = false;

  let frameHandle = 0;
  /** The `requestAnimationFrame` time of the last loop draw. */
  let lastLoopDraw = -Infinity;
  /** A one-off redraw asked for from outside the animation loop. */
  let drawHandle = 0;
  let wakeTimer: ReturnType<typeof setTimeout> | undefined;

  let tapCallback: Parameters<GlobeEngine["onTap"]>[0] | null = null;
  let frameCallback: (() => void) | null = null;
  let interactCallback: ((kind: GlobeInteraction) => void) | null = null;
  /** Whether the frame loop is held off because the host scrolled out of view. */
  let offscreen = false;
  /** Whether something drawn over the globe (the search dialog, the mobile menu) hides it. */
  let covered = false;
  const held = (): boolean => offscreen || covered;
  const maxDpr = options.maxDpr ?? MAX_DPR;
  const hitArea = options.hitArea;

  const sun: [number, number, number] = [0, 0, 1];

  // --- the dawn entrance ---------------------------------------------------

  const dawnMode = options.entrance === "dawn";
  /** When `startDawn()` was called, on the engine's clock. */
  let dawnStart: number | null = null;
  let dawnOver = !dawnMode;
  let dawnDone: Promise<void> | null = null;
  let finishDawnPromise: () => void = () => {};
  /** Whether the reader worked the globe during the dawn, which then owns the spin's start. */
  let touched = false;

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

  /**
   * `mainThread` skips the worker: used when a worker renderer has just failed, and by a caller
   * that sets `GlobeOptions.offThread` to false.
   */
  async function loadRenderer(
    kind: RendererKind,
    mainThread = options.offThread === false,
  ): Promise<GlobeRenderer> {
    const init: RendererInit = {
      host,
      theme,
      labelFont: options.labelFont,
      ariaLabel: options.ariaLabel,
      imageryUrl: options.imageryUrl,
      invalidate: () => requestDraw(),
      entrance: options.entrance ?? "fade",
      reducedMotion,
    };
    if (kind === "canvas2d" && !mainThread && canDrawOffThread()) {
      /* The raster goes to a worker so a 100 ms frame cannot hold up input. Any refusal — a
         module worker the browser will not start, a script that fails to load — falls through
         to drawing on the main thread, so the globe is never blank. */
      try {
        return await (
          await import("./canvas2d/renderer-canvas2d-worker")
        ).createWorkerCanvas2dRenderer(init);
      } catch (error) {
        console.info(`globe: canvas 2D worker unavailable (${String(error)})`);
      }
    }
    const create: CreateRenderer =
      kind === "webgpu"
        ? (await import("./webgpu/renderer-webgpu")).createWebgpuRenderer
        : (await import("./canvas2d/renderer-canvas2d")).createCanvas2dRenderer;
    return create(init);
  }

  let adoptedBefore = false;

  /** Attach a renderer, wire its failure hook, size it and draw once. */
  function adoptRenderer(next: GlobeRenderer): void {
    /* The first canvas is brought in by the host's entrance (`revealCanvas` in
       `../globe.ts`), which runs once. A renderer adopted after a device loss
       has a fresh canvas that nothing will ever reveal, and the stylesheet keeps
       a canvas without `data-entered` at opacity 0 — so it is marked entered
       here, and the globe comes back instead of staying blank. */
    if (adoptedBefore || dawnMode) next.canvas.setAttribute("data-entered", "");
    adoptedBefore = true;
    /* The fallback has no exposure: until the dawn starts its canvas is clear, and `draw` fades
       it in. */
    if (!dawnOver && dawnStart === null && next.kind === "canvas2d") {
      next.canvas.style.opacity = "0";
    }
    renderer = next;
    host.setAttribute(RENDERER_ATTRIBUTE, next.kind);
    next.setTheme(theme);
    next.setRegions(regions);
    next.setMarkers(markers);
    next.setArcs(arcs);
    next.onFailure(handleRendererFailure);
    if (hitArea) {
      /* The hit area is the interactive, focusable, named stand-in for the canvas, which sits
         under it for show only: one tab stop, one name, not two. */
      next.canvas.tabIndex = -1;
      next.canvas.removeAttribute("role");
      next.canvas.removeAttribute("aria-label");
      next.canvas.setAttribute("aria-hidden", "true");
      hitArea.tabIndex = 0;
      hitArea.setAttribute("role", "img");
      hitArea.setAttribute("aria-label", options.ariaLabel);
    }
    bindInput(inputTarget(next));
    measure();
  }

  function handleRendererFailure(reason: string): void {
    if (destroyed || !renderer) return;
    const workerFailed = renderer.offThread === true;
    if (renderer.kind !== "webgpu" && !workerFailed) return;
    console.warn(
      `globe: ${workerFailed ? "canvas 2D worker" : "WebGPU renderer"} failed (${reason})`,
    );
    const previous = renderer;
    renderer = null;
    unbindInput(inputTarget(previous));
    previous.destroy();

    /* One retry, and only once the tab is visible: a device lost while hidden is
       usually the browser reclaiming the GPU, and re-requesting it immediately
       tends to lose it again. */
    const recover = async () => {
      if (destroyed) return;
      if (!workerFailed && !deviceLossRetried) {
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
        adoptRenderer(await loadRenderer("canvas2d", workerFailed));
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
    dpr = Math.min(globalThis.devicePixelRatio || 1, maxDpr);
    if (options.framing) {
      const frame = options.framing(width, height);
      centreX = frame.cx;
      centreY = frame.cy;
      baseScale = frame.radius;
    } else {
      centreX = width / 2;
      centreY = height / 2;
      baseScale = (Math.min(width, height) / 2) * BASE_SCALE_FACTOR;
    }
    framed = true;
    renderer.resize(width, height, dpr);
    draw();
  }

  const resizeObserver = new ResizeObserver(() => measure());
  resizeObserver.observe(host);
  for (const watched of options.framingWatch ?? [])
    resizeObserver.observe(watched);

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

  /** Whether the dawn is running: started and not yet over. */
  const dawning = (): boolean => dawnStart !== null && !dawnOver;

  /** When this backend's dawn ends: the GPU ramp, or the fallback's shorter fade. */
  const dawnEnd = (): number =>
    renderer?.kind === "canvas2d" ? FALLBACK_FADE_MS : DAWN_END_MS;

  function buildFrame(now: number): FrameState {
    camera.rotation[0] = controller.rotation[0];
    camera.rotation[1] = controller.rotation[1];
    syncCamera(camera);
    camera.radius = baseScale * controller.zoom;
    camera.centreX = centreX;
    camera.centreY = centreY;

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
      exposure:
        dawning() && renderer?.kind !== "canvas2d"
          ? dawnExposure(now - (dawnStart as number))
          : 1,
    };
  }

  let placedRadius = NaN;
  let placedX = NaN;
  let placedY = NaN;

  /** Lay the hit area over the disc, only when the disc has moved or resized. */
  function placeHitArea(): void {
    if (!hitArea || !framed) return;
    const r = camera.radius;
    if (r === placedRadius && centreX === placedX && centreY === placedY) {
      return;
    }
    placedRadius = r;
    placedX = centreX;
    placedY = centreY;
    const size = `${2 * r}px`;
    hitArea.style.transform = `translate(${centreX - r}px, ${centreY - r}px)`;
    hitArea.style.width = size;
    hitArea.style.height = size;
  }

  function draw(): void {
    if (destroyed || !renderer) return;
    /* A dawn entrance paints nothing until it is asked to. */
    if (dawnMode && dawnStart === null) return;
    const now = performanceNow();
    renderer.render(buildFrame(now));
    placeHitArea();
    if (dawning()) {
      const elapsed = now - (dawnStart as number);
      if (renderer.kind === "canvas2d") {
        renderer.canvas.style.opacity = String(fallbackOpacity(elapsed));
      }
      if (elapsed >= dawnEnd()) finishDawn(now);
    }
    frameCallback?.();
  }

  /** The Earth is fully lit: show the end state, and let the spin ease in from here. */
  function finishDawn(now: number): void {
    dawnOver = true;
    renderer?.canvas.style.removeProperty("opacity");
    host.setAttribute("data-dawn", "done");
    if (!touched) controller.markInteraction(now - IDLE_MS);
    finishDawnPromise();
    schedule();
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
    if (destroyed || document.hidden || held() || frameHandle || drawHandle) {
      return;
    }
    drawHandle = requestAnimationFrame(() => {
      drawHandle = 0;
      draw();
    });
  }

  function step(now: number): void {
    frameHandle = 0;
    controller.step(now);
    /* Scheduled before drawing, so a renderer that asks for another frame
       from inside `render` (`RendererInit.invalidate`) finds this one already
       pending and adds nothing. The other way round it queued a second draw
       for the same vsync. */
    schedule();
    if (
      controller.isAmbientOnly() &&
      !dawning() &&
      now - lastLoopDraw < AMBIENT_FRAME_MS
    ) {
      return;
    }
    lastLoopDraw = now;
    draw();
  }

  /** Ask for the next frame, or set the one timer that wakes the ambient spin. */
  function schedule(): void {
    if (destroyed || document.hidden || held()) return;
    /* A dawn entrance has no loop, and the spin no wake timer, until it starts. */
    if (dawnMode && dawnStart === null) return;
    if (controller.needsFrame() || dawning()) {
      if (!frameHandle) frameHandle = requestAnimationFrame(step);
      return;
    }
    /* A frame already pending schedules whatever follows it. A wake timer set beside it would
       fire `step`, which forgets that frame and leaves it running past a `destroy`. */
    if (frameHandle) return;
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
    touched = true;
    controller.pointerDown(
      event.pointerId,
      event.clientX,
      event.clientY,
      event.timeStamp,
    );
    try {
      inputElement().setPointerCapture(event.pointerId);
    } catch {
      // Some input stacks, and any synthesised pointer event, have no live
      // pointer to capture. Drag and tap both work without it.
    }
    schedule();
  }

  function onPointerMove(event: PointerEvent): void {
    const kind = controller.pointerMove(
      event.pointerId,
      event.clientX,
      event.clientY,
      event.timeStamp,
      camera.radius,
    );
    if (kind) interactCallback?.(kind);
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
      inputElement().releasePointerCapture?.(event.pointerId);
    } catch {
      // Capture may already be gone; releasing it is best-effort.
    }
    if (result.tap) {
      hitTest(result.x, result.y);
      interactCallback?.("tap");
    }
    schedule();
  }

  function onPointerCancel(event: PointerEvent): void {
    controller.pointerCancel(event.pointerId);
    schedule();
  }

  function onWheel(event: WheelEvent): void {
    touched = true;
    /* Only swallow the event when the globe actually zoomed. At a zoom limit the
       wheel belongs to the page, so a reader who scrolls down onto the hero
       globe is not trapped there. */
    if (controller.wheel(event.deltaY, event.timeStamp)) {
      event.preventDefault();
      interactCallback?.("wheel");
    }
    schedule();
  }

  function onKeyDown(event: KeyboardEvent): void {
    touched = true;
    if (!controller.key(event.key, event.timeStamp)) return;
    event.preventDefault();
    interactCallback?.("key");
    schedule();
  }

  function onPointerEnter(event: PointerEvent): void {
    controller.setHovered(true, event.timeStamp);
  }

  function onPointerLeave(event: PointerEvent): void {
    controller.setHovered(false, event.timeStamp);
    schedule();
  }

  /** What takes input: the host's hit area when it gave one, else the canvas. */
  function inputTarget(live: GlobeRenderer): HTMLElement {
    return hitArea ?? live.canvas;
  }

  function inputElement(): HTMLElement {
    return hitArea ?? (renderer as GlobeRenderer).canvas;
  }

  function bindInput(canvas: HTMLElement): void {
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerenter", onPointerEnter);
    canvas.addEventListener("pointerleave", onPointerLeave);
  }

  function unbindInput(canvas: HTMLElement): void {
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

  /* Held (out of view, or covered) the loop stops entirely: no frame, no wake timer. Coming back
     is treated like a returning tab, so a spin does not resume from a stale timestamp, and it
     carries on from the rotation it stopped at. */
  function applyHold(): void {
    if (held()) {
      if (frameHandle) cancelAnimationFrame(frameHandle);
      if (drawHandle) cancelAnimationFrame(drawHandle);
      if (wakeTimer) clearTimeout(wakeTimer);
      frameHandle = 0;
      drawHandle = 0;
      return;
    }
    controller.markInteraction(performanceNow());
    requestDraw();
    schedule();
  }

  let viewObserver: IntersectionObserver | undefined;
  if (options.pauseWhenHidden && typeof IntersectionObserver === "function") {
    viewObserver = new IntersectionObserver((entries) => {
      const visible = entries[entries.length - 1]?.isIntersecting ?? true;
      if (visible === !offscreen) return;
      offscreen = !visible;
      applyHold();
    });
    viewObserver.observe(options.pauseWhenHidden);
  }

  /* The host says when something covers the globe; the subscription is dropped on `destroy()`. */
  const stopWatchingCover = options.pauseWhile?.((next) => {
    if (next === covered || destroyed) return;
    covered = next;
    applyHold();
  });

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
    dawnReady: started.ready ?? Promise.resolve(),
    startDawn() {
      if (dawnDone) return dawnDone;
      dawnDone = new Promise<void>((resolve) => (finishDawnPromise = resolve));
      if (!dawnMode || destroyed) {
        finishDawnPromise();
        return dawnDone;
      }
      dawnStart = performanceNow();
      // The spin has waited for the dawn: its idle time counts from here.
      controller.markInteraction(dawnStart);
      if (reducedMotion()) {
        // Exposure 1 at once: a frame at full light, and the dawn is over.
        finishDawn(dawnStart);
        draw();
        return dawnDone;
      }
      draw();
      schedule();
      return dawnDone;
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
    getCentre: () => ({
      x: camera.centreX,
      y: camera.centreY,
      radius: camera.radius,
    }),
    onTap(callback) {
      tapCallback = callback;
    },
    onInteract(callback) {
      interactCallback = callback;
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
      viewObserver?.disconnect();
      stopWatchingCover?.();
      dprQuery?.removeEventListener("change", onDprChange);
      document.removeEventListener("visibilitychange", onVisibility);
      if (renderer) {
        unbindInput(inputTarget(renderer));
        renderer.destroy();
      }
      host.removeAttribute(RENDERER_ATTRIBUTE);
      host.removeAttribute("data-dawn");
      tapCallback = null;
      frameCallback = null;
      interactCallback = null;
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
