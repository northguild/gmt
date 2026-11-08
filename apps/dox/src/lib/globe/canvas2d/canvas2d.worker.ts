/**
 * The canvas-2D globe's worker entry (#289): draws on the `OffscreenCanvas` the page
 * transferred, so the raster never blocks input. The protocol and the drawing are in
 * `./protocol.ts` and `./painter.ts`; this file only connects them to the worker's port.
 */

import { createWorkerHost, type FromWorker, type ToWorker } from "./protocol";

interface WorkerScope {
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
  postMessage(message: FromWorker): void;
}

const scope = self as unknown as WorkerScope;
const host = createWorkerHost(
  (message) => scope.postMessage(message),
  () => new OffscreenCanvas(1, 1),
);
scope.onmessage = (event) => host.handle(event.data);
