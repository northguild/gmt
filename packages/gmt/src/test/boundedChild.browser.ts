/**
 * The browser twin of `boundedChild.ts`: runs the same expressions on the browser's own engine, in
 * a module Worker that is terminated when `timeoutMs` passes, so a call that never returns fails
 * the test by `timedOut` instead of hanging the page. The clock starts once the worker has loaded
 * GMT: the first worker in a run waits for the dev server to transform the whole module graph,
 * and that wait is not the call under test.
 *
 * It bounds time only. A browser worker has no heap limit to set, so `heapMb` is accepted and
 * ignored, and a fatal out-of-memory still ends the whole tab rather than one child.
 */
import type { BoundedCall, BoundedRun } from "./boundedChild";

interface BrowserWorker {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: string }) => void) | null;
  onerror:
    | ((event: { message?: string; preventDefault(): void }) => void)
    | null;
}

// The tsconfig has no DOM lib; Vite needs the literal `new Worker(new URL(...), { type })` form.
declare const Worker: new (
  url: URL,
  options: { type: "module" },
) => BrowserWorker;

/**
 * See `boundedChild.ts`. The default `timeoutMs` (10 s) plus a cold load stays under the browser
 * test timeout (`vitest.browser.config.ts`), so a hang reports `timedOut` instead of a Vitest
 * timeout.
 */
export function runInBoundedChild(
  expressions: readonly string[],
  { timeoutMs = 10_000 }: { timeoutMs?: number; heapMb?: number } = {},
): Promise<BoundedRun> {
  return new Promise((resolve) => {
    const worker: BrowserWorker = new Worker(
      new URL("./boundedWorker.ts", import.meta.url),
      { type: "module" },
    );
    const calls: BoundedCall[] = [];
    let stderr = "";
    const finish = (timedOut: boolean, crashed: boolean): void => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ calls, timedOut, crashed, stderr: stderr.slice(-400) });
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    worker.onmessage = (event) => {
      if (event.data === "ready") {
        timer = setTimeout(() => finish(true, false), timeoutMs);
        worker.postMessage({ expressions });
      } else if (event.data === "done") finish(false, false);
      else calls.push(JSON.parse(event.data) as BoundedCall);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      stderr = event.message ?? "worker error";
      finish(false, true);
    };
  });
}
