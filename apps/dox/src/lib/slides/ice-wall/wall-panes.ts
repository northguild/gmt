/**
 * The ice wall's panes: where each one hangs, and where its shards land. A pane hangs over its
 * card on the page, at the wall's depth, or on the stage grid (`paneLayout`) when it has none; at
 * the break the zones are spread over the shards nearest the point the camera hits. Geometry only:
 * `wall.ts` owns the clock and the state, `wall-surface.ts` the drawing.
 */
import type { GlobeEngine } from "~/lib/globe/types";
import { paneLayout, type PaneModel } from "./frame";
import { arrivalMs } from "./shards";
import {
  cells as makeCells,
  hashSeed,
  mulberry32,
  type Point,
} from "./voronoi";

/** Shards per pane. */
const SHARDS_PER_PANE = 24;

export interface WallSource {
  id: string;
  image: HTMLImageElement | ImageBitmap | HTMLCanvasElement;
  /**
   * The card on the page that the pane hangs over. While the wall is whole each pane is drawn on
   * its card's box, at any depth, so a resize or a browser zoom cannot part them. Without cards the
   * panes take the stage grid (`paneLayout`).
   */
  card?: HTMLElement;
}

interface PanesDeps {
  /** The space layer the panes are measured in. */
  layer: HTMLElement;
  engine: GlobeEngine;
  panes: readonly WallSource[];
  /** The stage's width in CSS pixels, which the panes are sized from. Defaults to the layer's. */
  stageWidth?: () => number;
}

interface WallPanes {
  readonly models: readonly PaneModel[];
  /** The page cards the panes hang over, for observing their size. */
  readonly cards: readonly HTMLElement[];
  /** Measures the layer and puts each pane where it hangs at `depth`; returns the layer's size. */
  layout(depth: number): { width: number; height: number };
  /**
   * Puts each pane where it hangs at `depth`, without measuring the layer again. The cards are
   * measured again too unless `measured` is `false`, when the boxes from the last measure stand.
   */
  place(depth: number, measured?: boolean): void;
  /** The point of each pane nearest the screen's centre, in pane units: where the camera hits. */
  readonly impacts: readonly Point[];
  computeImpacts(): void;
  /** Spreads the zones over the panes: each gets the cells nearest its impact, spaced out. */
  assignPins(zones: readonly string[]): void;
  /** Where each pane's centre is on screen now, CSS pixels. */
  centres(depth: number): Point[];
  /** How wide a pane is on screen now, CSS pixels (the panes are one size). */
  width(depth: number): number;
}

export function createWallPanes(d: PanesDeps): WallPanes {
  const models: PaneModel[] = d.panes.map((p) => {
    const seed = hashSeed(p.id);
    return {
      id: p.id,
      seed,
      cells: makeCells(seed, SHARDS_PER_PANE),
      rect: { x: 0, y: 0, w: 1, h: 1 },
      pins: [],
    } satisfies PaneModel;
  });
  const cardOf = d.panes.map((p) => p.card ?? null);
  let impacts: Point[] = models.map(() => [0.5, 0.5]);
  let stageWidth = 0;

  /** The stage's box in the layer's pixels. The layer may be wider than the stage, which centres. */
  const stageBox = (): { x: number; y: number; w: number } => {
    const stage = d.layer.ownerDocument.querySelector("[data-deck-stage]");
    if (stage) {
      const lr = d.layer.getBoundingClientRect();
      const sr = stage.getBoundingClientRect();
      if (sr.width > 0)
        return { x: sr.left - lr.left, y: sr.top - lr.top, w: sr.width };
    }
    return { x: 0, y: 0, w: stageWidth };
  };

  /** Each card's box in the layer's pixels, or `null` unless every pane has a card with a size. */
  const cardBoxes = ():
    | { x: number; y: number; w: number; h: number }[]
    | null => {
    if (cardOf.some((card) => card === null)) return null;
    const lr = d.layer.getBoundingClientRect();
    const boxes = cardOf.map((card) => {
      const r = card!.getBoundingClientRect();
      return {
        x: r.left - lr.left,
        y: r.top - lr.top,
        w: r.width,
        h: r.height,
      };
    });
    return boxes.every((b) => b.w > 0 && b.h > 0) ? boxes : null;
  };

  /* The boxes from the last measure. A depth change alone moves nothing on the page, and it comes
     on every frame of a flight, where reading a box would force a style and layout pass. */
  let boxes: ReturnType<typeof cardBoxes> = null;
  let box: ReturnType<typeof stageBox> = { x: 0, y: 0, w: 0 };
  const measure = (): void => {
    boxes = cardBoxes();
    if (!boxes) box = stageBox();
  };

  /**
   * Puts each pane's rectangle where it hangs, measured from the lens centre at the wall's depth:
   * over its card when the panes have cards, so it lands on the card's box on screen, and on the
   * stage grid otherwise.
   */
  const place = (depth: number, measured = true): void => {
    if (measured) measure();
    const { centre } = d.engine.getView();
    if (boxes) {
      models.forEach((m, i) => {
        const b = boxes![i]!;
        m.rect = {
          x: (b.x - centre.x) * depth,
          y: (b.y - centre.y) * depth,
          w: b.w * depth,
          h: b.h * depth,
        };
      });
      return;
    }
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

  return {
    models,
    cards: cardOf.filter((card): card is HTMLElement => card !== null),
    layout(depth) {
      const width = d.layer.clientWidth;
      const height = d.layer.clientHeight;
      stageWidth = d.stageWidth?.() || width;
      place(depth);
      return { width, height };
    },
    place,
    get impacts() {
      return impacts;
    },
    computeImpacts() {
      impacts = models.map((m) => {
        const u = -m.rect.x / m.rect.w;
        const v = -m.rect.y / m.rect.h;
        return [
          Math.min(1, Math.max(0, u)),
          Math.min(1, Math.max(0, v)),
        ] as Point;
      });
    },
    assignPins(zones) {
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
    },
    centres(depth) {
      const view = d.engine.getView();
      return models.map((m) => {
        const s = view.focalPx / (view.focalPx * depth);
        return [
          view.centre.x + (m.rect.x + m.rect.w / 2) * s,
          view.centre.y + (m.rect.y + m.rect.h / 2) * s,
        ] as Point;
      });
    },
    width(depth) {
      const first = models[0];
      return first ? first.rect.w / depth : 0;
    },
  };
}
