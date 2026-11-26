/**
 * The ice wall: captured landing pages hung in orbit, and the moment they break.
 *
 * `mountIceWall` is the clock and the state. The panes' geometry is `wall-panes.ts` and `frame.ts`;
 * the canvas and its renderer, WebGPU or canvas-2D, are `wall-surface.ts`.
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
import { buildFrame, type FrameOutput, type Lens } from "./frame";
import { createWallRun } from "./wall-run";
import { createWallPanes, type WallSource } from "./wall-panes";
import { createWallSurface } from "./wall-surface";
import type { Point } from "./voronoi";

export type WallState = "whole" | "approach" | "breaking" | "gone" | "hidden";

interface WallOptions {
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
  /** The wall's state changed. */
  onState?: (state: WallState) => void;
  /** The wall was drawn whole, so `paneCentres` and `paneWidth` may have changed. */
  onDrawn?: () => void;
}

export interface IceWall {
  readonly state: WallState;
  readonly renderer: "webgpu" | "canvas2d" | "pending";
  /** Shows the wall whole at a depth (1 at rest). */
  show(depth?: number): void;
  hide(): void;
  /**
   * Sets the depth while the wall hangs (free flight). It runs on every frame of a flight, so it
   * keeps the cards' boxes from the last measure: a depth change moves nothing on the page.
   */
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

export function mountIceWall(o: WallOptions): IceWall {
  const doc = o.layer.ownerDocument;
  const own = new AbortController();
  const signal = AbortSignal.any([o.signal, own.signal]);
  const geometry = createWallPanes(o);
  const { models } = geometry;

  let state: WallState = "hidden";

  const setState = (next: WallState): void => {
    state = next;
    o.layer.dataset["wall"] = next;
    o.onState?.(next);
  };

  const lens = (): Lens => {
    const view = o.engine.getView();
    return { cx: view.centre.x, cy: view.centre.y, focalPx: view.focalPx };
  };

  const surface = createWallSurface({
    layer: o.layer,
    engine: o.engine,
    ice: o.ice,
    panes: o.panes.map((p, i) => ({
      id: p.id,
      image: p.image,
      cells: models[i]!.cells,
    })),
    signal,
    measure: () => geometry.layout(run.depth),
    onResize: () => {
      if (state !== "breaking" && state !== "approach") render(null);
    },
    onInstall: () => render(null),
  });

  const times = (now: number): (number | null)[] => {
    const elapsed = run.elapsed(now);
    return models.map(() => elapsed);
  };

  /**
   * One frame at timestamp `now`, or a still frame when `now` is `null`. A whole wall measures its
   * cards again unless `measured` is `false`: a depth change alone does not move them.
   */
  const render = (now: number | null, measured = true): FrameOutput | null => {
    if (!surface.ready || state === "hidden") return null;
    if (state === "gone") {
      surface.draw([]);
      return null;
    }
    /* The panes hang on their cards, so they follow them, and the lens centre, if either moves. The
       approach and the break hold the geometry the wall had when they started. */
    if (state === "whole") geometry.place(run.depth, measured);
    const out = buildFrame({
      lens: lens(),
      z: run.depth,
      panes: models,
      times:
        state === "breaking" && now !== null
          ? times(now)
          : models.map(() => null),
      impacts: geometry.impacts,
      reduced: run.reducedBreak,
      target: o.target,
    });
    surface.draw(out.drawables);
    if (state === "whole") o.onDrawn?.();
    return out;
  };

  const run = createWallRun({
    win: doc.defaultView,
    reduced: o.reduced,
    state: () => state,
    setState,
    render,
    clear: () => surface.draw([]),
    prepareBreak: (zones) => {
      geometry.computeImpacts();
      geometry.assignPins(zones);
    },
    onPin: o.onPin,
    onBreak: o.onBreak,
  });

  // A card can change size while the layer does not (a font loads, the slide reflows).
  const cardObserver =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          if (state === "whole") render(null);
        })
      : null;
  for (const card of geometry.cards) cardObserver?.observe(card);
  geometry.layout(run.depth);
  setState("hidden");
  surface.start();

  const handle: IceWall = {
    get state() {
      return state;
    },
    get renderer() {
      return surface.kind;
    },
    show: (z = 1) => run.hang(z),
    hide() {
      run.cancel();
      setState("hidden");
      surface.draw([]);
    },
    setDepth(z) {
      if (state !== "whole" || z === run.depth) return;
      run.depth = z;
      render(null, false);
    },
    flyThrough: run.approach,
    breakAll: run.breakNow,
    restore: () => run.hang(1),
    paneCentres: () => geometry.centres(run.depth),
    paneWidth: () => geometry.width(run.depth),
    destroy: () => own.abort(),
  };

  signal.addEventListener(
    "abort",
    () => {
      run.stop();
      cardObserver?.disconnect();
      surface.destroy();
      delete o.layer.dataset["wall"];
    },
    { once: true },
  );
  if (signal.aborted) own.abort();

  return handle;
}
