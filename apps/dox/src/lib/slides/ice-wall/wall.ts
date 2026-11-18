/**
 * The ice wall: captured landing pages hung in orbit, and the moment they break.
 *
 * `mountIceWall` owns one aria-hidden canvas on the space layer (`pointer-events: none`) and one
 * renderer, WebGPU when the globe runs on it and canvas-2D otherwise (a canvas that has asked for a
 * WebGPU context can never give a 2D one, so a failed GPU gets a fresh canvas). Geometry is
 * `frame.ts`; this file is the clock and the state.
 *
 * States, published as `data-wall` on the layer's host:
 * `whole` (hanging at a depth), `approach` (the camera flies in), `breaking` (shards in flight),
 * `gone` (the pins have landed), `hidden` (not on this slide).
 *
 * Time is the animation frame's own timestamp: a break marks the panes pending and the next frame
 * is their time zero, so the wall reads no clock. The loop runs only while something moves; a wall
 * at rest, whole or gone, asks for no frames.
 */
import type { GlobeEngine, Rgba } from "~/lib/globe/types";
import { acquireDevice } from "~/lib/globe/webgpu/device";
import { createCanvas2dRenderer } from "./draw-canvas2d";
import { createWebgpuRenderer } from "./draw-webgpu";
import {
  buildFrame,
  paneLayout,
  type FrameOutput,
  type Lens,
  type PaneModel,
} from "./frame";
import type { WallPaneImage, WallRenderer } from "./renderer";
import { arrivalMs } from "./shards";
import {
  cells as makeCells,
  hashSeed,
  mulberry32,
  type Point,
} from "./voronoi";

/** Shards per pane. */
export const SHARDS_PER_PANE = 24;
/**
 * The depth the approach ends at, as a fraction of the wall's rest distance. The panes hang down the
 * stage's side edges, so a deeper approach would carry them off the screen before they break.
 */
export const BREAK_DEPTH = 0.85;
/** How long the camera takes to fly in, milliseconds. */
export const APPROACH_MS = 900;

export type WallState = "whole" | "approach" | "breaking" | "gone" | "hidden";

export interface WallSource {
  id: string;
  image: HTMLImageElement | ImageBitmap | HTMLCanvasElement;
}

export interface WallOptions {
  /** The space layer: the canvas is appended to it. */
  layer: HTMLElement;
  engine: GlobeEngine;
  panes: readonly WallSource[];
  ice: Rgba;
  /** The stage's width in CSS pixels, which the panes are sized from. Defaults to the layer's. */
  stageWidth?: () => number;
  signal: AbortSignal;
  reduced: () => boolean;
  /** Where a zone's point is on screen now, or `null` when the globe cannot say. */
  target: (zone: string) => Point | null;
  /** A shard has become a pin. */
  onPin?: (zone: string) => void;
  /** The panes broke. */
  onBreak?: () => void;
}

export interface IceWall {
  readonly state: WallState;
  readonly renderer: "webgpu" | "canvas2d" | "pending";
  /** Shows the wall whole at a depth (1 at rest). */
  show(depth?: number): void;
  hide(): void;
  /** Sets the depth while the wall hangs (free flight). */
  setDepth(depth: number): void;
  /** Flies the camera in, then breaks the panes over `zones`. */
  flyThrough(zones: readonly string[]): void;
  /** Breaks at once, without the approach. */
  breakAll(zones: readonly string[]): void;
  /** Puts the panes back whole, as the camera retreats. */
  restore(): void;
  /** Where each pane's centre is on screen now, CSS pixels. */
  paneCentres(): Point[];
  /** How wide a pane is on screen now, CSS pixels (the panes are one size). */
  paneWidth(): number;
  destroy(): void;
}

const frameOf = (win: Window | null) => ({
  request: (cb: FrameRequestCallback): number =>
    win ? win.requestAnimationFrame(cb) : 0,
  cancel: (id: number): void => win?.cancelAnimationFrame(id),
});

