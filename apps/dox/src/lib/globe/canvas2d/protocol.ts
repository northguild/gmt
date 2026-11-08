/**
 * The messages between the page and the canvas-2D worker (#289).
 *
 * Everything the worker needs rides in the `frame` message, and only what changed since the
 * last one is included, so a burst of marker, theme and size updates costs one message and
 * the worker always draws the newest state. The page sends a frame only after the worker has
 * reported the previous one `drawn`: a worker that takes 100 ms a frame under CPU throttle
 * never builds a queue of stale frames to work through.
 *
 * Nothing flows back that the page needs for input. Hit-testing, tooltip placement and
 * keyboard focus use the camera the page already owns (`../camera.ts`), on every renderer.
 */

import type { FrameState } from "../renderer";
import type { GlobeArc, GlobeMarker, GlobeRegion, GlobeTheme } from "../types";
import {
  createPainter,
  type Context2d,
  type Painter,
  type Surface,
} from "./painter";

export interface SizeState {
  width: number;
  height: number;
  dpr: number;
}

export interface InitMessage {
  type: "init";
  canvas: OffscreenCanvas;
  theme: GlobeTheme;
  labelFont: string;
}

export interface FrameMessage {
  type: "frame";
  /** Echoed in `drawn`, so the page can tell which frame finished. */
  seq: number;
  frame: FrameState;
  size?: SizeState;
  theme?: GlobeTheme;
  regions?: readonly GlobeRegion[];
  markers?: readonly GlobeMarker[];
  arcs?: readonly GlobeArc[];
}

export interface DestroyMessage {
  type: "destroy";
}

export type ToWorker = InitMessage | FrameMessage | DestroyMessage;

export type FromWorker =
  | { type: "ready" }
  | { type: "drawn"; seq: number }
  | { type: "failed"; reason: string };

/**
 * The worker's side of the protocol, with the platform handed in so a test drives it without a
 * worker: `post` replies to the page, `makeBuffer` makes a scratch canvas.
 */
export function createWorkerHost(
  post: (message: FromWorker) => void,
  makeBuffer: () => Surface,
): { handle(message: ToWorker): void } {
  let painter: Painter | null = null;

  function fail(error: unknown): void {
    post({
      type: "failed",
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  function handleInit(message: InitMessage): void {
    const context = message.canvas.getContext("2d") as Context2d | null;
    if (!context) {
      post({ type: "failed", reason: "canvas 2D is unavailable" });
      return;
    }
    painter = createPainter({
      surface: message.canvas,
      context,
      makeBuffer,
      theme: message.theme,
      labelFont: message.labelFont,
    });
    post({ type: "ready" });
  }

  function handleFrame(message: FrameMessage): void {
    if (!painter) return;
    if (message.theme) painter.setTheme(message.theme);
    if (message.size) {
      painter.resize(message.size.width, message.size.height, message.size.dpr);
    }
    if (message.regions) painter.setRegions(message.regions);
    if (message.markers) painter.setMarkers(message.markers);
    if (message.arcs) painter.setArcs(message.arcs);
    painter.render(message.frame);
    post({ type: "drawn", seq: message.seq });
  }

  return {
    handle(message) {
      try {
        if (message.type === "init") handleInit(message);
        else if (message.type === "frame") handleFrame(message);
        else {
          painter?.destroy();
          painter = null;
        }
      } catch (error) {
        fail(error);
      }
    },
  };
}