export function mountIceWall(o: WallOptions): IceWall {
  const doc = o.layer.ownerDocument;
  const win = doc.defaultView;
  const timer = frameOf(win);
  const own = new AbortController();
  const signal = AbortSignal.any([o.signal, own.signal]);

  const models: PaneModel[] = o.panes.map((p) => {
    const seed = hashSeed(p.id);
    return {
      id: p.id,
      seed,
      cells: makeCells(seed, SHARDS_PER_PANE),
      rect: { x: 0, y: 0, w: 1, h: 1 },
      pins: [],
    } satisfies PaneModel;
  });

  let state: WallState = "hidden";
  let depth = 1;
  let approachFrom = 1;
  /** Frame timestamps. `null` start means "the next frame is zero". */
  let approachStart: number | null = null;
  let breakStart: number | null = null;
  let pendingBreak = false;
  let reducedBreak = false;
  let impacts: Point[] = models.map(() => [0.5, 0.5]);
  let width = 0;
  let height = 0;
  let raf = 0;
  let renderer: WallRenderer | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let release: (() => void) | null = null;
  let unlisten: (() => void) | null = null;
  let destroyed = false;
  let zonesToPin: readonly string[] = [];
  const pinned = new Set<string>();

  const setState = (next: WallState): void => {
    state = next;
    o.layer.dataset["wall"] = next;
  };

  let stageWidth = 0;

  /** The stage's box in the layer's pixels. The layer may be wider than the stage, which centres. */
  const stageBox = (): { x: number; y: number; w: number } => {
    const stage = doc.querySelector("[data-deck-stage]");
    if (stage) {
      const lr = o.layer.getBoundingClientRect();
      const sr = stage.getBoundingClientRect();
      if (sr.width > 0)
        return { x: sr.left - lr.left, y: sr.top - lr.top, w: sr.width };
    }
    return { x: 0, y: 0, w: stageWidth };
  };

  /** Puts each pane's rectangle where the stage wants it, measured from the lens centre. */
  const place = (): void => {
    const { centre } = o.engine.getView();
    const box = stageBox();
    const rects = paneLayout(
      models.length,
      box.w,
      centre.y - box.y,
      centre.x - box.x,
    );
    models.forEach((m, i) => {
      m.rect = rects[i]!;
    });
  };

  const layout = (): void => {
    width = o.layer.clientWidth;
    height = o.layer.clientHeight;
    stageWidth = o.stageWidth?.() || width;
    place();
  };

  const lens = (): Lens => {
    const view = o.engine.getView();
    return { cx: view.centre.x, cy: view.centre.y, focalPx: view.focalPx };
  };

  /** The point of each pane nearest the screen's centre, in pane units: where the camera hits. */
  const computeImpacts = (): void => {
    impacts = models.map((m) => {
      const u = -m.rect.x / m.rect.w;
      const v = -m.rect.y / m.rect.h;
      return [
        Math.min(1, Math.max(0, u)),
        Math.min(1, Math.max(0, v)),
      ] as Point;
    });
  };

  /** Spreads the zones over the panes: each gets the cells nearest its impact, spaced out. */
  const assignPins = (zones: readonly string[]): void => {
    models.forEach((m) => {
      m.pins = [];
    });
    const rank = models.map((m, i) => {
      const [ix, iy] = impacts[i]!;
      return m.cells
        .map((c, index) => ({
          index,
          d: Math.hypot(c.centroid[0] - ix, (c.centroid[1] - iy) * 0.625),
        }))
        .sort((a, b) => a.d - b.d)
        .map((r) => r.index);
    });
    zones.forEach((zone, i) => {
      const pane = i % models.length;
      const m = models[pane]!;
      const slot = Math.floor(i / models.length);
      const cell = rank[pane]![slot * 2]!;
      const bow = (mulberry32(m.seed ^ (i + 1))() - 0.5) * 0.5;
      m.pins = [
        ...m.pins,
        { cell, zone, arriveMs: arrivalMs(m.cells[cell]!, m.seed), bow },
      ];
    });
  };

  const draw = (out: FrameOutput | null): void => {
    renderer?.draw(out ? out.drawables : []);
  };

  const times = (now: number): (number | null)[] =>
    models.map(() => (breakStart === null ? null : now - breakStart));

  /** One frame at timestamp `now`, or a still frame when `now` is `null`. */
  const render = (now: number | null): FrameOutput | null => {
    if (!renderer || state === "hidden") return null;
    if (state === "gone") {
      draw(null);
      return null;
    }
    /* The panes hang on the stage, so they follow it, and the lens centre, if either moves. A break holds the geometry it started with. */
    if (state !== "breaking") place();
    const out = buildFrame({
      lens: lens(),
      z: depth,
      panes: models,
      times:
        state === "breaking" && now !== null
          ? times(now)
          : models.map(() => null),
      impacts,
      reduced: reducedBreak,
      target: o.target,
    });
    draw(out);
    return out;
  };

  const loop = (now: number): void => {
    raf = 0;
    if (destroyed || state === "hidden" || state === "gone") return;
    if (state === "approach") {
      approachStart ??= now;
      const k = Math.min(1, (now - approachStart) / APPROACH_MS);
      depth = approachFrom + (BREAK_DEPTH - approachFrom) * k * k * k;
      render(now);
      if (k >= 1) startBreak();
      schedule();
      return;
    }
    if (state === "breaking") {
      if (pendingBreak) {
        breakStart = now;
        pendingBreak = false;
      }
      const out = render(now);
      for (const zone of out?.arrived ?? [])
        if (!pinned.has(zone)) {
          pinned.add(zone);
          o.onPin?.(zone);
        }
      if (out?.moving) schedule();
      else {
        for (const zone of zonesToPin)
          if (!pinned.has(zone)) {
            pinned.add(zone);
            o.onPin?.(zone);
          }
        setState("gone");
        draw(null);
      }
    }
  };

  function schedule(): void {
    if (raf || destroyed) return;
    raf = timer.request(loop);
  }

  function startBreak(): void {
    reducedBreak = o.reduced();
    computeImpacts();
    assignPins(zonesToPin);
    pinned.clear();
    breakStart = null;
    pendingBreak = true;
    setState("breaking");
    o.onBreak?.();
    schedule();
  }

  const freshCanvas = (): HTMLCanvasElement => {
    const c = doc.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    c.dataset["wallCanvas"] = "";
    c.style.pointerEvents = "none";
    return c;
  };

  /* The renderer: WebGPU when the globe is on it, canvas-2D otherwise, or on any failure. */
  async function makeRenderer(): Promise<void> {
    const paneImages: WallPaneImage[] = o.panes.map((p, i) => ({
      id: p.id,
      image: p.image,
      cells: models[i]!.cells,
    }));
    let made: WallRenderer | null = null;
    let used: HTMLCanvasElement | null = null;
    if (o.engine.renderer === "webgpu") {
      try {
        const gpu = await acquireDevice(() => fallBack(paneImages));
        if (signal.aborted) {
          gpu.release();
          return;
        }
        const c = freshCanvas();
        const r = await createWebgpuRenderer(
          { canvas: c, panes: paneImages, ice: o.ice },
          { device: gpu.device, format: gpu.canvasFormat },
        );
        if (r) {
          made = r;
          used = c;
          release = gpu.release;
          /* A device that was handed out can still fail on a frame (a validation error, a lost
             context). The globe falls back to canvas-2D when that happens; the wall does the same,
             or its panes would stay blank over a working globe. */
          const onError = (): void => fallBack(paneImages);
          gpu.device.addEventListener?.("uncapturederror", onError);
          unlisten = () =>
            gpu.device.removeEventListener?.("uncapturederror", onError);
        } else gpu.release();
      } catch {
        made = null;
      }
    }
    if (!made) {
      const c = freshCanvas();
      made = createCanvas2dRenderer({
        canvas: c,
        panes: paneImages,
        ice: o.ice,
      });
      used = c;
    }
    if (signal.aborted || !made || !used) {
      made?.destroy();
      return;
    }
    install(made, used);
  }

  function install(made: WallRenderer, used: HTMLCanvasElement): void {
    renderer = made;
    canvas = used;
    o.layer.append(used);
    resize();
    render(null);
  }

  /* Swaps a failed WebGPU renderer for canvas-2D on a fresh canvas (a canvas that has taken a
     WebGPU context can never give a 2D one). */
  function fallBack(paneImages: WallPaneImage[]): void {
    const failed = renderer;
    if (destroyed || signal.aborted || !failed || failed.kind !== "webgpu")
      return;
    unlisten?.();
    unlisten = null;
    failed.destroy();
    canvas?.remove();
    release?.();
    release = null;
    const c = freshCanvas();
    const next = createCanvas2dRenderer({
      canvas: c,
      panes: paneImages,
      ice: o.ice,
    });
    if (next) install(next, c);
    else {
      renderer = null;
      canvas = null;
    }
  }

  function resize(): void {
    if (!renderer || !canvas) return;
    layout();
    const dpr = Math.min(win?.devicePixelRatio ?? 1, 1.5);
    renderer.resize(width, height, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    if (state !== "breaking" && state !== "approach") render(null);
  }

  const observer =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => resize())
      : null;
  observer?.observe(o.layer);
  layout();
  setState("hidden");
  void makeRenderer();

  const cancelLoop = (): void => {
    if (raf) timer.cancel(raf);
    raf = 0;
  };

  const handle: IceWall = {
    get state() {
      return state;
    },
    get renderer() {
      return renderer ? renderer.kind : "pending";
    },
    show(z = 1) {
      cancelLoop();
      depth = z;
      breakStart = null;
      pendingBreak = false;
      pinned.clear();
      setState("whole");
      render(null);
    },
    hide() {
      cancelLoop();
      setState("hidden");
      renderer?.draw([]);
    },
    setDepth(z) {
      if (state !== "whole" || z === depth) return;
      depth = z;
      render(null);
    },
    flyThrough(zones) {
      zonesToPin = zones;
      if (state === "hidden") return;
      if (o.reduced()) {
        startBreak();
        return;
      }
      approachFrom = depth;
      approachStart = null;
      setState("approach");
      schedule();
    },
    breakAll(zones) {
      zonesToPin = zones;
      if (state === "hidden") return;
      cancelLoop();
      startBreak();
    },
    restore() {
      cancelLoop();
      depth = 1;
      pinned.clear();
      breakStart = null;
      pendingBreak = false;
      setState("whole");
      render(null);
    },
    paneCentres() {
      const l = lens();
      return models.map((m) => {
        const s = l.focalPx / (l.focalPx * depth);
        return [
          l.cx + (m.rect.x + m.rect.w / 2) * s,
          l.cy + (m.rect.y + m.rect.h / 2) * s,
        ] as Point;
      });
    },
    paneWidth() {
      const first = models[0];
      return first ? first.rect.w / depth : 0;
    },
    destroy: () => own.abort(),
  };

  signal.addEventListener(
    "abort",
    () => {
      destroyed = true;
      cancelLoop();
      observer?.disconnect();
      unlisten?.();
      unlisten = null;
      renderer?.destroy();
      renderer = null;
      release?.();
      release = null;
      canvas?.remove();
      canvas = null;
      delete o.layer.dataset["wall"];
    },
    { once: true },
  );
  if (signal.aborted) own.abort();

  return handle;
}
